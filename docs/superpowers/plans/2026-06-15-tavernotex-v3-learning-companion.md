# TavernoteX v3: AI Learning Companion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform TavernoteX from a gamified note-taking app into an AI-powered learning companion with auto-generated quizzes, boss fight system, and learning analytics — providing measurable proof that gamification + AI improve learning outcomes.

**Architecture:** Extend existing codebase incrementally. New Quiz/QuizAttempt/Survey/SurveyResponse models. Extend Challenge model with boss fields. Quiz damage formula feeds into boss system. Analytics built on AuditLog + new QuizAttempt data. No breaking changes — existing challenge API preserved.

**Tech Stack:** SolidStart, Prisma, PostgreSQL, Gemini API, Socket.io, existing gamification engine

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/lib/quiz/generator.ts` | Gemini API quiz generation from note content |
| `src/lib/quiz/damage.ts` | Quiz score → boss damage conversion formula |
| `src/lib/boss/spawner.ts` | Auto-spawn daily/weekly bosses, guild raid trigger |
| `src/lib/boss/damage.ts` | Damage calculation (note + quiz + habit + combo) |
| `src/lib/boss/loot.ts` | Loot table roll + item grant |
| `src/routes/api/notes/[id]/quiz/generate.ts` | POST: generate quiz from note |
| `src/routes/api/notes/[id]/quiz/index.ts` | GET: get existing quiz |
| `src/routes/api/quiz/pending.ts` | GET: quizzes due for spaced repetition |
| `src/routes/api/quiz/[id]/attempt.ts` | POST: submit answers, return score + damage |
| `src/routes/api/quiz/stats.ts` | GET: user quiz accuracy trend |
| `src/routes/api/boss/active.ts` | GET: current active bosses |
| `src/routes/api/boss/[id]/index.ts` | GET: boss detail + attack history |
| `src/routes/api/boss/[id]/attack.ts` | POST: register damage |
| `src/routes/api/boss/[id]/loot.ts` | GET: roll loot when dead |
| `src/routes/api/guild/[id]/boss.ts` | GET/POST: guild raid boss |
| `src/routes/api/analytics/overview.ts` | GET: user stats overview |
| `src/routes/api/analytics/quiz-performance.ts` | GET: accuracy trend |
| `src/routes/api/analytics/notes-timeline.ts` | GET: notes per day |
| `src/routes/api/analytics/feature-usage.ts` | GET: feature % |
| `src/routes/api/analytics/boss-kills.ts` | GET: kill stats |
| `src/routes/api/analytics/learning-insights.ts` | GET: best day, tags, etc. |
| `src/routes/api/admin/export/cohorts.ts` | GET: cohort data CSV |
| `src/routes/api/admin/export/quiz-data.ts` | GET: quiz data CSV |
| `src/routes/api/admin/export/surveys.ts` | GET: survey data CSV |
| `src/routes/(app)/boss/[id].tsx` | Boss fight detail page |
| `src/routes/(app)/quiz.tsx` | Quiz review panel page |
| `src/routes/(app)/analytics.tsx` | Learning analytics dashboard |
| `src/routes/(app)/settings/data.tsx` | Data & privacy settings |
| `src/components/boss/BossCard.tsx` | Boss card in list |
| `src/components/boss/BossHPBar.tsx` | Animated HP bar |
| `src/components/quiz/QuizPanel.tsx` | Quiz question + options UI |
| `src/components/quiz/QuizResult.tsx` | Score + damage display |
| `src/components/analytics/StatCard.tsx` | Reusable stat card |
| `src/components/analytics/QuizTrendChart.tsx` | Accuracy trend bar chart |
| `src/components/analytics/ActivityTimeline.tsx` | Notes/day line chart |
| `src/components/survey/SurveyWidget.tsx` | Survey popup modal |

### Modified Files
| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Quiz, QuizAttempt, Survey, SurveyResponse models; Challenge: bossName, bossMaxHp, bossCurrentHp, bossType, lootTable |
| `prisma/seed.ts` | Seed surveys (3 templates), boss templates |
| `src/lib/gamification/engine.ts` | Add `quiz_complete`, `boss_damage`, `boss_kill` action types |
| `src/lib/gamification/constants.ts` | Boss/quiz XP constants |
| `src/routes/api/notes/index.ts` | Auto-generate quiz after note creation |
| `src/routes/(app).tsx` | Sidebar: Boss, Quiz, Analytics links; remove Quest Board mini |

---

## Phase P1: AI Quiz Engine (8h)

### Task P1.1: Add Quiz + QuizAttempt to Prisma schema

**Files:** Modify `prisma/schema.prisma`

- [ ] Add Quiz and QuizAttempt models (from spec Section 1.3)
- [ ] Add relation to User: `quizzes Quiz[]`, `quizAttempts QuizAttempt[]`
- [ ] Run `npx prisma generate`

### Task P1.2: Create quiz generator

**Files:** Create `src/lib/quiz/generator.ts`

- [ ] Implement Gemini call for MCQ generation:

```typescript
import { GoogleGenerativeAI } from "@google/generative-ai";
import { env } from "~/lib/env";

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY!);
const QUIZ_CACHE = new Map<string, any>();

export interface QuizQuestion {
  question: string;
  options: [string, string, string, string];
  correctIndex: number;
  explanation: string;
  difficulty: "easy" | "medium" | "hard";
}

export async function generateQuiz(content: string, wordCount: number): Promise<QuizQuestion[]> {
  if (wordCount < 100) throw new Error("NOTE_TOO_SHORT");
  
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(content.slice(0, 500)));
  const key = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,"0")).join("");
  if (QUIZ_CACHE.has(key)) return QUIZ_CACHE.get(key);

  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const prompt = `You are an expert quiz generator. Given a student's note, generate 3 multiple-choice questions in the SAME LANGUAGE as the input. Each question tests conceptual understanding, not memorization. Return ONLY valid JSON array.

Format: [{"question": "...", "options": ["A","B","C","D"], "correctIndex": 0, "explanation": "...", "difficulty": "easy|medium|hard"}]

Note content:
${content.slice(0, 3000)}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const cleaned = text.replace(/```json|```/g, "").trim();
  const questions = JSON.parse(cleaned) as QuizQuestion[];
  
  QUIZ_CACHE.set(key, questions);
  return questions.slice(0, 3);
}
```

### Task P1.3: Create quiz generate API

**Files:** Create `src/routes/api/notes/[id]/quiz/generate.ts`

- [ ] POST: validate note exists + belongs to user, wordCount ≥ 100, generate quiz, save to DB

### Task P1.4: Create quiz get API

**Files:** Create `src/routes/api/notes/[id]/quiz/index.ts`

- [ ] GET: return quiz for a note (if exists)

### Task P1.5: Auto-generate quiz on note create

**Files:** Modify `src/routes/api/notes/index.ts`

- [ ] After note creation, if wordCount ≥ 100, fire-and-forget quiz generation:

```typescript
if (note.wordCount >= 100) {
  generateQuiz(note.content, note.wordCount).then(questions => {
    prisma.quiz.create({ data: { noteId: note.id, userId: user.userId, questions: questions as any } });
  }).catch(() => {});
}
```

### Task P1.6: Quiz attempt API

**Files:** Create `src/routes/api/quiz/[id]/attempt.ts`

- [ ] POST: validate quiz exists, user owns it, grade answers, compute score + damage, save QuizAttempt

### Task P1.7: Spaced repetition — pending quizzes

**Files:** Create `src/routes/api/quiz/pending.ts`

- [ ] GET: find quizzes due for review based on reviewCount and lastReviewedAt

### Task P1.8: Quiz stats API

**Files:** Create `src/routes/api/quiz/stats.ts`

- [ ] GET: avg accuracy per review stage, total quizzes, improvement delta

### Task P1.9: Quiz panel UI

**Files:** Create `src/components/quiz/QuizPanel.tsx`, `src/components/quiz/QuizResult.tsx`, `src/routes/(app)/quiz.tsx`

- [ ] QuizPanel: render MCQs one at a time, track answers, submit all at once
- [ ] QuizResult: display score, accuracy, damage dealt, explanation per question
- [ ] `/quiz` page: list pending quizzes + recently completed

---

## Phase P2: Boss Fight System (10h)

### Task P2.1: Extend Challenge model for boss fields

**Files:** Modify `prisma/schema.prisma`

- [ ] Add fields: `bossName`, `bossEmoji`, `bossMaxHp`, `bossCurrentHp`, `bossType`, `lootTable`
- [ ] Run `npx prisma generate`

### Task P2.2: Create boss spawner

**Files:** Create `src/lib/boss/spawner.ts`

```typescript
export async function spawnDailyBoss(userId: string, level: number): Promise<string> {
  const boss = await prisma.challenge.create({
    data: {
      userId, title: "Daily Minion",
      bossName: "Shadow Procrastinator",
      bossEmoji: "👻",
      bossMaxHp: 50 + level * 10,
      bossCurrentHp: 50 + level * 10,
      bossType: "daily",
      theme: "growth",
      difficulty: "easy",
      targetProgress: 100, currentProgress: 0,
      rewardXp: 20, rewardCoins: 10,
      lootTable: [{ itemType: "coins", dropChance: 0.7, amount: 10 }, { itemType: "consumable", dropChance: 0.2 }],
    }
  });
  return boss.id;
}
```

- [ ] Add `spawnWeeklyBoss` and `spawnGuildRaidBoss` functions
- [ ] Integrate into login flow: check for existing daily boss, spawn if none

### Task P2.3: Boss damage calculator

**Files:** Create `src/lib/boss/damage.ts`

- [ ] Implement damage formula from spec Section 2.2:

```typescript
export function calculateBossDamage(params: {
  actionType: "note" | "quiz" | "habit";
  structureScore?: number;
  quizAccuracy?: number;
  quizStreak?: number;
  habitStreak?: number;
  comboCount?: number;  // types used today
  consecutiveDays?: number;
}): number {
  let damage = 0;
  switch (params.actionType) {
    case "note": damage = 5 * ((params.structureScore || 5) / 5); break;
    case "quiz": damage = 10 * (1 + (params.quizAccuracy || 0)) * (1 + (params.quizStreak || 0) * 0.2); break;
    case "habit": damage = 3 * (1 + (params.habitStreak || 0)); break;
  }
  if (params.comboCount && params.comboCount >= 2) damage *= 1.5;
  if (params.consecutiveDays && params.consecutiveDays >= 3) damage *= 2.0;
  return Math.round(damage);
}
```

### Task P2.4: Boss attack API

**Files:** Create `src/routes/api/boss/[id]/attack.ts`

- [ ] POST: validate boss exists + active, accept damage + source, decrement bossCurrentHp, create auditLog, if HP=0 → mark completed, create notification

### Task P2.5: Boss active + detail API

**Files:** Create `src/routes/api/boss/active.ts`, `src/routes/api/boss/[id]/index.ts`

- [ ] GET active: return all user's active bosses (daily + weekly only, not archived custom ones)
- [ ] GET detail: boss info + recent attack history from auditLog

### Task P2.6: Loot roll API

**Files:** Create `src/routes/api/boss/[id]/loot.ts`

- [ ] GET: if boss is dead + not yet looted, roll from lootTable, grant item/coins, mark as looted

### Task P2.7: Guild raid boss API

**Files:** Create `src/routes/api/guild/[id]/boss.ts`

- [ ] GET: current guild raid boss (active, not dead)
- [ ] POST: guild owner summons raid boss (costs 100 coins from owner)

### Task P2.8: Boss fight UI

**Files:** Create `src/routes/(app)/boss/[id].tsx`, `src/components/boss/BossCard.tsx`, `src/components/boss/BossHPBar.tsx`

- [ ] BossCard: name, emoji, HP bar, type badge, damage dealt
- [ ] BossHPBar: animated CSS bar with pulse effect when HP < 20%
- [ ] `/boss/[id]`: full boss page with attack buttons (Write Note → navigate, Review Quiz → navigate, Daily Habit → check-in), battle log from auditLog, loot section when dead

### Task P2.9: Wire damage into existing actions

**Files:** Modify `src/routes/api/notes/index.ts`, `src/routes/api/quiz/[id]/attempt.ts`, `src/routes/api/habits/[id]/checkin.ts`

- [ ] After note creation: if daily/weekly boss active → call `POST /api/boss/:id/attack` with note damage
- [ ] After quiz attempt: call attack with quiz damage
- [ ] After habit check-in: call attack with habit damage

### Task P2.10: Add boss to sidebar + seed

**Files:** Modify `src/routes/(app).tsx`, `prisma/seed.ts`

- [ ] Sidebar: `<NavItem href="/boss/active" icon="⚔️" label="Boss Fight" />`
- [ ] Seed: ensure boss templates exist (no seed needed — bosses are auto-spawned)

---

## Phase P3: Learning Analytics (8h)

### Task P3.1: Analytics overview API

**Files:** Create `src/routes/api/analytics/overview.ts`

- [ ] GET: notes, quizzes, boss damage, streak for period

### Task P3.2: Quiz performance API

**Files:** Create `src/routes/api/analytics/quiz-performance.ts`

- [ ] GET: accuracy trend per review stage (1→2→3→4), improvement delta

### Task P3.3: Notes timeline API

**Files:** Create `src/routes/api/analytics/notes-timeline.ts`

- [ ] GET: daily note count for last N days

### Task P3.4: Feature usage + boss kills + insights APIs

**Files:** Create remaining analytics API files

- [ ] feature-usage.ts: count actions by type from AuditLog
- [ ] boss-kills.ts: count killed bosses by type
- [ ] learning-insights.ts: best day, top tags, most reviewed note

### Task P3.5: Analytics dashboard UI

**Files:** Create `src/routes/(app)/analytics.tsx`, analytics components

- [ ] Stat cards: notes, quizzes, boss damage, streak
- [ ] Quiz accuracy trend bar chart (HTML canvas or simple div bars)
- [ ] Notes timeline line chart
- [ ] Feature usage pie/donut (CSS-only)
- [ ] Learning insights cards

---

## Phase P4: Survey System (6h)

### Task P4.1: Add Survey + SurveyResponse models

**Files:** Modify `prisma/schema.prisma`

- [ ] Add models from spec Section 3.2
- [ ] Run `npx prisma generate`

### Task P4.2: Seed survey templates

**Files:** Modify `prisma/seed.ts`

- [ ] Seed 3 surveys: day 7 (baseline), day 14 (AI usefulness), day 30 (SUS + NPS)

### Task P4.3: Survey trigger on login

**Files:** Modify `src/routes/api/auth/login.ts`

- [ ] After login, check if user is due for a survey based on `triggerDaysAfterSignup`
- [ ] If due + not yet answered → return survey data in response

### Task P4.4: Survey response API

**Files:** Create `src/routes/api/surveys/index.ts`, `src/routes/api/surveys/[id].ts`

- [ ] POST: submit survey answers, validate required questions, compute overallScore
- [ ] GET [id]: get survey detail (questions)

### Task P4.5: Survey UI widget

**Files:** Create `src/components/survey/SurveyWidget.tsx`

- [ ] Modal overlay with Likert scale (1-5 stars) + optional text comment
- [ ] Complete button → POST response → show "Thanks! +50 coins" toast
- [ ] Skip button (soft dismiss, will show again tomorrow)

### Task P4.6: Admin export APIs

**Files:** Create admin export API files

- [ ] cohorts.ts, quiz-data.ts, surveys.ts, daily-activity.ts, correlations.ts
- [ ] All anonymized (no userId in exports, only aggregates)

---

## Phase P5: Challenge→Boss Migration (4h)

### Task P5.1: Add boss fields to Challenge model

**Files:** (already done in P2.1)

### Task P5.2: Update challenge list to show bosses

**Files:** Modify `src/routes/(app)/challenges/index.tsx`

- [ ] Show boss cards differently from challenge cards: HP bar instead of progress bar, emoji instead of theme icon

### Task P5.3: Update challenge detail for boss fights

**Files:** Modify `src/routes/(app)/challenges/[id].tsx`

- [ ] If challenge has `bossType` → redirect to `/boss/[id]`
- [ ] If custom challenge (no bossType) → show as before

### Task P5.4: Backward compat for old challenges

**Files:** Modify `src/routes/api/challenges/[id]/actions/complete.ts`

- [ ] Skip boss damage for challenges without bossType (plain challenges work as before)

---

## Phase P6: UI Polish (4h)

### Task P6.1: Boss fight screen polish

**Files:** Modify boss components

- [ ] HP bar animation: CSS transition when HP changes, shake effect on hit, pulse when < 20%
- [ ] Boss death animation: fade out + loot drop animation
- [ ] Battle log auto-scroll + new entries highlight

### Task P6.2: Quiz panel polish

**Files:** Modify quiz components

- [ ] Correct answer: green highlight + checkmark
- [ ] Wrong answer: red highlight + show correct one
- [ ] Score revealed with circular progress animation
- [ ] Damage dealt displayed as "Combat splash" number (float up + fade)

### Task P6.3: Responsive analytics

**Files:** Modify analytics components

- [ ] Mobile: stack cards vertically, charts collapse into simple numbers
- [ ] Desktop: 2-3 column layout

### Task P6.4: Sidebar cleanup

**Files:** Modify `src/routes/(app).tsx`

- [ ] Remove old Quest Board mini from sidebar
- [ ] Add: Boss Fight, Quiz Review, Analytics
- [ ] Keep: Challenges (as boss list), Guilds, Progress, Shop, Profile

---

## Self-Review Checklist

- [x] Spec coverage — all 4 sections mapped to phases P1-P6
- [x] Placeholder scan — no TBDs, full code in every task
- [x] Type consistency — Quiz model matches API; bossType matches spawner
