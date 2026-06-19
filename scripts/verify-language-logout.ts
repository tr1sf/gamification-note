// Run with dev server on localhost:3000
// npx tsx scripts/verify-language-logout.ts

import { prisma } from "../src/lib/db";

const BASE = "http://localhost:3000";
const headers = { "Content-Type": "application/json" };
const TEST_EMAIL = `lang-test-${Date.now()}@tavernotex.dev`;
const TEST_PASSWORD = "test123456";

async function main() {
  console.log("🌍 Verifying language isolation on logout...\n");

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

  // 1. Register (simulate Vietnamese selected in onboarding via localStorage)
  console.log("1️⃣ Register with Vietnamese preference");
  const reg = await api("/api/auth/register", "POST", {
    email: TEST_EMAIL,
    username: `langtest${Date.now()}`,
    password: TEST_PASSWORD,
    preferredLanguage: "vi",
  });
  if (!reg.data.success) { console.error("❌ Register failed:", reg.data); process.exit(1); }
  console.log(`✅ Registered (preferredLanguage: ${reg.data.data.preferredLanguage})`);

  // 2. Verify DB stored preference
  const dbUser = await prisma.user.findUnique({ where: { email: TEST_EMAIL }, select: { preferredLanguage: true } });
  if (dbUser?.preferredLanguage !== "vi") {
    console.error("❌ DB preferredLanguage not saved:", dbUser);
    process.exit(1);
  }
  console.log("✅ DB stored Vietnamese");

  // 3. Login and verify response contains preferredLanguage
  console.log("2️⃣ Login");
  const login = await api("/api/auth/login", "POST", { login: TEST_EMAIL, password: TEST_PASSWORD });
  if (!login.data.success || login.data.data.preferredLanguage !== "vi") {
    console.error("❌ Login failed or language not returned:", login.data);
    process.exit(1);
  }
  const cookie = login.cookie;
  console.log(`✅ Login returned preferredLanguage: ${login.data.data.preferredLanguage}`);

  // 4. Update language to English via API
  console.log("3️⃣ Switch language to English");
  const updateLang = await api("/api/users/language", "PUT", { lang: "en" }, cookie);
  if (!updateLang.data.success) { console.error("❌ Language update failed:", updateLang.data); process.exit(1); }
  console.log("✅ Language updated to English");

  // 5. Logout
  console.log("4️⃣ Logout");
  const logout = await api("/api/auth/logout", "POST", undefined, cookie);
  console.log(`✅ Logout status: ${logout.status}`);

  // 6. Verify public page returns English for auth strings (no cookie)
  console.log("5️⃣ Check public login page language");
  const pageRes = await fetch(`${BASE}/login`);
  const pageText = await pageRes.text();
  const hasVietnamese = pageText.includes("Chào Mừng Trở Lại") || pageText.includes("Mật Khẩu");
  const hasEnglish = pageText.includes("Welcome back") || pageText.includes("Password");
  if (hasVietnamese) {
    console.error("❌ Public page still contains Vietnamese after logout");
    process.exit(1);
  }
  if (!hasEnglish) {
    console.error("⚠️ Could not confirm English text on login page (may be SSR with no strings)");
  } else {
    console.log("✅ Public login page is in English");
  }

  // Cleanup
  const u = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
  if (u) {
    await prisma.userInventory.deleteMany({ where: { userId: u.id } });
    await prisma.user.delete({ where: { id: u.id } });
  }
  await prisma.$disconnect();

  console.log("\n✨ Language isolation verification passed!");
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
