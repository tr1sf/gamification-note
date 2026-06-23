# TavernoteX — Project Report

> **Last Updated:** 2026-06-21  
> **Author:** Pham Dinh Minh Tri  
> **Repo:** https://github.com/tr1sf/gamification-note  
> **Production:** https://gamification-note-production.up.railway.app  
> **Stack:** SolidStart + Prisma 7 + PostgreSQL + Socket.io + Neuralwatt AI + TailwindCSS v4

---

## Executive Summary

TavernoteX is a gamified AI-powered note-taking web application with a medieval tavern theme. Users role-play as adventurers — writing notes (scrolls), completing quests, defeating bosses, joining guilds, and earning rewards. The app combines **note-taking + AI quiz generation + spaced repetition + RPG gamification** in a single platform — a unique combination not found in any existing product.

Built as a thesis project on the effectiveness of gamification in learning applications, the app features a full-stack TypeScript architecture with 30+ database models, real-time collaboration via Socket.io, ML-powered personalized quiz recommendations using SVD matrix factorization, and 450+ Vietnamese translations across 23 responsive pages.

---

## Technical Architecture

```
Frontend: SolidJS + SolidStart (SSR + SPA)
Backend:  SolidStart API routes (file-based routing)
Database: PostgreSQL 16 (dev) / Railway PostgreSQL (prod)
ORM:      Prisma 7 with PrismaPg adapter (raw SQL for atomic ops)
Realtime: Socket.io (WebSocket with JWT auth + reconnection token refresh)
AI:       Neuralwatt Cloud (OpenAI-compatible SDK)
          - Quiz generation: Kimi K2.5 (max_tokens: 4000)
          - Summarization: GLM-5.1 Fast
ML:       SVD Matrix Factorization (8 factors, 40 epochs, pure TypeScript)
Styling:  TailwindCSS v4 (@theme + CSS variables, 7 themes + light/dark)
Sound:    Web Audio API synthesized sounds (no audio files)
Testing:  Vitest (15 unit tests)
Hosting:  Railway.app (auto-deploy from GitHub)
Mascot:   Nelar — tavern cat (inline SVG, 6 states, CSS animations)
```

### Key Technical Decisions

| Decision | Rationale | File |
|----------|-----------|------|
| **SolidStart** | SSR + file-based routing, Signal-based reactivity, smaller bundle than Next.js | `app.config.ts` |
| **PostgreSQL with pg adapter** | Full-text search (tsvector + GIN), JSON columns, row-level locking (SELECT FOR UPDATE), GREATEST() for atomic updates | `prisma/schema.prisma`, `prisma/fts-setup.sql` |
| **Neuralwatt over Gemini** | OpenAI-compatible SDK, 11 models, $5 free credit, no quota throttling | `src/lib/ai/client.ts` |
| **JWT httpOnly cookies** | XSS-safe auth (access 15min + refresh 7d rotation with refresh mutex) | `src/lib/auth/jwt.ts`, `src/stores/auth.ts` |
| **SVD in pure TypeScript** | No Python dependency, runs in-process, trains in ~13ms on 1,136 attempts | `src/lib/ml/svd.ts` |
| **CSS variables via @theme** | Tailwind v4 `@theme` directive, 7 themes, dynamic switching, `color-scheme` for native controls | `src/app.css`, `src/lib/themes/defaults.ts` |
| **Web Audio API sounds** | Synthesized chimes (coin, XP, level-up, quest, achievement, boss) — zero audio file payload | `src/lib/sound.ts` |
| **Inline SVG mascot** | 6-state Nelar component, CSS-keyframe animations, themeable via CSS variables | `src/components/mascot/Nelar.tsx` |

---

## Directory Structure

```
tavernoteX/
├── prisma/
│   ├── schema.prisma              # 30+ models with relations, indexes, cascades
│   ├── migrations/
│   │   ├── 20260509102628_init/   # Initial migration (~15 tables)
│   │   └── 20260620000000_sync_schema/  # Schema sync (all 30+ models, zero drift)
│   ├── seed.ts                    # Idempotent seed (quests, cosmetics, themes, achievements)
│   └── fts-setup.sql              # FTS trigger + GIN index + backfill
├── scripts/
│   ├── evaluate-svd.ts            # Offline SVD evaluation (RMSE, MAE, coverage, A/B test)
│   ├── generate-quiz-data.ts      # Synthetic quiz data generator (30 users, 1,136 attempts)
│   ├── test-ai.ts                 # AI pipeline end-to-end test
│   ├── promote-admin.ts           # Promote user to admin role
│   └── create-demo-user.ts        # Create level 25 demo account
├── src/
│   ├── app.config.ts              # SolidStart config (node-server preset, tailwindcss vite)
│   ├── app.css                    # @theme tokens, 7 themes, dark mode, animations, focus-visible
│   ├── entry-client.tsx           # Client hydration
│   ├── entry-server.tsx           # SSR entry, font loading, meta tags
│   ├── middleware.ts              # Auth middleware (public path allowlist, JWT verification)
│   ├── routes/
│   │   ├── index.tsx              # Landing page (Nelar mascot wave)
│   │   ├── login.tsx / register.tsx / forgot-password.tsx
│   │   ├── privacy.tsx
│   │   ├── (app).tsx              # App layout shell (sidebar, header, NavItem, skip-link)
│   │   ├── (app)/
│   │   │   ├── tavern.tsx          # Tavern Hall dashboard
│   │   │   ├── notes/              # Note CRUD (index, new, [id])
│   │   │   ├── quests.tsx          # Quest board (daily/weekly/monthly tabs)
│   │   │   ├── quiz.tsx            # Quiz review + spaced repetition
│   │   │   ├── boss/               # Boss fight (active, [id])
│   │   │   ├── guilds/             # Guild system (index, [id])
│   │   │   ├── shop.tsx            # Cosmetics + themes shop
│   │   │   ├── habits.tsx          # Daily ritual tracker
│   │   │   ├── challenges/          # Challenge system (index, new, [id], public)
│   │   │   ├── minigames/potion.tsx # Potion Match game
│   │   │   ├── profile.tsx         # Character sheet + inventory + achievements
│   │   │   ├── settings/           # notifications, security, gamification, path
│   │   │   ├── analytics.tsx        # Learning analytics dashboard
│   │   │   ├── insights.tsx        # Writing pattern insights
│   │   │   ├── progress.tsx        # Progress tracking + heatmap
│   │   │   ├── ai-quests.tsx       # AI-generated personalized quests
│   │   │   ├── leaderboard.tsx    # Leaderboard
│   │   │   ├── onboarding.tsx      # 3-step onboarding wizard
│   │   │   └── admin/             # Admin dashboard + ML results
│   │   ├── api/                    # 40+ API endpoint files (see below)
│   │   └── share/[id].tsx         # Public note sharing
│   ├── components/
│   │   ├── ui/                     # Button, Modal, ConfirmModal, Toast, Breadcrumb
│   │   ├── mascot/Nelar.tsx        # 6-state inline SVG cat mascot
│   │   ├── cosmetics/              # CosmeticAvatar (avatar+frame+badge), CosmeticName
│   │   ├── gamification/            # XPBar, LevelBadge, CoinDisplay, QuestBoard, QuestCard,
│   │   │                           # RewardPopup, LevelUpModal, StreakTracker, QuestProgress,
│   │   │                           # StreakCalendar, BossDefeatOverlay, RadarChart
│   │   ├── editor/                  # BlockEditor (drag reorder, slash menu), BlockRenderer
│   │   ├── guild/                  # GuildChat, MemberList, GuildCard, CreateGuild, GuildNotes,
│   │   │                           # GuildTasks, GuildGoals
│   │   ├── shop/                   # ShopGrid, ThemePicker
│   │   ├── auth/                   # LoginForm, RegisterForm, ForgotPasswordForm
│   │   ├── profile/               # CharacterSheet, InventoryPanel, AchievementList, StatsPanel
│   │   ├── onboarding/             # OnboardingWizard (3 steps)
│   │   ├── shared/                 # NotificationBell, ErrorFallback, SearchBar
│   │   ├── mood/MoodPicker.tsx
│   │   ├── gratitude/GratitudeGarden.tsx
│   │   ├── focus/FocusTimer.tsx
│   │   ├── challenges/ChallengeCelebration.tsx
│   │   ├── survey/SurveyWidget.tsx
│   │   ├── pwa/InstallPrompt.tsx
│   │   └── notes/NotePresence.tsx
│   ├── lib/
│   │   ├── db.ts                   # Prisma client singleton (PrismaPg adapter)
│   │   ├── env.ts                  # Zod env validation (DATABASE_URL, JWT secrets, Neuralwatt)
│   │   ├── api-response.ts         # success() / error() helpers
│   │   ├── rate-limit.ts           # Token bucket rate limiter (Map-based)
│   │   ├── blocks.ts               # Block types, parser, word counter, HTML/markdown converters
│   │   ├── markdown.ts            # HTML-escape-then-transform markdown renderer (XSS-safe)
│   │   ├── time-ago.ts            # Relative time (NaN-safe)
│   │   ├── i18n.ts                 # Reactive signal-based t() (450+ EN/VI translations)
│   │   ├── path-unlocks.ts         # 3 paths × 14 features + level-gated unlocks
│   │   ├── sound.ts                # Web Audio API sound manager (10 sounds, localStorage toggle)
│   │   ├── ai/                     # client.ts (OpenAI SDK), summarize.ts
│   │   ├── analytics/              # quality-scorer.ts (0-10 structure score), tracker.ts, types.ts
│   │   ├── auth/                   # jwt.ts (sign/verify/cookies), get-user.ts, security.ts
│   │   ├── boss/                   # spawner.ts (daily/weekly), damage.ts (clamped formulas)
│   │   ├── cosmetics/equipped.ts   # getEquippedCosmetics() helper (badge/frame/nameColor)
│   │   ├── gamification/           # See GAMIFICATION-REPORT.md
│   │   ├── ml/                     # svd.ts (74-line Matrix Factorization), quiz-recommender.ts
│   │   ├── notifications/          # nudge-engine.ts (6 triggers, preference-aware)
│   │   ├── quiz/generator.ts       # AI quiz generation (max_tokens 4000, SHA-256 cache, validation)
│   │   ├── socket/                 # client.ts (singleton, token refresh, cancelled guard),
│   │   │                           # handlers.ts, index.ts (io middleware), notifications.ts
│   │   ├── themes/defaults.ts      # 7 ThemeDefinitions + applyThemeVariables/restoreThemeVariables
│   │   └── utils/                  # cn.ts (class merge), constants.ts, logger.ts
│   ├── stores/                     # SolidJS signals
│   │   ├── auth.ts                 # user, loading, authFetch (refresh mutex), logout (socket disconnect)
│   │   ├── user.ts                 # gamification state, syncFromUser, applyReward, xpProgressInLevel
│   │   ├── ui.ts                   # sidebar, theme, toasts, rewardQueue
│   │   ├── quests.ts               # quests signal, fetchActiveQuests, claimQuest
│   │   ├── guild.ts                # guilds, members, messages (with equipped cosmetics types)
│   │   ├── notifications.ts         # notifications, unreadCount, addSocketNotification
│   │   ├── tasks.ts                # Guild tasks
│   │   └── habits.ts               # Habits
│   └── validators/                 # Zod schemas
│       ├── auth.ts                 # login, register, security question, forgot password
│       ├── note.ts                 # create/update note
│       ├── guild.ts                # guild update
│       ├── habit.ts                # create/update habit (rewards server-capped, MAX 10)
│       └── task.ts                 # guild task (XP cap 20, coin cap 10)
├── tests/
│   └── unit/gamification/
│       ├── xp-calculator.test.ts   # 8 tests (diminishing returns, quality gate, spam)
│       └── level-calculator.test.ts # 7 tests (sqrt(xp/50) curve, titles)
├── public/
│   ├── manifest.json               # PWA manifest
│   ├── sw.js                       # Service worker (offline fallback)
│   └── assets/images/              # Favicon, default avatar, golden_scroll, nelar_mascot
├── app.config.ts                   # SolidStart: node-server preset, tailwindcss vite plugin
├── prisma.config.ts                # Prisma config (datasource + shadowDatabaseUrl)
├── vitest.config.ts                # Vitest config
├── tsconfig.json                   # TypeScript config (path alias ~ → /src)
└── package.json                    # Scripts: dev, build, db:migrate, db:seed, test, check
```

---

## Database Schema (30+ Models)

### Schema Migration

The project uses a 2-migration chain:
1. `20260509102628_init` — Initial schema (~15 tables)
2. `20260620000000_sync_schema` — Full schema sync (all 30+ models, relations, indexes, cascades)

`prisma migrate diff --from-migrations prisma/migrations --to-schema prisma/schema.prisma` confirms **zero drift**.

### Core Tables

| Model | Key Fields | Notes |
|-------|-----------|-------|
| **User** | id, email, username, passwordHash, level, xp, coins, streak, title, role, gamificationStyle, path, onboardingCompleted, securityQuestion, securityAnswerHash, notificationPrefs, preferredLanguage | 25+ fields, `@@index([level])` |
| **Note** | id, title, content, category, tags[], isPublic, isDeleted, wordCount, aiSummary, searchVector (tsvector via trigger) | FTS via `prisma/fts-setup.sql`, `@@index([userId, createdAt])`, `@@index([isPublic, createdAt])` |
| **AuditLog** | userId, actionType, xpChange, coinChange, metadata (JSON), levelBefore, levelAfter | Universal event tracking, powers analytics |

### Gamification Tables

| Model | Purpose |
|-------|---------|
| **Quest** | criteria (JSON), mechanic, mechanicConfig, questType (daily/weekly/monthly/chain), xpReward, coinReward |
| **UserQuest** | Composite unique [userId, questId], progress (JSON), status (active/completed/claimed/expired) |
| **Achievement** | 10 seeded achievements with auto-unlock cosmetic items |
| **UserAchievement** | unlockedAt tracking, dedup via composite unique |
| **CosmeticItem** | 15+ items: badges, frames, name colors, themes, consumables |
| **UserInventory** | userId + cosmeticItemId unique, isEquipped, quantity, expiresAt (booster activation) |
| **Challenge** | Boss fields (bossName, bossMaxHp, bossCurrentHp, bossType, lootTable), 6 themes |

### Social Tables

| Model | Purpose |
|-------|---------|
| **Guild** | name, inviteCode (unique), ownerId, isPublic, maxMembers |
| **GuildMember** | 3-tier roles (owner/admin/member), composite unique [guildId, userId] |
| **GuildMessage** | content, reactions (via separate GuildMessageReaction table) |
| **GuildMessageReaction** | Unique [messageId, userId, emoji] — atomic toggle |
| **GuildTask** | assignee, creator, status (assigned/submitted/approved), xpReward (capped 20), coinReward (capped 10) |
| **GuildGoal** | targetCount, currentCount, isCompleted, rewardXp (capped 50), rewardCoins (capped 15) |

### AI/ML Tables

| Model | Purpose |
|-------|---------|
| **Quiz** | noteId (unique), questions (JSON), reviewCount, avgScore, lastReviewedAt, generatedAt |
| **QuizAttempt** | quizId, userId, score, answers (JSON), completedAt |
| **AIQuest** | Rule-based personalized quests, expiresAt, status |

### Feature Tables

| Model | Purpose |
|-------|---------|
| **Habit** | title, icon, xpReward (fixed 5), coinReward (fixed 1), streak, bestStreak, lastCompletedOn, MAX 10 per user |
| **HabitCheckin** | Unique [habitId, date] — idempotent daily check-in |
| **Theme** | 7 themes, cssVariables (JSON), isDefault |
| **UserTheme** | isEquipped, unique [userId, themeId] |
| **Notification** | urgency (normal/urgent/critical), expiresAt, metadata (JSON) |
| **Survey** + **SurveyResponse** | Likert scale surveys, 50-coin completion reward |

---

## API Endpoints

### Auth (`api/auth/`)
| Method | Route | Purpose | Security |
|--------|-------|---------|----------|
| POST | `/register` | Register (email, username, password) | Rate limit 5/30min, Zod validation |
| POST | `/login` | Login (email OR username + password) | Rate limit 5/min (per IP) |
| POST | `/logout` | Logout + clear refresh token | Clears cookies |
| POST | `/refresh` | Refresh token rotation | Refresh mutex (dedup concurrent 401s) |
| GET | `/me` | Current user profile | JWT verify |
| POST | `/socket-token` | Issue socket JWT | Rate limit recommended |
| POST | `/nudge` | Run nudge engine (6 triggers) | Returns 200 even if unauth |
| POST | `/forgot-password/question` | Lookup security question | Rate limit 10/min, generic error |
| POST | `/forgot-password/reset` | Verify answer + reset password | Rate limit 5/min, bcrypt compare |
| GET/POST | `/security-question` | Get/set security question | bcrypt hash answer |

### Notes (`api/notes/`)
| Method | Route | Purpose | Key Logic |
|--------|-------|---------|-----------|
| GET | `/` | List notes (cursor pagination) | `take` sanitized (NaN guard) |
| POST | `/` | Create note | Triggers AI quiz gen + boss damage + quest progress + `make_public` action if public |
| GET | `/search?q=` | Full-text search | `plainto_tsquery('simple')`, fallback ILIKE, error logged |
| GET | `/[id]` | Get note (tracks review for old notes) | Includes `isDeleted: false` guard |
| PUT | `/[id]` | Update note (version check) | `make_public` XP on first public toggle |
| DELETE | `/[id]` | Soft delete + penalty check | `isDeleted` guard prevents double penalty |
| POST | `/[id]/summarize` | AI summarize (GLM-5.1 Fast) | Rate limit 10/min |
| POST | `/[id]/quiz/generate` | AI quiz gen (Kimi K2.5) | Rate limit 10/min |
| GET | `/[id]/quality` | Structure score + breakdown + suggestions | Quality scorer (0-10) |

### Guild (`api/guilds/`)
| Method | Route | Purpose | Key Logic |
|--------|-------|---------|-----------|
| GET | `/` | List public guilds | Pagination sanitized |
| GET | `/[id]` | Guild detail | Private guilds 404 for non-members |
| POST | `/[id]/join` | Join guild | inviteCode check, maxMembers atomic |
| POST | `/[id]/leave` | Leave guild | Ownership transfer or delete; emits `guild:role-changed` |
| GET | `/[id]/members` | List members + equipped cosmetics | Membership check for private guilds |
| GET/POST | `/[id]/messages` | Chat messages + cosmetics + avatarUrl | `mapMessage()` typed, pagination sanitized |
| POST | `/[id]/messages/[messageId]/react` | Toggle reaction | Atomic `deleteMany + create` in transaction |
| GET | `/[id]/goals` | List goals | Membership check |
| PATCH | `/[id]/goals` | Contribute to goal | Atomic `updateMany` prevents double-payout |
| POST | `/[id]/goals` | Create goal | Rewards capped (50 XP / 15 coins) |

### Quiz (`api/quiz/`)
| Method | Route | Purpose | Key Logic |
|--------|-------|---------|-----------|
| GET | `/pending` | Due quizzes | Adaptive interval (`getAdaptiveInterval`), A/B test split (FNV-1a hash) |
| POST | `/[id]/attempt` | Submit answers | 0-question guard, `grantReward` with fixed 5 XP (not `create_note`), boss damage with clamped quizStreak |
| POST | `/[id]/feedback` | 👍/👎 quality signal | Validates rating |
| POST | `/difficulty` | SVD prediction for single quiz | Cold-start fallback (100 - avgScore or 50) |
| POST | `/difficulty-batch` | Batch SVD predictions | Max 20 quizzes |
| GET | `/stats` | Quiz accuracy by review stage | N+1 warning (known) |

### Boss (`api/boss/`)
| Method | Route | Purpose | Key Logic |
|--------|-------|---------|-----------|
| GET | `/active` | Active daily/weekly bosses | — |
| GET | `/[id]` | Boss detail + battle log | — |
| POST | `/[id]/attack` | Attack boss | Input validation (actionType enum, clamped params), rate limit 1/30s, combo multiplier server-side |
| POST | `/[id]/loot` | Claim loot (POST, not GET) | Atomic `updateMany` guard, normalized `type`/`itemType`, always grants base reward |

### Shop & Inventory
| Method | Route | Purpose | Key Logic |
|--------|-------|---------|-----------|
| GET | `/shop/` | List shop items | — |
| POST | `/shop/[itemId]/purchase` | Buy item | Atomic `updateMany({coins: {gte: cost}})` prevents double-spend, P2002 catch for already-owned |
| POST | `/inventory/[id]/equip` | Equip cosmetic | Unequip same-type first |
| POST | `/inventory/[id]/open` | Open loot box | Random cosmetic (non-consumable) |
| POST | `/inventory/[id]/activate` | Activate booster (XP Boost / Focus Potion) | Sets `expiresAt`, engine checks via `checkActiveBooster()` |

### User Settings
| Method | Route | Purpose |
|--------|-------|---------|
| PATCH | `/users/gamification-style` | Change gamification style (5 options, Zod validated) |
| PATCH | `/users/path` | Change path (student/professional/journaler, Zod validated) |
| PATCH | `/users/notification-prefs` | Update notification preferences JSON |
| PUT | `/users/theme` | Buy/equip theme |
| PUT | `/users/language` | Update preferred language |

---

## Gamification Engine

### Pipeline — `src/lib/gamification/engine.ts`

```
processAction(userId, actionType, metadata)
  │
  ├── checkActiveBooster(tx, userId, "focus_potion")  ← 2× word bonus
  ├── calculateXP(ctx, dailyNoteCount)                ← diminishing returns
  ├── checkActiveBooster(tx, userId, "xp_boost")       ← 2× all XP
  ├── SELECT ... FOR UPDATE (lock user row)
  ├── UPDATE user (xp, coins, level, title)
  ├── INSERT AuditLog (actionType, xpChange, metadata)
  ├── rotateQuestsIfNeeded (daily/weekly/monthly, adaptive weighted)
  ├── checkQuestProgress (7 mechanical types)
  ├── checkAchievements (criteria-based unlock, auto-grant cosmetics)
  └── triggerNotifications (Socket.io push, fire-and-forget)
```

### Anti-Exploitation (12 layers)

| # | Layer | File | Mechanism |
|---|-------|------|-----------|
| 1 | Diminishing returns | `xp-calculator.ts` | XP/note: 10→7→5→3→1→0 per daily count |
| 2 | Quality gate | `xp-calculator.ts` | `structureScore < 3` → 0 XP |
| 3 | Duplicate detection | `notes/index.ts` | Jaccard similarity ≥ 0.8 → 0 XP |
| 4 | Delete penalty | `notes/[id].ts` | -5 XP for quick-deleting short notes; `isDeleted` guard prevents double penalty |
| 5 | Row locking | `engine.ts` | `SELECT ... FOR UPDATE` in `$transaction` |
| 6 | Atomic quest claim | `quests/[id]/claim.ts` | `updateMany` with `status: "completed"` → `"claimed"` guard |
| 7 | Boss HP atomic | `boss/[id]/attack.ts` | `$executeRaw` with `GREATEST(0, hp - dmg)` |
| 8 | Server-side combo | `boss/[id]/attack.ts` | Combo multiplier from AuditLog count, not client |
| 9 | Attack cooldown | `boss/[id]/attack.ts` | Rate limit 1 attack per 30s per boss |
| 10 | Boss damage clamps | `boss/damage.ts` | `quizAccuracy` [0,1], `quizStreak` [0,20], `habitStreak` [0,50], global cap 200 |
| 11 | Habit reward cap | `validators/habit.ts` | Server-fixed: 5 XP / 1 coin per check-in, max 10 habits, 1 check-in/day |
| 12 | Guild reward caps | `validators/task.ts`, `goals/index.ts` | Task: 20 XP/10 coins max; Goals: 50 XP/15 coins max |
| + | Shop double-spend | `shop/[itemId]/purchase.ts` | Atomic `updateMany({coins: {gte: cost}})` + P2002 catch |
| + | Onboarding idempotency | `onboarding/complete.ts` | Check `onboardingCompleted` before granting 50-coin reward |
| + | Minigame rate limit | `minigames/potion/complete.ts` | 10 completions/min, all inputs clamped |
| + | Coin double-spend (shop) | `shop/[itemId]/purchase.ts` | Conditional `updateMany` instead of read-then-decrement |
| + | Guild goal double-payout | `guilds/[id]/goals/index.ts` | Conditional `updateMany({isCompleted: false})` — only first caller grants rewards |

### Level Formula — Updated

```
Level = max(1, floor(sqrt(xp / 50)))
```

| Level | XP Required | ~Notes needed |
|-------|------------|---------------|
| 1 | 0 | Start |
| 2 | 200 | ~2 notes + login |
| 3 | 450 | ~5 notes |
| 4 | 800 | ~8 notes |
| 5 | 1,250 | ~13 notes |
| 10 | 5,000 | — |
| 20 | 20,000 | — |

Previous formula `sqrt(xp/100)` required 400 XP for Level 2 — too steep for day 1.

### Adaptive Quest Selection — `quest-rotation.ts`

Quests are no longer pure random. Weighted by:
- **Path boosts**: Student → `create_note`, `ai_summarize`, `make_public` (+0.5 weight)
- **Style boosts**: Competitive → `create_note`, `make_public` (+0.3 weight)
- **Base weight**: 1.0 for all quests
- Weighted random selection replaces biased `sort(() => Math.random() - 0.5)`

---

## ML: SVD Quiz Difficulty Prediction

### Model — `src/lib/ml/svd.ts` (74 lines)

- **Algorithm**: SVD Matrix Factorization (from scratch, pure TypeScript)
- **Parameters**: 8 latent factors, 40 epochs, learning rate 0.01, L2 regularization 0.02
- **Training**: Stochastic gradient descent on userId × quizId × score matrix
- **Retraining**: Every 30 minutes (in-memory cache), min 10 attempts required
- **Training time**: ~13ms on 1,136 attempts
- **Cold-start fallback**: If no SVD factors for user/quiz → `100 - avgScore` or 50 (neutral)

### Recommender — `src/lib/ml/quiz-recommender.ts`

- `predictDifficulty(userId, quizId)` — SVD prediction with cold-start fallback
- `getRecommendedQuizzes(userId)` — Priority ordering: `difficultyMatch × 0.7 + urgency × 0.3`
- `getAdaptiveInterval(baseDays, lastAccuracy)` — Bjork 1994 desirable difficulty
  - ≥ 85% accuracy → interval × 1.5
  - 60-84% → unchanged
  - < 60% → interval × 0.6
- `getExperimentGroup(userId)` — FNV-1a hash → deterministic control/personalized split

### Evaluation Results — `scripts/evaluate-svd.ts`

| Metric | SVD | Baseline | Improvement |
|--------|-----|----------|-------------|
| **RMSE** | 14.81 | 18.53 | **20.1%** |
| **MAE** | 12.09 | 16.10 | 24.9% |

| Metric | Value |
|--------|-------|
| Dataset | 1,136 attempts, 31 users, 454 quizzes |
| Train/Test split | 921 / 215 (80/20 stratified by user) |
| Personalized predictions | 157/215 (73.0%) |
| Cold-start fallback | 58/215 (27.0%) |

### A/B Test Framework

- **Split**: FNV-1a hash → deterministic, cross-session stable
- **Control group**: Fixed-interval quiz ordering (0/3/7/30 days)
- **Personalized group**: SVD priority-ordered quizzes + adaptive intervals
- **Metrics**: Avg score, accuracy improvement across reviews (first → last attempt)
- **Dashboard**: `/admin/ml-results`

### Synthetic Data — `scripts/generate-quiz-data.ts`

- 30 demo users (`demo_ml_user0` — `demo_ml_user29`)
- 450 quizzes (15 per user, from 5 note templates)
- 1,136 quiz attempts with realistic distributions:
  - User skill levels: 0.3–0.9 (some strong, some weak)
  - Forgetting curve: +5-15% accuracy improvement per review
  - Random noise: ±10%
- Re-run script to clear + regenerate
- Demo users excluded from leaderboard via username prefix filter

---

## AI Integration

### Quiz Generation — `src/lib/quiz/generator.ts`

```
Note ≥ 100 words
  → content.slice(0, 3000) → Neuralwatt (Kimi K2.5, max_tokens 4000)
  → cleanJsonResponse() (removes code fences, extracts JSON array)
  → validateQuestion() per question (4 options, correctIndex 0-3, difficulty)
  → SHA-256 cache (content.slice(0, 500), 200 entries max)
  → Auto-generation on note create (fire-and-forget)
  → Manual regeneration via API
  → Quality feedback (👍/👎 buttons)
  → Empty response logging (finish_reason, token usage)
```

### Summarization — `src/lib/ai/summarize.ts`

- Model: GLM-5.1 Fast
- Rate limited: 10/min per user
- Min 30 words, truncated to 6000 chars for token safety
- Returns 3-5 bullet points

### AI Client — `src/lib/ai/client.ts`

```typescript
new OpenAI({
  baseURL: env.NEURALWATT_BASE_URL || "https://api.neuralwatt.com/v1",
  apiKey: env.NEURALWATT_API_KEY,
});
// QUIZ_MODEL = "kimi-k2.5" (262K context, JSON mode)
// SUMMARIZE_MODEL = "glm-5.1-fast"
```

---

## Personalization System

### Path System — Changeable

| Path | Early Unlocks | Quest Weight Boosts | Tavern Hall Widget |
|------|---------------|--------------------|--------------------|
| Student | AI Quiz Lv.4, Boss Lv.7 | `create_note`, `ai_summarize`, `make_public` | Active Bosses + Pending Quizzes |
| Professional | AI Summarize Lv.4, Guilds Lv.10 | `ai_summarize`, `add_link`, `make_public` | Smart Inbox + Focus Timer |
| Journaler | Daily Prompts Lv.3, Themes Lv.6 | `create_note`, `write_words`, `structured_note` | Mood Picker + Gratitude Garden |

- Change in **Settings → Your Path** (`/settings/path`)
- API: `PATCH /api/users/path` (Zod validated)
- Onboarding: Step 2 (was step 2 of 5, now step 2 of 3)

### Gamification Styles — Now Actually Work

| Style | Sidebar | Header | Nav Hidden |
|-------|---------|--------|------------|
| Adventurer (competitive) | Full + style badge | Full + red style badge | — |
| Balanced | Full | Full | — |
| Collaborator | Full + green badge | Full | — |
| Solo Scholar | Guilds hidden | Full + gray badge | Guilds |
| Minimalist | Only Tavern, Notes, Quests, Profile | Only NotificationBell + Sound + Theme + gray badge | Boss, Minigames, Shop, Analytics, Insights, Guilds |

- Change in **Settings → Gamification Style** (`/settings/gamification`)
- API: `PATCH /api/users/gamification-style` (Zod validated)

### Onboarding — Simplified to 3 Steps

```
Step 0: Language (EN/VI)
Step 1: Path (Student/Professional/Journaler)
Step 2: First Quest (write note → view profile → claim welcome gift)
```

Removed: Privacy consent step (privacy policy accessible from footer), Motivation step (gamification style can be changed later in Settings).

---

## Accessibility & UX

### A11y Features

| Feature | Implementation |
|---------|---------------|
| Skip-to-content link | `.skip-link` class, hidden until focus, `#main-content` target |
| Focus trap | `Modal.tsx` — Tab/Shift+Tab cycling, Escape to dismiss, body scroll lock, focus restoration |
| Global focus-visible | `button:focus-visible`, `a:focus-visible`, `[role=button]:focus-visible` in `app.css` |
| `color-scheme: dark` | Native scrollbars, form controls match dark theme |
| `--color-ink-tertiary` token | WCAG AA 4.5:1 compliant text tier (replaces `/50`, `/60`, `/30`, `/40` opacity modifiers) |
| Drag handle keyboard | `role="button" tabIndex={0}`, ArrowUp/ArrowDown to reorder blocks |
| Quiz cards as `<button>` | WAS `<div onClick>`, now semantic button with `aria-label` |
| Guild chat `aria-live` | `aria-live="polite" aria-relevant="additions"` on message container |
| Reaction buttons | `aria-pressed` toggle state + `aria-label` |
| Notion presence | `oncleanup` guard prevents listener leak when socket is null |

### UX Features

| Feature | File | Description |
|---------|------|-------------|
| Sound effects | `src/lib/sound.ts` | Web Audio API (coin, XP, level-up, quest, achievement, boss hit/defeat, quiz correct/wrong, error). Toggle 🔊/🔇 persisted |
| Mascot Nelar | `src/components/mascot/Nelar.tsx` | 6 states (idle, sleeping, happy, curious, worried, wave), CSS animations, themeable via CSS variables |
| Streak Calendar | `StreakCalendar.tsx` | 7-day visual, milestone labels (🌙 → 🔥), progress bar to next milestone |
| Boss Defeat Overlay | `BossDefeatOverlay.tsx` | Full-screen flash + boss emoji + reward display |
| Boss celebration sound | `sound.ts` | Victory fanfare on boss death |
| Auto dark mode | `(app).tsx` | `matchMedia("(prefers-color-scheme: dark)")` on first visit |
| Note Quality Score | `notes/[id].tsx` | 0-10 score + breakdown chips + improvement suggestions |
| Reactive i18n | `i18n.ts` | `createSignal`-based `t()`, no `window.location.reload()` needed |
| Logout cleanup | `auth.ts` | Disconnects socket, resets i18n to EN, clears theme localStorage |

---

## Internationalization (i18n)

### Implementation — `src/lib/i18n.ts`

- **Reactive**: `t()` reads `langSignal()` → every consumer re-renders on language change
- **No reload needed**: `applyLanguage(lang)` calls `setLangSignal(lang)` → instant update
- **450+ translations** across all pages (notes, quiz, boss, guild, settings, gamification, etc.)
- **Logout resets to EN**: `applyLanguage("en")` called in `logout()` → login/register pages always EN

### Coverage

| Area | Status |
|------|--------|
| Sidebar + header | ✅ Fully translated |
| Tavern Hall | ✅ Fully translated |
| Notes (index, new, [id]) | ✅ View mode translated |
| Quiz | ✅ Fully translated |
| Boss | ✅ Fully translated |
| Guild (chat, members, goals, tasks, notes, card, create) | ✅ Fully translated |
| Habits | ✅ Fully translated |
| Settings (notifications, security, gamification, path) | ✅ Fully translated |
| Shop | ✅ Fully translated |
| Progress/Insights/Analytics | ✅ Fully translated |
| Challenges | ✅ Fully translated |
| Minigames | ✅ Fully translated |
| AI Quests | ✅ Fully translated |
| Onboarding | ✅ Fully translated |
| Sound/mascot UI | ✅ Fully translated |
| Note edit mode | ⚠️ Partially translated |

---

## Security

| Layer | Implementation |
|-------|---------------|
| Auth | JWT httpOnly cookies (access 15min + refresh 7d rotation), refresh mutex prevents concurrent 401 storm, `disconnectSocket()` on logout |
| Password | bcryptjs hash (cost 12) |
| Security question | bcrypt hash of normalized answer, generic error (no existence leak) |
| Rate limiting | Token bucket: login 5/min, register 5/30min, AI 10/min, boss attack 1/30s, minigame 10/min |
| Admin routes | `role === "admin"` check on all admin endpoints |
| CORS | Socket.io validated origins (CLIENT_URL + Tauri origins) |
| Input validation | Zod schemas on all mutation endpoints |
| SQL injection | Prisma parameterized queries; raw SQL uses `$queryRaw`/`$executeRaw` with tagged templates |
| XSS | Block editor sanitizes content; markdown renders with HTML-escape-then-transform; URLs sanitized (no `javascript:`) |
| Cookie flags | HttpOnly, Secure (production), SameSite=Lax (access), Path=/api/auth (refresh) |
| Private guild protection | Non-members get 404 (not 403) on private guilds |
| Boss attack input | actionType enum-validated; structureScore/quizAccuracy/quizStreak/habitStreak all clamped |
| Shop double-spend | Atomic `updateMany({coins: {gte: cost}})` — no TOCTOU window |
| Guild goal double-payout | Conditional `updateMany({isCompleted: false})` — only first caller grants rewards |
| Onboarding farming | `onboardingCompleted` check before granting 50-coin reward |
| Minigame farming | All client inputs clamped, rate limited, `grantReward` always called |
| Note delete double-penalty | `isDeleted: false` guard in findUnique |
| Socket identity leak | `disconnectSocket()` on logout prevents stale JWT on socket |
| `crypto.randomUUID()` | Fallback `uuid()` for non-secure contexts (HTTP non-localhost) |

---

## Testing

### Unit Tests (Vitest) — 15 tests, all passing

- `tests/unit/gamification/xp-calculator.test.ts` — 8 tests
  - Base XP, diminishing returns, quality gate, spam detection
- `tests/unit/gamification/level-calculator.test.ts` — 7 tests
  - `sqrt(xp/50)` curve: Lv2 @ 200 XP, Lv3 @ 450, Lv5 @ 1250, monotonic scaling, titles

### ML Evaluation Script

- `scripts/evaluate-svd.ts` — Offline evaluation (RMSE, MAE, coverage, cold-start, A/B test)
- Run: `npx tsx scripts/evaluate-svd.ts`

### Synthetic Data Generator

- `scripts/generate-quiz-data.ts` — 30 users, 450 quizzes, 1,136 attempts
- Run: `npx tsx scripts/generate-quiz-data.ts` (re-run to clear + regenerate)

### AI Test Script

- `scripts/test-ai.ts` — Tests login → create note → summarize → quiz generate

---

## Deployment

### Production (Railway)

- **URL:** https://gamification-note-production.up.railway.app
- **Auto-deploy:** on `git push origin main`
- **PostgreSQL:** Railway addon with automatic `DATABASE_URL`
- **Socket server:** Standalone (port 3001) or integrated
- **Migrations:** `prisma migrate deploy` + `prisma db execute --file prisma/fts-setup.sql`

### Database Commands

```bash
# Local dev
pnpm dev                    # Start dev server → http://localhost:3000
npx prisma db push          # Sync schema (dev)
npx prisma db seed          # Seed data
npx prisma db execute --file prisma/fts-setup.sql  # FTS setup

# Production deploy
npm run db:migrate:prod     # prisma migrate deploy + FTS setup
npm run db:seed:prod        # prisma db seed

# ML
npx tsx scripts/generate-quiz-data.ts    # Generate synthetic data
npx tsx scripts/evaluate-svd.ts          # Evaluate SVD model

# Testing
npx vitest run              # Run tests
npx tsc --noEmit            # Typecheck
npm run check               # Both
```

---

## Feature Status

### ✅ Complete

| Feature | Description |
|---------|-------------|
| Auth | JWT httpOnly, refresh rotation, security question recovery, forgot password |
| Note CRUD | Block editor + markdown, FTS search, soft delete, duplicate detection, quality scoring |
| AI Quiz | Kimi K2.5 (max_tokens 4000), SHA-256 cache, JSON validation, fire-and-forget |
| AI Summarize | GLM-5.1 Fast, rate limited, token-safe truncation |
| Spaced Repetition | 0/3/7/30 day intervals + adaptive (Bjork 1994), wired into pending endpoint |
| Boss Fight | Daily/weekly spawn, clamped damage, atomic HP, loot with proper dispatch |
| Quest System | 7 mechanics, 27 quests, adaptive weighted selection, chains |
| Achievement System | 10 achievements, auto-unlock cosmetics |
| Guild System | Real-time chat (Socket.io), reactions, tasks, goals, notes sharing |
| Shop | Atomic coin spending, cosmetics, themes, consumables |
| Multi-Theme | 7 themes, light/dark, `color-scheme: dark`, equipped in both modes |
| PWA | Installable, service worker, offline fallback |
| Admin Dashboard | Retention cohorts, quiz stats, ML results, daily activity |
| Notifications | Socket.io real-time, nudge engine (6 triggers, preference-aware) |
| Habits | Daily tracker, server-fixed rewards (5 XP/1 coin), max 10 habits |
| Challenges | CRUD, 6 themes, celebration component, public gallery |
| Minigame | Potion Match (rate limited, inputs clamped) |
| Survey System | Likert scale, 50-coin reward |
| i18n | 450+ translations, reactive signal, fully covers all pages |
| Unit Tests | 15 tests (XP + level calculators) |
| SEO | Meta tags, OG/Twitter cards, sitemap, robots.txt |
| Mobile Responsive | 23 pages, tailwind breakpoints |
| Path System | 3 paths, changeable in settings, adaptive quest weights |
| Gamification Styles | 5 styles, all change UI (competitive/collaborative/solo/minimal/balanced) |
| Mascot Nelar | 6 states, inline SVG, CSS animations, themeable |
| Sound Effects | Web Audio API, 10 sounds, localStorage toggle |
| ML SVD | Trained model, cold-start fallback, evaluation script (RMSE 14.81) |
| Quality Insights | Note score 0-10 + breakdown + improvement suggestions |
| Streak Calendar | 7-day visual, milestones, progress bar |
| Boss Defeat Overlay | Full-screen celebration |
| Security Question | Set/get/update, bcrypt hashed |
| Forgot Password | Security question flow, rate limited |
| Migration Sync | 30+ models, zero drift, `prisma migrate deploy` works on fresh DB |
| Focus Potion Activation | API endpoint + InventoryPanel button + engine booster check |
| Quest Reroll | Replace active quest with new random |

### ⚠️ Partially Complete

| Feature | Status |
|---------|--------|
| E2E tests | Not built (only 15 unit tests) |
| Email verification | Deferred (security question works as alternative) |
| Tauri desktop app | Needs Rust toolchain |
| Note edit mode i18n | View mode fully translated, edit mode partially |
| QuestProgress sidebar | Works but may show 0 quests if rotation hasn't run yet |

### ❌ Not Built

| Feature | Reason |
|---------|--------|
| Cross-platform native apps (Tauri) | Needs Rust toolchain |
| E2E tests (Playwright) | Deferred |
| Additional integration tests | Only gamification engine covered |

---

## Onboarding Flow — Simplified

```
Landing Page → Register → Auto-login → Onboarding (3 steps)
  Step 0: Language (EN/VI)
  Step 1: Path (Student/Professional/Journaler)
  Step 2: First Quest (write note → view profile → claim welcome gift)

After Onboarding → Tavern Hall (path-specific widgets + Nelar mascot)
  Daily loop: Write Notes → Auto Quiz Generate → Complete Quests → Attack Boss → Claim Loot
  Social: Join Guild → Chat + Reactions → Share Notes → Complete Tasks → Guild Goals
  Progress: Level up → Unlock features → Customize (themes/cosmetics) → Change path/style
```

---

## Next Steps (Priority Order)

1. **Real user testing** — Deploy, get 5-10 users, iterate
2. **E2E tests** — Playwright for onboarding → note → quiz → boss flow
3. **Email verification** — Registration confirmation
4. **Expand test coverage** — Integration tests for API routes
5. **Tauri desktop app** — Install Rust toolchain
6. **Redis** — Socket.io adapter, rate limiting, session store for multi-instance
7. **SM-2 spaced repetition** — Upgrade from fixed intervals to dynamic E-Factor
8. **AI quiz quality review** — Teacher/admin workflow for flagging bad questions
