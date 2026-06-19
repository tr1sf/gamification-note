// Run with dev server on localhost:3000
// npx tsx scripts/verify-guild-chat.ts

import { prisma } from "../src/lib/db";

const BASE = "http://localhost:3000";
const headers = { "Content-Type": "application/json" };
const TEST_EMAIL = `guild-chat-${Date.now()}@tavernotex.dev`;
const TEST_PASSWORD = "test123456";

async function main() {
  console.log("💬 Verifying guild chat and reactions...\n");

  async function api(path: string, method = "GET", body?: any, cookie = "") {
    const h = { ...headers } as Record<string, string>;
    if (cookie) h.Cookie = cookie;
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: h,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    try { return { status: res.status, cookie: res.headers.get("set-cookie") || "", data: JSON.parse(text) }; }
    catch { return { status: res.status, cookie: res.headers.get("set-cookie") || "", data: text }; }
  }

  // 1. Register
  console.log("1️⃣ Register");
  const reg = await api("/api/auth/register", "POST", {
    email: TEST_EMAIL,
    username: `guildchat${Date.now()}`,
    password: TEST_PASSWORD,
  });
  if (!reg.data.success) { console.error("❌ Register failed:", reg.data); process.exit(1); }
  console.log("✅ Registered");

  // 2. Login
  console.log("2️⃣ Login");
  const login = await api("/api/auth/login", "POST", { login: TEST_EMAIL, password: TEST_PASSWORD });
  if (!login.data.success) { console.error("❌ Login failed:", login.data); process.exit(1); }
  const cookie = login.cookie;
  console.log("✅ Logged in");

  // 3. Create guild
  console.log("3️⃣ Create guild");
  const guildRes = await api("/api/guilds", "POST", { name: "Test Guild", description: "For testing", isPublic: true }, cookie);
  if (!guildRes.data.success) { console.error("❌ Guild create failed:", guildRes.data); process.exit(1); }
  const guildId = guildRes.data.data.id;
  console.log(`✅ Guild created: ${guildId}`);

  // 4. Send message via REST
  console.log("4️⃣ Send message");
  const msgRes = await api(`/api/guilds/${guildId}/messages`, "POST", { content: "Hello guild!" }, cookie);
  if (!msgRes.data.success) { console.error("❌ Message send failed:", msgRes.data); process.exit(1); }
  const messageId = msgRes.data.data.id;
  console.log(`✅ Message sent: ${messageId}`);

  // 5. Verify GET messages returns it with reactions array
  console.log("5️⃣ Fetch messages");
  const listRes = await api(`/api/guilds/${guildId}/messages`, "GET", undefined, cookie);
  if (!listRes.data.success) { console.error("❌ Fetch messages failed:", listRes.data); process.exit(1); }
  const messages = listRes.data.data.items;
  const found = messages.find((m: any) => m.id === messageId);
  if (!found) { console.error("❌ Sent message not in list"); process.exit(1); }
  if (!Array.isArray(found.reactions)) { console.error("❌ Reactions field missing"); process.exit(1); }
  console.log(`✅ Message returned with ${found.reactions.length} reactions`);

  // 6. Add reaction
  console.log("6️⃣ Add reaction");
  const reactRes = await api(`/api/guilds/${guildId}/messages/${messageId}/react`, "POST", { emoji: "👍" }, cookie);
  if (!reactRes.data.success) { console.error("❌ Reaction failed:", reactRes.data); process.exit(1); }
  console.log(`✅ Reaction added: ${reactRes.data.data.reactions.length} reactions`);

  // 7. Remove reaction
  console.log("7️⃣ Remove reaction");
  const delRes = await api(`/api/guilds/${guildId}/messages/${messageId}/react`, "DELETE", undefined, cookie);
  if (!delRes.data.success) { console.error("❌ Reaction remove failed:", delRes.data); process.exit(1); }
  if (delRes.data.data.reactions.length !== 0) { console.error("❌ Expected 0 reactions after remove"); process.exit(1); }
  console.log("✅ Reaction removed");

  // Cleanup
  const u = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
  if (u) {
    await prisma.guildMessage.deleteMany({ where: { guild: { ownerId: u.id } } });
    await prisma.guildMember.deleteMany({ where: { userId: u.id } });
    await prisma.guild.deleteMany({ where: { ownerId: u.id } });
    await prisma.userInventory.deleteMany({ where: { userId: u.id } });
    await prisma.user.delete({ where: { id: u.id } });
  }
  await prisma.$disconnect();

  console.log("\n✨ Guild chat/reaction verification passed!");
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
