# Phase 2 — Gamification: Engine + Quests + XP + Coins + Level

**Status:** Pending | **Priority:** P0 | **Effort:** 30h | **Blocks:** Phase 3 | **Blocked by:** Phase 1

## Overview

Implement the gamification layer. Users earn XP and coins for taking notes,
completing quests, and maintaining streaks. They level up, unlock achievements,
buy cosmetic items, and see their progress visualized.

## Key Insights

- Engine must be event-driven: action completes → calculator (pure) → applier (DB tx + FOR UPDATE) → AuditLog
- Always accept `Prisma.TransactionClient` so engine can compose within larger transactions
- `SELECT ... FOR UPDATE` row lock prevents race conditions on concurrent XP/coin updates
- AuditLog every XP/coin change — critical for debugging disputes
- Daily quests need cron rotation (or app-level check on login)
- Level formula: `level = floor(sqrt(xp / 100))` — simple, predictable
- Cosmetic shop uses coins (earned through quests, NOT purchasable)

## Requirements

### Functional
- **XP System**: Earn XP for notes created (10 XP), words written (1 XP/100 words), notes made public (5 XP), quests completed (variable)
- **Level System**: Level = floor(sqrt(xp / 100)). Level-up triggers LevelUpModal + notification
- **Coin System**: Earn coins through quests (5-50 coins). Spend on cosmetic items in shop
- **Quest System**: Daily quests (rotate at midnight), weekly quests. Track progress, claim on completion
- **Achievement System**: Unlock achievements for milestones (first note, 50 notes, 7-day streak, etc.)
- **Cosmetic Shop**: Purchase avatar frames, name colors, badges, themes with coins
- **Streak Tracking**: Daily login streak. Visualized as calendar heatmap
- **Reward Popup**: Animated popup when earning XP/coins/achievements
- **Level-Up Celebration**: Full-screen modal with confetti on level up
- **Quest Board UI**: Active quests with progress bars, available quests, history
- **Inventory UI**: Equip/unequip cosmetic items on profile

### Non-functional
- Gamification engine runs atomically within parent transaction
- No XP/coin duplication (idempotency on quest claim)
- AuditLog retention: 90 days
- Quest rotation: app-level check on user login/action (no cron dependency for MVP)

## Architecture

### Gamification Engine (`lib/gamification/engine.ts`)

```typescript
import { Prisma } from '@prisma/client';

interface ActionContext {
  tx: Prisma.TransactionClient;
  userId: string;
  actionType: 'create_note' | 'update_note' | 'delete_note' | 'make_public' | 'daily_login' | 'complete_quest';
  metadata?: Record<string, unknown>;
}

interface ActionResult {
  xpGained: number;
  coinsGained: number;
  leveledUp: boolean;
  newLevel?: number;
  unlockedAchievements: { id: string; title: string }[];
  questProgress: { questId: string; progress: number; target: number; completed: boolean }[];
}

export async function processAction(ctx: ActionContext): Promise<ActionResult> {
  const { tx, userId, actionType, metadata } = ctx;

  // 1. Lock user row to prevent concurrent updates
  const [user] = await tx.$queryRaw<[{ xp: number; coins: number; level: number }]>`
    SELECT xp, coins, level FROM "User" WHERE id = ${userId}::uuid FOR UPDATE
  `;

  // 2. Calculate rewards (pure functions, no DB)
  const xpGained = calculateXP(actionType, metadata);
  const coinsGained = calculateCoins(actionType, metadata);

  // 3. Apply rewards atomically
  await tx.user.update({
    where: { id: userId },
    data: { xp: { increment: xpGained }, coins: { increment: coinsGained } },
  });

  // 4. Check level-up
  const newLevel = calculateLevel(user.xp + xpGained);
  if (newLevel > user.level) {
    await tx.user.update({ where: { id: userId }, data: { level: newLevel } });
  }

  // 5. AuditLog
  await tx.auditLog.create({
    data: {
      userId, actionType,
      xpChange: xpGained, coinChange: coinsGained,
      metadata: metadata as Prisma.InputJsonValue,
    },
  });

  // 6. Check quest progress
  const questResults = await checkQuestProgress(tx, userId, actionType, metadata);

  // 7. Check achievements
  const newAchievements = await checkAchievements(tx, userId, actionType, metadata);

  return {
    xpGained,
    coinsGained,
    leveledUp: newLevel > user.level,
    newLevel: newLevel > user.level ? newLevel : undefined,
    unlockedAchievements: newAchievements,
    questProgress: questResults,
  };
}
```

### Engine File Structure
```
lib/gamification/
├── engine.ts              # Orchestrator
├── calculators/
│   ├── xp-calculator.ts   # create_note=10, write_words=1/100w, make_public=5, daily_login=5
│   ├── coin-calculator.ts # quest_complete=varies (from quest definition)
│   └── level-calculator.ts # level = floor(sqrt(xp / 100))
├── quests/
│   ├── quest-checker.ts   # Does action progress any active quest?
│   ├── daily-quests.ts    # Daily quest definitions + rotation
│   └── weekly-quests.ts   # Weekly quest definitions
├── achievements/
│   ├── achievement-checker.ts # Check all achievement criteria
│   └── definitions.ts     # Achievement data (title, criteria, xpReward)
└── constants.ts           # All XP/Coin values in one place
```

### XP Formula
```
create_note:     10 XP
write_words:     1 XP per 100 words (capped at 50 XP/note)
make_public:     5 XP
daily_login:     5 XP (once per day)
complete_quest:  quest.xpReward (variable, 15-150 XP)
daily_streak:    5 * streak_days (bonus on login)
unlock_achievement: achievement.xpReward
```

### Level Formula
```
Level = floor(sqrt(xp / 100))

Level 1:   0 XP
Level 2:   100 XP   (10 notes)
Level 5:   2,500 XP
Level 10:  10,000 XP
Level 20:  40,000 XP
Level 50:  250,000 XP
```

### Quest Rotation (app-level, no cron)

On user action or login:
1. Query user's active daily quests
2. Check if `UserQuest.createdAt` is from today
3. If not: expire old daily quests, assign 3 new random daily quests
4. Same for weekly quests

### API Endpoints (Phase 2 additions)

```
GET    /api/quests              → all available quests (daily + weekly)
GET    /api/quests/active       → user's active quests with progress
GET    /api/quests/[id]         → single quest detail
POST   /api/quests/[id]/claim   → claim completed quest reward (idempotent)

GET    /api/shop                → all purchasable cosmetic items
POST   /api/shop/[itemId]/purchase → buy item (check coin balance, prevent re-purchase)

GET    /api/stats/dashboard     → user stats (total notes, words, streak, XP history)
```

### Integration Points

After each note action in API routes, call engine:
```typescript
// In api/notes/index.ts POST handler
const note = await prisma.note.create({ data: { ...parsed.data, userId: locals.user.userId } });

// Process gamification within same transaction context (pseudo-code for SolidStart)
const result = await processAction({
  tx: prisma,  // Use prisma.$transaction wrapper in production
  userId: locals.user.userId,
  actionType: 'create_note',
  metadata: { noteId: note.id, wordCount: note.content.split(/\s+/).length },
});

return success({ note, gamification: result });
```

## Component Tree (Phase 2 additions)

```
components/
├── gamification/
│   ├── XPBar.tsx              # Header XP bar with progress
│   ├── LevelBadge.tsx         # "Lv. 5 Scribe" chip
│   ├── CoinDisplay.tsx        # Coin icon + amount (aria-live for changes)
│   ├── QuestBoard.tsx         # Full quest listing page
│   ├── QuestCard.tsx          # Single quest with progress bar
│   ├── QuestProgress.tsx      # Mini indicator in sidebar
│   ├── RewardPopup.tsx        # Animated toast: "+10 XP, +5 Coins"
│   ├── LevelUpModal.tsx       # Full-screen celebration
│   ├── DailyStreak.tsx        # Calendar heatmap
│   └── StreakTracker.tsx      # Simple counter in header
├── profile/
│   ├── CharacterSheet.tsx     # RPG-style stat display
│   ├── StatsPanel.tsx         # Notes/words/streak/level stats
│   ├── AchievementList.tsx    # Grid of achievement badges
│   └── InventoryPanel.tsx     # Equip/unequip cosmetic items
└── shop/
    └── ShopGrid.tsx           # Cosmetic items for purchase
```

## Stores (Phase 2 additions)

```
stores/
├── user.ts    # Extended: { xp, coins, level, streak, inventory[], achievements[] }
└── quests.ts  # { active[], available[], history[], loading }
```

## Implementation Steps

### Step 2.1: Gamification Engine Core
- `calculators/xp-calculator.ts`: XP calculation table
- `calculators/coin-calculator.ts`: Coin earning rules
- `calculators/level-calculator.ts`: Level formula + thresholds
- `engine.ts`: Orchestrator with `processAction()`

### Step 2.2: Audit Log
- Wire AuditLog writes into engine
- `GET /api/stats/dashboard`: aggregate stats from AuditLog

### Step 2.3: Quest System
- Load daily/weekly quests from DB (seed data)
- `quests/quest-checker.ts`: match action → quest criteria → update progress
- Rotation logic: expire stale quests, assign new on login
- API: list, active, detail, claim

### Step 2.4: Achievement System
- `achievements/definitions.ts`: all achievement criteria
- `achievements/achievement-checker.ts`: check all on each action
- API: user's unlocked achievements (from UserAchievement table)

### Step 2.5: XP/Level/Coin UI
- `XPBar.tsx` in Header (ARIA progressbar role)
- `LevelBadge.tsx`: "Lv. X [Title]"
- `CoinDisplay.tsx`: coin count with aria-live
- `stores/user.ts`: sync from API, update optimistically

### Step 2.6: Quest Board UI
- `/quests` route page with `QuestBoard.tsx`
- `QuestCard.tsx`: title, description, progress bar, XP/coin reward, claim button
- `QuestProgress.tsx`: mini widget in sidebar

### Step 2.7: Reward Popup + Level Up
- `RewardPopup.tsx`: animated toast (slide in from top-right, auto-dismiss 3s)
- `LevelUpModal.tsx`: full-screen overlay with confetti, new level announcement
- Triggered by gamification result from API responses

### Step 2.8: Streak Tracking
- `useStreak` hook: track login days from AuditLog
- `DailyStreak.tsx`: calendar heatmap on profile
- `StreakTracker.tsx`: "🔥 5-day streak" in header

### Step 2.9: Cosmetic Shop + Inventory
- `/shop` route: `ShopGrid.tsx` with items (name, rarity, cost, preview)
- Purchase endpoint: check balance, prevent re-purchase, add to inventory
- `InventoryPanel.tsx` on profile: list owned items, equip/unequip
- `UserInventory` table: tracks ownership + equipped state

### Step 2.10: Character Sheet + Stats
- `/profile` route: `CharacterSheet.tsx` (avatar, level, title, XP, coins, guild)
- `StatsPanel.tsx`: total notes, words, streak, achievements count, quests completed

## Todo List

- [ ] Gamification engine (calculator + applier + AuditLog)
- [ ] XP/Level/Coin calculation formulas
- [ ] Quest system (daily + weekly, rotation, progress, claim)
- [ ] Achievement system (definitions, checker, unlock)
- [ ] XPBar + LevelBadge + CoinDisplay in Header
- [ ] Quest board page with QuestCard + progress bars
- [ ] QuestProgress mini widget in sidebar
- [ ] RewardPopup (animated toast)
- [ ] LevelUpModal (full-screen celebration)
- [ ] Streak tracking + DailyStreak heatmap
- [ ] Cosmetic shop page + purchase flow
- [ ] Inventory panel (equip/unequip)
- [ ] Character sheet + stats panel on profile
- [ ] Wire engine into note CRUD actions (create, publish)
- [ ] Stats dashboard API + UI
- [ ] All elements have ARIA labels (progressbar, status, alert roles)

## Success Criteria

- Creating a note awards 10 XP + any word bonus
- XP bar shows progress to next level
- Level up triggers full-screen modal
- Daily quests rotate at midnight
- Completing quests awards coins
- Coins can purchase cosmetic items
- Items appear in inventory, can be equipped
- Achievements unlock automatically on milestones
- Streak counter tracks consecutive login days
- All XP/coin changes logged to AuditLog
- No race conditions on concurrent XP updates

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Quest rotation bugs (duplicate/missed quests) | MEDIUM | Idempotent rotation: check createdAt date before assigning |
| XP farming via rapid note create/delete | MEDIUM | Minimum 50 chars per note for XP. Audit log pattern detection |
| Achievement check performance (O(n) per action) | LOW | Cache achievement criteria. Check only relevant actionType |
| Coin inflation if quest rewards too generous | LOW | Tune constants in seed data. Adjustable via admin panel later |

## Next Steps

Proceed to **Phase 3** (Social & Real-time) — guilds, Socket.io, leaderboard, notifications.
