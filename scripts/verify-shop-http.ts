import { prisma } from "../src/lib/db";

// Run with dev server on localhost:3000
// npx tsx scripts/verify-shop-http.ts

const BASE = "http://localhost:3000";
const headers = { "Content-Type": "application/json" };
const TEST_EMAIL = `shop-http-${Date.now()}@tavernotex.dev`;
const TEST_PASSWORD = "test123456";

async function main() {
  console.log("🌐 HTTP verification of shop and Potion Match...\n");

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
    username: `shophttp${Date.now()}`,
    password: TEST_PASSWORD,
    confirmPassword: TEST_PASSWORD,
  });
  if (!reg.data.success) { console.error("❌ Register failed:", reg.data); process.exit(1); }
  console.log("✅ Registered");

  // Give the test user enough coins to buy tickets (new users start with 5 coins)
  await prisma.user.update({ where: { email: TEST_EMAIL }, data: { coins: 200 } });
  console.log("💰 Topped up test user coins to 200");

  // 2. Login
  console.log("2️⃣ Login");
  const login = await api("/api/auth/login", "POST", { login: TEST_EMAIL, password: TEST_PASSWORD });
  if (!login.data.success) { console.error("❌ Login failed:", login.data); process.exit(1); }
  const cookie = login.cookie;
  console.log(`✅ Logged in (coins: ${login.data.data.coins})`);

  // 3. List shop
  console.log("3️⃣ Shop listing");
  const shop = await api("/api/shop", "GET", undefined, cookie);
  if (!shop.data.success) { console.error("❌ Shop failed:", shop.data); process.exit(1); }
  const ticket = shop.data.data.find((i: any) => i.name === "Alchemy Ticket");
  if (!ticket) { console.error("❌ Alchemy Ticket not in shop"); process.exit(1); }
  console.log(`✅ Alchemy Ticket in shop: ${ticket.coinCost} coins`);

  // 4. Inventory should have 2 tickets from registration
  console.log("4️⃣ Inventory after registration");
  const dash = await api("/api/stats/dashboard", "GET", undefined, cookie);
  const invTicket = dash.data.data.inventory.find((i: any) => i.name === "Alchemy Ticket");
  if (!invTicket || invTicket.quantity !== 2) {
    console.error("❌ Expected 2 free tickets, got", invTicket?.quantity);
    process.exit(1);
  }
  console.log(`✅ ${invTicket.quantity} free Alchemy Tickets`);

  // 5. Buy a ticket
  console.log("5️⃣ Purchase ticket");
  const buy1 = await api(`/api/shop/${ticket.id}/purchase`, "POST", undefined, cookie);
  if (!buy1.data.success) { console.error("❌ Purchase failed:", buy1.data); process.exit(1); }
  console.log(`✅ Purchased 1 ticket (coins left: ${buy1.data.data.coins})`);

  // 6. Buy another ticket (stack)
  console.log("6️⃣ Purchase ticket again (stack)");
  const buy2 = await api(`/api/shop/${ticket.id}/purchase`, "POST", undefined, cookie);
  if (!buy2.data.success) { console.error("❌ Second purchase failed:", buy2.data); process.exit(1); }
  console.log(`✅ Purchased 2nd ticket (coins left: ${buy2.data.data.coins})`);

  // 7. Verify inventory count (2 free + 2 bought = 4)
  console.log("7️⃣ Verify ticket count");
  const ticketsBefore = await api("/api/minigames/potion/tickets", "GET", undefined, cookie);
  if (ticketsBefore.data.data.count !== 4) {
    console.error("❌ Expected 4 tickets, got", ticketsBefore.data.data.count);
    process.exit(1);
  }
  console.log(`✅ Ticket counter: ${ticketsBefore.data.data.count}`);

  // 8. Play Potion Match
  console.log("8️⃣ Play Potion Match");
  const play = await api("/api/minigames/potion/play", "POST", { category: "kitchen" }, cookie);
  if (!play.data.success) { console.error("❌ Play failed:", play.data); process.exit(1); }
  console.log("✅ Game started");

  // 9. Verify ticket count decreased
  console.log("9️⃣ Verify ticket count after play");
  const ticketsAfter = await api("/api/minigames/potion/tickets", "GET", undefined, cookie);
  if (ticketsAfter.data.data.count !== 3) {
    console.error("❌ Expected 3 tickets after play, got", ticketsAfter.data.data.count);
    process.exit(1);
  }
  console.log(`✅ Ticket counter after play: ${ticketsAfter.data.data.count}`);

  // 10. Cleanup
  console.log("\n🧹 Cleanup test user");
  const dbUser = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
  if (dbUser) {
    await prisma.userInventory.deleteMany({ where: { userId: dbUser.id } });
    await prisma.user.delete({ where: { id: dbUser.id } });
  }

  console.log("\n✨ HTTP verification passed!");
  await prisma.$disconnect();
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
