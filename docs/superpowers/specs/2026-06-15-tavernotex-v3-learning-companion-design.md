# TavernoteX v3: AI Learning Companion — Design Spec

> **Date:** 2026-06-15 | **Status:** Approved | **Approach:** Incremental build on v2 codebase

---

## Overview

Transform TavernoteX from a "gamified note-taking app" into an **AI-powered learning companion** with measurable academic value. Three pillars:

1. **AI Quiz Engine** — auto-generate MCQs from notes, spaced repetition (1/3/7/30 days), accuracy tracked as proof of learning
2. **Boss Fight System** — daily/weekly/guild raid bosses, damage from quiz scores + note quality, combo system, loot table
3. **Learning Analytics** — user dashboard + research export proving gamification + AI improve learning outcomes

---

## Section 1: AI Quiz Engine

### 1.1 How It Works

```
User writes note (≥100 words) → Gemini generates 3 MCQs → stored in Quiz table
     ↓
Spaced repetition schedule: review at day 1, 3, 7, 30
     ↓
User answers quiz → score % → converted to DAMAGE for boss fights
     ↓
Accuracy tracked across 4 reviews → improvement delta = proof of learning
```

### 1.2 AI Prompt

```
System: You are an expert quiz generator. Given a student's note, generate 3 MCQs
in the SAME LANGUAGE as the input. Each question tests conceptual understanding.

Return JSON array: [{
  "question": string,
  "options": [string, string, string, string],
  "correctIndex": number (0-3),
  "explanation": string (1-2 sentences why correct),
  "difficulty": "easy" | "medium" | "hard"
}]
```

### 1.3 New Models

```prisma
model Quiz {
  id             String   @id @default(uuid()) @db.Uuid
  noteId         String   @db.Uuid
  userId         String   @db.Uuid
  questions      Json     // [{ question, options, correctIndex, explanation, difficulty }]
  generatedAt    DateTime @default(now())
  lastReviewedAt DateTime?
  reviewCount    Int      @default(0)
  avgScore       Float    @default(0)

  note     Note          @relation(fields: [noteId], references: [id], onDelete: Cascade)
  user     User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  attempts QuizAttempt[]

  @@index([userId, lastReviewedAt])
}

model QuizAttempt {
  id          String   @id @default(uuid()) @db.Uuid
  quizId      String   @db.Uuid
  userId      String   @db.Uuid
  score       Int      // 0-100 percentage
  answers     Json     // [{ questionIndex, selectedIndex, correct }]
  completedAt DateTime @default(now())

  quiz Quiz @relation(fields: [quizId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, completedAt])
  @@index([quizId, completedAt])
}
```

### 1.4 Spaced Repetition Logic

```typescript
const REVIEW_INTERVALS = [
  { days: 1, label: "Short-term" },
  { days: 3, label: "Medium-term" },
  { days: 7, label: "Long-term" },
  { days: 30, label: "Mastery" },
];

function getNextReviewDate(quiz: Quiz): Date | null {
  const reviewCount = quiz.reviewCount;
  if (reviewCount >= REVIEW_INTERVALS.length) return null; // all done
  const days = REVIEW_INTERVALS[reviewCount].days;
  const lastReview = quiz.lastReviewedAt || quiz.generatedAt;
  return new Date(lastReview.getTime() + days * 86400000);
}
```

### 1.5 Quiz → Damage Formula

```
Damage = 10 × (1.0 + accuracy) × (1.0 + streak × 0.2)

accuracy = quizScore / 100  (0.0 to 1.0)
streak = consecutive correct answers in this session

Examples:
  Score 80% (a=0.8), streak 2: 10 × 1.8 × 1.4 = 25 dmg
  Score 100% (a=1.0), streak 5: 10 × 2.0 × 2.0 = 40 dmg
```

### 1.6 Auto-generation Rules

| Trigger | Condition |
|---------|-----------|
| Note created | wordCount ≥ 100 → auto-generate quiz in background |
| Note edited significantly | Re-generate (archive old quiz) |
| Manual button | Any note with ≥ 100 words |
| Too short note | < 100 words → skip, show "Write more to unlock quiz" |

### 1.7 API Endpoints

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/notes/:id/quiz/generate` | Generate quiz from note (rate limited 3/min) |
| GET | `/api/notes/:id/quiz` | Get existing quiz |
| GET | `/api/quiz/pending` | List quizzes due for review today |
| POST | `/api/quiz/:id/attempt` | Submit answers, returns score + damage |
| GET | `/api/quiz/stats` | Accuracy trend over time, total quizzes |

---

## Section 2: Boss Fight System

### 2.1 Boss Types

| Type | Spawn Trigger | HP | Reward | Visibility |
|------|--------------|-----|--------|------------|
| **Daily Minion** | Auto on first login | 50 + level×10 | 10-20 XP, 5-10 coins | Personal |
| **Weekly Elite** | Auto every Monday | 200 + level×50 | 50-100 XP, 20-40 coins, item | Personal |
| **Guild Raid** | Owner summons (100 coins) | 1000 + members×200 | 200-500 XP/ppl, rare loot, badge | Guild |
| **Custom Boss** | User creates via form | Configurable | User-set reward | Personal/Guild |

### 2.2 Damage Sources

| Action | Base Damage | Multiplier |
|--------|------------|------------|
| Write note | 5 HP | × (structureScore / 5) |
| Focus session (≥10min edit) | +5 bonus | flat |
| Quiz attempt | formula from 1.5 | — |
| Habit check-in | 3 HP | × streak bonus |
| Combo (≥2 types in a day) | ×1.5 total | — |
| Combo (3 consecutive days) | ×2.0 on day 3 | — |

### 2.3 HP Scaling

```typescript
function getBossHp(bossType: string, level: number, memberCount?: number): number {
  switch (bossType) {
    case "daily":  return 50 + level * 10;
    case "weekly": return 200 + level * 50;
    case "raid":   return 1000 + (memberCount || 1) * 200;
    default:       return 100;
  }
}
```

### 2.4 Schema Changes (extend existing Challenge)

```prisma
model Challenge {
  // Add these fields:
  bossName      String?  
  bossEmoji     String?  
  bossMaxHp     Int?     
  bossCurrentHp Int?     
  bossType      String?   // "daily" | "weekly" | "raid" | "custom"
  lootTable     Json?     // [{ itemName, dropChance }]
  // theme, difficulty, status, progress fields still used
}
```

### 2.5 Loot Table

| Rarity | Drop Rate | Examples |
|--------|-----------|----------|
| Common | 70% | Coins, "Minion Slayer" badge |
| Uncommon | 20% | Consumable (XP Booster, Focus Potion) |
| Rare | 8% | Nameplate fragment, exclusive emoji |
| Epic | 2% | "Dragon Scale" avatar frame, "Sphinx" badge |

Guild Raid: all participating members roll individually.

### 2.6 Boss Visual Themes

| theme field | Boss Name | Visual |
|-------------|-----------|--------|
| growth | "Sprout Guardian" | 🌱→🌿→🌳 as HP falls |
| journey | "Path Blocker" | 🧭 path fills |
| puzzle | "Enigma Sphinx" | 🧩 pieces assemble |
| star | "Void Stalker" | ⭐ stars light up |
| museum | "Dust Collector" | 🏛️ shelves fill |
| scholar | "Tome Guardian" | 📚 books fill |

### 2.7 Boss API Endpoints

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/boss/active` | Current active bosses |
| GET | `/api/boss/:id` | Boss detail + attack history |
| POST | `/api/boss/:id/attack` | Register damage from action |
| GET | `/api/boss/:id/loot` | Roll loot (when HP=0) |
| POST | `/api/guild/:id/boss/summon` | Summon raid boss |
| GET | `/api/guild/:id/boss` | Current guild raid boss |

### 2.8 Backward Compatibility

Existing `/api/challenges/...` endpoints remain functional. Boss spawn auto-happens via the `spawner.ts` module. Custom bosses are still created via the challenge form. Old challenges with `status: "active"` and no `bossType` continue to work as-is.

---

## Section 3: Learning Analytics

### 3.1 User Dashboard (`/analytics`)

| Component | Data | Source |
|-----------|------|--------|
| Weekly activity | notes, quizzes, boss damage, streak | Note + AuditLog |
| Quiz performance | accuracy trend across 4 review stages | QuizAttempt |
| Notes timeline | notes/day for 30 days | Note |
| Feature usage | % notes vs quiz vs boss | AuditLog |
| Boss kills | count per boss type | AuditLog |
| Learning insights | best day, best hour, top tags, most reviewed | Note + AuditLog |

### 3.2 Survey System

```prisma
model Survey {
  id          String   @id @default(uuid()) @db.Uuid
  title       String
  surveyType  String   @default("post_signup")
  questions   Json     // [{ id, text, type: "likert"|"text", required }]
  triggerDaysAfterSignup Int?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  responses   SurveyResponse[]
}

model SurveyResponse {
  id           String   @id @default(uuid()) @db.Uuid
  surveyId     String   @db.Uuid
  userId       String   @db.Uuid
  answers      Json
  overallScore Float?
  comments     String?
  completedAt  DateTime @default(now())

  survey Survey @relation(fields: [surveyId], references: [id], onDelete: Cascade)
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([surveyId, userId])
}
```

### 3.3 Survey Schedule

| Day | Survey |
|-----|--------|
| 7 | Pre-gamification baseline (experience, motivation) |
| 14 | After 1 week of boss + quiz (AI usefulness, engagement) |
| 30 | Final: SUS + NPS + retention intent |

### 3.4 Research Export (Admin)

| Route | Exports |
|-------|---------|
| `GET /api/admin/export/cohorts` | Cohort retention D7/D30 data |
| `GET /api/admin/export/quiz-data` | Quiz accuracy per review, anonymized |
| `GET /api/admin/export/surveys` | Survey aggregate scores |
| `GET /api/admin/export/daily-activity` | DAU, notes/day time series |
| `GET /api/admin/export/correlations` | Gamification vs. learning correlations |

### 3.5 Analytics API (User)

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/analytics/overview?period=week\|month` | Summary stats |
| GET | `/api/analytics/quiz-performance` | Accuracy trend |
| GET | `/api/analytics/notes-timeline?days=30` | Daily note count |
| GET | `/api/analytics/feature-usage` | Feature distribution % |
| GET | `/api/analytics/boss-kills` | Boss kill stats |
| GET | `/api/analytics/learning-insights` | Best day, tags, most reviewed |

---

## Section 4: Implementation Phases

| Phase | Content | Effort | Depends On |
|-------|---------|--------|------------|
| **P1** | AI Quiz Engine (schema, generation, attempt, spaced repetition, API) | 8h | None |
| **P2** | Boss Fight System (schema extension, spawner, damage, loot, API, UI) | 10h | P1 (quiz→damage) |
| **P3** | Learning Analytics (user dashboard, charts, API) | 8h | P1, P2 (data source) |
| **P4** | Survey System (schema, triggers, UI, API, admin export) | 6h | None |
| **P5** | Challenge→Boss Migration (backward compat, reuse existing challenge UI) | 4h | P2 |
| **P6** | UI Polish (boss fight screen, quiz panel, analytics responsive) | 4h | P1-P5 |
| | **Total** | **~40h** | |

---

## Section 5: Risks

| Risk | Mitigation |
|------|-----------|
| Gemini API costs for quiz generation | Cache quiz per content hash; generate once; rate limit 3/min |
| Quiz quality low for non-English content | Test with Vietnamese notes; adjust prompt; fallback to simple TF questions |
| Boss system too complex, user confused | Progressive disclosure: unlock bosses after level 3; tutorial on first boss |
| Survey response rate low | Incentivize: complete survey = 50 coins; show progress bar; 3 questions max |
| Analytics data not enough for thesis significance | Run for ≥30 days; target ≥30 users; use pre/post comparison |
