/**
 * Synthetic Quiz Data Generator
 *
 * Creates 30 demo users with quizzes and ~2,000 quiz attempts that have
 * realistic score distributions simulating:
 * - User-specific skill levels (some users are strong, some weak)
 * - The Ebbinghaus forgetting curve (review → accuracy improvement)
 * - Topic-specific difficulty variation
 *
 * Demo users are marked with isBanned=false (reusing the field as isDemo marker
 * is not available — instead their usernames are prefixed with "demo_ml_").
 * They are excluded from leaderboard by filtering username prefix.
 *
 * Usage:
 *   npx tsx scripts/generate-quiz-data.ts
 */
import "dotenv/config";
import { prisma } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth/jwt";

const NUM_USERS = 30;
const QUIZZES_PER_USER = 15; // ~450 quizzes total
const MAX_ATTEMPTS_PER_QUIZ = 4; // ~2,000 attempts total

// Realistic quiz questions template
const QUESTION_TEMPLATES = [
  {
    question: "What is the main purpose of spaced repetition?",
    options: ["To memorize facts permanently", "To review at optimal intervals for retention", "To test speed of recall", "To compete with others"],
    correctIndex: 1,
    explanation: "Spaced repetition leverages the forgetting curve to review just before forgetting occurs.",
    difficulty: "easy" as const,
  },
  {
    question: "Which concept describes the optimal difficulty for learning?",
    options: ["Flow state", "Desirable difficulty", "Cognitive load", "Zone of proximal development"],
    correctIndex: 1,
    explanation: "Bjork (1994) — learning is most effective at ~70-80% success rate.",
    difficulty: "hard" as const,
  },
  {
    question: "What does SVD stand for in recommendation systems?",
    options: ["Single Value Decomposition", "Singular Value Decomposition", "System Vector Design", "Statistical Variance Distribution"],
    correctIndex: 1,
    explanation: "SVD factorizes a user-item matrix into latent factor vectors.",
    difficulty: "medium" as const,
  },
  {
    question: "The Ebbinghaus forgetting curve shows that memory...",
    options: ["Decays linearly", "Decays exponentially", "Is permanent after learning", "Improves with stress"],
    correctIndex: 1,
    explanation: "Retention decays exponentially; spaced review flattens the curve.",
    difficulty: "easy" as const,
  },
  {
    question: "In gamification, what is an 'achievement unlock' an example of?",
    options: ["Extrinsic motivation", "Intrinsic motivation", "Punishment", "Onboarding"],
    correctIndex: 0,
    explanation: "Badges/achievements are extrinsic rewards that can scaffold intrinsic motivation.",
    difficulty: "medium" as const,
  },
];

const NOTE_CONTENTS = [
  "Spaced repetition is a learning technique that incorporates increasing intervals of time between subsequent review of previously learned material. The method is based on the forgetting curve, which shows that memory retention decays exponentially over time. By reviewing material at strategic intervals, learners can strengthen memory consolidation. The SM-2 algorithm used by SuperMemo calculates optimal review intervals based on the learner's performance, adjusting the scheduling dynamically. Research by Ebbinghaus in 1885 first demonstrated the forgetting curve, and modern systems like Anki and Duolingo have refined these principles for digital learning.",
  "Gamification applies game-design elements in non-game contexts to motivate engagement. The core mechanics include points, badges, leaderboards, quests, and progression systems. Research by Hamari et al. (2014) found a small-to-moderate positive effect on learning outcomes. However, the overjustification effect suggests extrinsic rewards can undermine intrinsic motivation. Successful gamification provides meaningful feedback loops, competence signaling, and adaptive difficulty. The Goal-Gradient Effect (Kivetz et al., 2006) shows that perceived progress toward a goal increases motivation.",
  "Singular Value Decomposition (SVD) is a matrix factorization technique widely used in recommendation systems. It decomposes a user-item rating matrix into lower-dimensional latent factor vectors. For a user-item matrix R, SVD finds R ≈ U × S × V^T where U represents user factors and V represents item factors. In collaborative filtering, this captures hidden patterns in user preferences. Funk SVD, popularized by the Netflix Prize, uses stochastic gradient descent to learn factors. The number of latent factors is a key hyperparameter: too few underfit, too many overfit.",
  "The desirable difficulty principle, proposed by Bjork (1994), states that learning conditions that make initial acquisition more difficult often lead to better long-term retention. This includes spacing, interleaving, and testing effects. The optimal success rate for learning is around 70-80%: too easy and the material isn't challenging enough; too hard and the learner becomes frustrated. This principle underlies adaptive learning systems that adjust difficulty based on individual performance.",
  "Self-Determination Theory (Deci & Ryan, 2000) identifies three innate psychological needs: autonomy, competence, and relatedness. In gamified systems, autonomy is supported by user choice (paths, customization), competence by progressive challenges and feedback, and relatedness by social features (guilds, shared goals). Overjustification occurs when extrinsic rewards undermine intrinsic motivation if perceived as controlling rather than informational. Well-designed gamification uses rewards as information, not control.",
];

async function main() {
  console.log("🧪 Starting synthetic quiz data generation...\n");

  // Check existing demo users to avoid duplicates
  const existing = await prisma.user.count({ where: { username: { startsWith: "demo_ml_" } } });
  if (existing > 0) {
    console.log(`⚠️  Found ${existing} existing demo_ml_ users. Cleaning up...`);
    await prisma.auditLog.deleteMany({ where: { user: { username: { startsWith: "demo_ml_" } } } });
    await prisma.quizAttempt.deleteMany({ where: { user: { username: { startsWith: "demo_ml_" } } } });
    await prisma.quiz.deleteMany({ where: { user: { username: { startsWith: "demo_ml_" } } } });
    await prisma.note.deleteMany({ where: { user: { username: { startsWith: "demo_ml_" } } } });
    await prisma.user.deleteMany({ where: { username: { startsWith: "demo_ml_" } } });
    console.log("✓ Cleaned up old demo data.\n");
  }

  const passwordHash = await hashPassword("demo_ml_pass");

  for (let u = 0; u < NUM_USERS; u++) {
    const username = `demo_ml_user${u}`;
    const email = `demo_ml_user${u}@synthetic.test`;
    const skillLevel = 0.3 + Math.random() * 0.6; // 0.3-0.9: some users are strong, some weak

    const user = await prisma.user.create({
      data: {
        email,
        username,
        passwordHash,
        level: Math.floor(5 + Math.random() * 20),
        xp: Math.floor(500 + Math.random() * 5000),
        coins: Math.floor(100 + Math.random() * 500),
        streak: Math.floor(Math.random() * 14),
        onboardingCompleted: true,
        path: ["student", "professional", "journaler"][u % 3],
        gamificationStyle: "balanced",
      },
    });

    // Create a few notes for the user (needed for quizzes)
    const notes = [];
    for (let n = 0; n < QUIZZES_PER_USER; n++) {
      const content = NOTE_CONTENTS[n % NOTE_CONTENTS.length];
      const note = await prisma.note.create({
        data: {
          title: `Synthetic Note ${u}-${n}`,
          content,
          wordCount: content.split(/\s+/).filter(Boolean).length,
          userId: user.id,
          tags: ["synthetic", "test"],
          category: "ML Test",
        },
        select: { id: true, title: true },
      });
      notes.push(note);
    }

    // Create quizzes from notes
    for (let n = 0; n < notes.length; n++) {
      const quiz = await prisma.quiz.create({
        data: {
          noteId: notes[n].id,
          userId: user.id,
          questions: QUESTION_TEMPLATES as any,
          reviewCount: 0,
          avgScore: 0,
          generatedAt: new Date(Date.now() - Math.random() * 60 * 86400000), // random past date
        },
      });

      // Simulate 1-4 attempts with realistic forgetting curve + skill variation
      const numAttempts = 1 + Math.floor(Math.random() * MAX_ATTEMPTS_PER_QUIZ);
      let prevScore = 0;

      for (let a = 0; a < numAttempts; a++) {
        // Difficulty of this quiz for this user: base = (1 - skillLevel) * 100
        const baseDifficulty = (1 - skillLevel) * 100;

        // Forgetting curve: earlier attempts have score influenced by recency
        // improvement across reviews (forgetting curve recovery: +5-15% per review)
        const reviewBonus = a * (5 + Math.random() * 10); // gradual improvement
        const noise = (Math.random() - 0.5) * 20; // ±10% random variance
        let score = Math.max(0, Math.min(100, Math.round(100 - baseDifficulty + reviewBonus + noise)));

        // Ensure minimum spread: don't allow all 100s
        if (score === 100 && Math.random() > 0.3) score = 90 + Math.floor(Math.random() * 10);

        await prisma.quizAttempt.create({
          data: {
            quizId: quiz.id,
            userId: user.id,
            score,
            answers: QUESTION_TEMPLATES.map((q, qi) => ({
              questionIndex: qi,
              selectedIndex: qi === 0 ? q.correctIndex : Math.floor(Math.random() * 4),
              correct: qi === 0 ? true : Math.random() > 0.5,
            })) as any,
            completedAt: new Date(Date.now() - (numAttempts - a) * 7 * 86400000 + Math.random() * 3 * 86400000),
          },
        });

        prevScore = score;
      }

      // Update quiz review count + avg score
      const attempts = await prisma.quizAttempt.findMany({ where: { quizId: quiz.id }, select: { score: true } });
      const avg = attempts.length > 0 ? attempts.reduce((s, a) => s + a.score, 0) / attempts.length : 0;
      await prisma.quiz.update({
        where: { id: quiz.id },
        data: {
          reviewCount: numAttempts,
          avgScore: Math.round(avg),
          lastReviewedAt: new Date(Date.now() - Math.random() * 7 * 86400000),
        },
      });
    }
  }

  const totalQuizzes = await prisma.quiz.count({ where: { user: { username: { startsWith: "demo_ml_" } } } });
  const totalAttempts = await prisma.quizAttempt.count({ where: { user: { username: { startsWith: "demo_ml_" } } } });

  console.log(`✅ Generated ${NUM_USERS} synthetic users`);
  console.log(`✅ Created ${totalQuizzes} quizzes`);
  console.log(`✅ Created ${totalAttempts} quiz attempts`);
  console.log(`\n📊 SVD ready to train — run /api/quiz/pending or /admin/ml-results to see predictions.`);
  console.log(`\n⚠️  To clean up: npx tsx scripts/generate-quiz-data.ts (re-run to clear + regenerate)`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("❌ Error:", e);
  process.exit(1);
});
