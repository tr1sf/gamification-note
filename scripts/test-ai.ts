// Run: set TEST_EMAIL=xxx&set TEST_PASSWORD=xxx&& npx tsx scripts/test-ai.ts
const EMAIL = process.env.TEST_EMAIL!;
const PASSWORD = process.env.TEST_PASSWORD!;
if (!EMAIL || !PASSWORD) { console.error("Set TEST_EMAIL and TEST_PASSWORD env vars"); process.exit(1); }

const BASE = "http://localhost:3000";
const headers = { "Content-Type": "application/json" };

async function main() {
  // 1. Login
  console.log("🔑 Logging in...");
  const loginRes = await fetch(`${BASE}/api/auth/login`, {
    method: "POST", headers,
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const cookie = loginRes.headers.get("set-cookie") || "";
  const loginData = await loginRes.json() as any;
  if (!loginData.success) { console.error("Login failed:", loginData.error?.message); return; }
  console.log(`✅ Logged in as ${loginData.data.username}`);

  async function api(path: string, method = "GET", body?: any) {
    const h = { ...headers, Cookie: cookie } as Record<string, string>;
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: h,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    try { return JSON.parse(text); } catch { return text; }
  }

  // 2. Create note
  console.log("📝 Creating test note...");
  const noteRes = await api("/api/notes", "POST", {
    title: "AI & Machine Learning",
    content: "Artificial intelligence and machine learning are transforming how we interact with technology in profound and unprecedented ways. Deep neural networks can now recognize images, translate languages, and generate human-like text with remarkable accuracy and fluency. Natural language processing enables computers to understand context and meaning in ways that were impossible just a few years ago. Reinforcement learning allows AI agents to learn from trial and error in complex environments, mastering games and robotics tasks through repeated practice. Computer vision systems can detect objects and faces in real-time video streams, powering applications from autonomous vehicles to medical imaging diagnostics. These technologies continue to evolve rapidly.",
    tags: ["ai", "ml"],
  });
  if (!noteRes.success) { console.error("❌ Note creation failed:", noteRes.error); return; }
  const noteId = noteRes.data.note.id;
  console.log(`✅ Note: ${noteId} (${noteRes.data.note.wordCount} words)`);

  // 3. Summarize
  console.log("🤖 Summarizing...");
  const sumRes = await api(`/api/notes/${noteId}/summarize`, "POST");
  if (sumRes.success) {
    console.log("✅ Summarize:", sumRes.data.summary);
  } else {
    console.error("❌ Summarize failed:", sumRes.error?.message || sumRes);
  }

  // 4. Generate Quiz
  console.log("🧠 Generating quiz...");
  const quizRes = await api(`/api/notes/${noteId}/quiz/generate`, "POST");
  if (quizRes.success) {
    const qs = (quizRes.data?.questions || []) as any[];
    console.log(`✅ Quiz: ${qs.length} questions`);
    qs.forEach((q: any, i: number) => console.log(`  Q${i+1}: ${q.question?.slice(0,80)}...`));
  } else {
    console.error("❌ Quiz failed:", quizRes.error?.message || quizRes);
  }

  console.log("\n✨ All tests complete!");
}
main().catch(e => console.error("Fatal:", e.message));
