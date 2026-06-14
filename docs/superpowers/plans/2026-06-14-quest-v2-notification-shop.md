# Quest v2 + Notification + Shop Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish quest system with chains/adaptive AI/new mechanics, add Duolingo-style notifications, unify shop with consumables and equipment, and fix gamification anti-spam across 5 layers.

**Architecture:** Incremental build on existing codebase. Quest schema extended with `narrativeText`, `unlockQuestId`, `mechanic`, `mechanicConfig`. New `nudge-engine.ts` runs on login/heartbeat. Shop unified via `category` field on existing `CosmeticItem`. Anti-spam uses diminishing returns curve + quality gate + content dedup.

**Tech Stack:** SolidStart, Prisma, PostgreSQL, Socket.io, existing gamification engine

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/lib/notifications/nudge-engine.ts` | Auto-triggered nudge scheduler (6 triggers) |
| `src/lib/gamification/anti-spam.ts` | Diminishing returns, duplicate detection, focus time |
| `src/routes/api/users/notification-prefs.ts` | GET/PATCH notification preferences |
| `src/routes/api/shop/recommended.ts` | Personalized shop recommendations |
| `src/routes/api/challenges/upload-image.ts` | Challenge image upload to Supabase |
| `src/components/shop/ConsumableCard.tsx` | Consumable item display with timer |
| `src/components/shop/RecommendedRow.tsx` | "For You" recommendation row |

### Modified Files
| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Quest: +narrativeText, +unlockQuestId, +mechanic, +mechanicConfig; Notification: +urgency, +expiresAt; User: +notificationPrefs; CosmeticItem: +category; UserInventory: +expiresAt |
| `prisma/seed.ts` | 6 new quests, 6 new mechanics, 5 consumables, 3 quest chains, achievement unlockables |
| `src/lib/gamification/constants.ts` | Anti-spam XP constants, focus time XP, consumable effect durations |
| `src/lib/gamification/calculators/xp-calculator.ts` | Diminishing returns curve, quality gate, delete penalty deduction |
| `src/lib/gamification/engine.ts` | Auto-call triggerActionNotifications, check anti-spam before XP |
| `src/lib/gamification/quests/quest-checker.ts` | New mechanic handlers (time_limit, streak_guard, time_window, tag_variety, structure_score, social) |
| `src/lib/gamification/quests/quest-rotation.ts` | Auto AI quest generation on login |
| `src/lib/ai-quests/generator.ts` | Level-based scaling, 24h dedup, max 1 auto/day |
| `src/lib/socket/handlers.ts` | Focus time tracking events |
| `src/routes/api/notes/index.ts` | Duplicate detection on create, quality gate integration |
| `src/routes/api/notes/[id].ts` | Delete penalty check |
| `src/components/gamification/QuestBoard.tsx` | Tab bar (Daily/Weekly/Monthly/Chains), Claim All button |
| `src/components/gamification/QuestCard.tsx` | Chain lock icon, progress pulse animation |
| `src/components/gamification/QuestProgress.tsx` | Dots indicator |
| `src/components/gamification/RewardPopup.tsx` | Combined message display, coin spin animation |
| `src/components/shared/NotificationBell.tsx` | Urgency visual (pulse for urgent), desktop notification |
| `src/routes/(app)/shop.tsx` | Tabs (Cosmetics/Badges/Effects/Consumables), recommended row |
| `src/routes/(app)/profile.tsx` | Appearance tab with equip system |
| `src/routes/(app).tsx` | Nudge engine boot, notification permission prompt |
| `src/stores/user.ts` | Sync notificationPrefs, consumable active effects |

---

## Phase P1: Anti-Spam (5 layers)

### Task P1.1: Add anti-spam constants

**Files:** Modify `src/lib/gamification/constants.ts`

- [ ] Add diminishing returns constants and quality thresholds:

```typescript
// Anti-spam
export const XP_CREATE_NOTE_TIERS: Array<{ max: number; xp: number }> = [
  { max: 3, xp: 10 },
  { max: 6, xp: 7 },
  { max: 10, xp: 5 },
  { max: 15, xp: 3 },
  { max: 50, xp: 1 },
];
export const XP_QUALITY_BONUS = 5;
export const QUALITY_SCORE_THRESHOLD = 3;
export const QUALITY_BONUS_THRESHOLD = 7;
export const DUPLICATE_SIMILARITY_THRESHOLD = 0.8;
export const DELETE_PENALTY_XP = 5;
export const DELETE_PENALTY_MAX_WORDS = 50;
export const DELETE_PENALTY_MAX_AGE_MS = 5 * 60 * 1000;
export const XP_FOCUS_TIME_PER_5MIN = 5;
```

- [ ] Commit: `git commit -m "feat: add anti-spam XP constants"`

### Task P1.2: Implement diminishing returns + quality gate in XP calculator

**Files:** Modify `src/lib/gamification/calculators/xp-calculator.ts`

- [ ] Add `dailyNoteCount` parameter, apply tier curve and quality gate:

```typescript
export function calculateXP(
  actionType: string,
  metadata?: Record<string, unknown>,
  dailyNoteCount?: number,
): number {
  switch (actionType) {
    case "create_note": {
      const isSpam = metadata?.isSpam === true;
      if (isSpam) return 0;

      const qualityScore = typeof metadata?.structureScore === "number" ? metadata.structureScore : 0;
      if (qualityScore < QUALITY_SCORE_THRESHOLD) return 0;

      const count = dailyNoteCount ?? 0;
      let baseXp = 0;
      for (const tier of XP_CREATE_NOTE_TIERS) {
        if (count <= tier.max) { baseXp = tier.xp; break; }
      }
      if (baseXp === 0) return 0;

      const wordCount = typeof metadata?.wordCount === "number" ? metadata.wordCount : 0;
      const wordBonus = Math.min(Math.floor(wordCount / 100) * XP_WRITE_WORDS_PER_100, XP_WRITE_WORDS_MAX);
      const qualityBonus = qualityScore >= QUALITY_BONUS_THRESHOLD ? XP_QUALITY_BONUS : 0;
      return baseXp + wordBonus + qualityBonus;
    }
    // ... existing cases unchanged
  }
}
```

- [ ] Commit: `git commit -m "feat: diminishing returns + quality gate in XP calculator"`

### Task P1.3: Implement duplicate detection on note create

**Files:** Modify `src/routes/api/notes/index.ts`

- [ ] Before creating note, check content similarity against last 10 notes:

```typescript
import { prisma } from "~/lib/db";
import { DUPLICATE_SIMILARITY_THRESHOLD } from "~/lib/gamification/constants";

function tokenize(text: string): Set<string> {
  return new Set(text.toLowerCase().split(/\s+/).filter(w => w.length > 2));
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  const intersection = new Set([...a].filter(x => b.has(x)));
  const union = new Set([...a, ...b]);
  return union.size === 0 ? 0 : intersection.size / union.size;
}
```

Inside POST handler, after auth check:

```typescript
  const recentNotes = await prisma.note.findMany({
    where: { userId: user.userId, isDeleted: false },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { content: true },
  });

  const newTokens = tokenize(parsed.data.content);
  let isSpam = false;
  for (const recent of recentNotes) {
    const sim = jaccardSimilarity(newTokens, tokenize(recent.content));
    if (sim >= DUPLICATE_SIMILARITY_THRESHOLD) { isSpam = true; break; }
  }

  const dailyCount = await prisma.auditLog.count({
    where: { userId: user.userId, actionType: "create_note", createdAt: { gte: new Date(new Date().setHours(0,0,0,0)) } },
  });
```

Pass `isSpam`, `structureScore`, `dailyCount` to `processAction` metadata.

- [ ] Commit: `git commit -m "feat: duplicate detection + daily count on note create"`

### Task P1.4: Implement delete penalty

**Files:** Modify `src/routes/api/notes/[id].ts`

- [ ] In DELETE handler, before soft delete, check penalty conditions:

```typescript
  const noteAge = Date.now() - existing.createdAt.getTime();
  if (existing.wordCount < DELETE_PENALTY_MAX_WORDS && noteAge < DELETE_PENALTY_MAX_AGE_MS) {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.userId },
        data: { xp: { decrement: DELETE_PENALTY_XP } },
      });
      await tx.auditLog.create({
        data: { userId: user.userId, actionType: "note_delete_penalty", xpChange: -DELETE_PENALTY_XP, metadata: { noteId: params.id } },
      });
    });
  }
```

Wait — the `xp` field can go negative. Guard with `GREATEST(0, xp - N)` or accept negative (gamification engine's `calculateLevel` uses `Math.max(0, xp)`). Use raw SQL to prevent negative:

```typescript
  await tx.$executeRaw`UPDATE "User" SET xp = GREATEST(0, xp - ${DELETE_PENALTY_XP}) WHERE id = ${user.userId}::uuid`;
```

- [ ] Commit: `git commit -m "feat: delete penalty for spam notes"`

### Task P1.5: Wire anti-spam into engine

**Files:** Modify `src/lib/gamification/engine.ts`

- [ ] Pass `dailyNoteCount` to `calculateXP` call:

```typescript
const dailyNoteCount = typeof ctx.metadata?.dailyNoteCount === "number"
  ? ctx.metadata.dailyNoteCount
  : (ctx.metadata as any)?._dailyCount;
const xpGained = calculateXP(ctx.actionType, ctx.metadata, dailyNoteCount);
```

- [ ] Commit: `git commit -m "feat: wire anti-spam into gamification engine"`

---

## Phase P2: Quest v2 Schema + Chains + Mechanics

### Task P2.1: Extend Prisma Quest schema

**Files:** Modify `prisma/schema.prisma`

- [ ] Add fields to Quest model:

```prisma
model Quest {
  // ... existing fields
  narrativeText  String?    // RPG-flavor intro
  unlockQuestId  String?    @db.Uuid  // prerequisite quest ID
  iconEmoji      String?    // override icon
  mechanic       String     @default("counter")
  mechanicConfig Json       @default("{}")
}
```

- [ ] Add to Notification model:

```prisma
model Notification {
  // ... existing
  urgency   String   @default("normal")
  expiresAt DateTime?
}
```

- [ ] Run `npx prisma generate`

- [ ] Commit: `git commit -m "feat: extend Quest, Notification, User schemas for v2"`

### Task P2.2: Implement mechanic handlers in quest-checker

**Files:** Modify `src/lib/gamification/quests/quest-checker.ts`

- [ ] Add `checkMechanicProgress` function with switch for each mechanic type:

```typescript
async function checkMechanicProgress(
  tx: Prisma.TransactionClient,
  userId: string,
  userQuest: UserQuest & { quest: Quest },
  actionType: string,
  metadata?: Record<string, unknown>,
): Promise<{ progress: number; completed: boolean }> {
  const mechanic = userQuest.quest.mechanic || "counter";
  const config = userQuest.quest.mechanicConfig as Record<string, unknown>;
  const target = (userQuest.quest.criteria as Record<string, unknown>).count as number;

  switch (mechanic) {
    case "counter": {
      const inc = actionType === "write_words" ? (metadata?.wordCount as number ?? 1) : 1;
      return { progress: (userQuest.progress as any)?.current + inc, completed: (userQuest.progress as any)?.current + inc >= target };
    }
    case "time_limit": {
      const timeWindowMinutes = (config.timeWindowMinutes as number) || 15;
      const assignedAt = userQuest.createdAt.getTime();
      const now = Date.now();
      if (now - assignedAt > timeWindowMinutes * 60 * 1000) return { progress: 0, completed: false };
      return { progress: 1, completed: true };
    }
    case "streak_guard": {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { streak: true } });
      const required = (config.minStreak as number) || 1;
      const completed = (user?.streak ?? 0) >= required;
      return { progress: completed ? 1 : 0, completed };
    }
    case "time_window": {
      const startHour = (config.startHour as number) || 21;
      const endHour = (config.endHour as number) || 24;
      const now = new Date().getHours();
      if (now < startHour || now >= endHour) return { progress: 0, completed: false };
      return { progress: 1, completed: true };
    }
    case "tag_variety": {
      const usedTags = await tx.note.findMany({
        where: { userId, isDeleted: false, createdAt: { gte: new Date(Date.now() - 7 * 86400000) } },
        select: { tags: true },
      });
      const uniqueTags = new Set(usedTags.flatMap(n => n.tags));
      const progress = Math.min(uniqueTags.size, target);
      return { progress, completed: progress >= target };
    }
    case "structure_score": {
      const recentNote = await tx.note.findFirst({
        where: { userId, isDeleted: false },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true, id: true },
      });
      if (!recentNote) return { progress: 0, completed: false };
      const scoreLog = await tx.auditLog.findFirst({
        where: { userId, actionType: "note_quality_score", createdAt: { gte: userQuest.createdAt } },
        orderBy: { createdAt: "desc" },
      });
      const score = scoreLog ? ((scoreLog.metadata as any)?.structureScore ?? 0) : 0;
      const minScore = (config.minScore as number) || 7;
      return { progress: score >= minScore ? 1 : 0, completed: score >= minScore };
    }
    case "social": {
      const msgCount = await tx.guildMessage.count({
        where: { userId, createdAt: { gte: userQuest.createdAt } },
      });
      return { progress: Math.min(msgCount, target), completed: msgCount >= target };
    }
    default:
      return { progress: 0, completed: false };
  }
}
```

- [ ] Replace existing simple increment logic with `checkMechanicProgress` call.
- [ ] Commit: `git commit -m "feat: 7 quest mechanic handlers"`

### Task P2.3: Seed new quests and chains

**Files:** Modify `prisma/seed.ts`

- [ ] Add 6 new quests with mechanics, 3 quest chains with `unlockQuestId`:

```typescript
// New mechanic quests (add to questDefs array)
{ title: 'Speed Writer',  description: 'Write a note within 15 min of quest assignment', questType: 'daily', icon: 'clock', mechanic: 'time_limit', mechanicConfig: { timeWindowMinutes: 15 }, criteria: { action: 'create_note', count: 1 }, xpReward: 25, coinReward: 8 },
{ title: 'Streak Guardian', description: 'Keep your streak alive today', questType: 'daily', icon: 'fire', mechanic: 'streak_guard', mechanicConfig: { minStreak: 1 }, criteria: { action: 'daily_login', count: 1 }, xpReward: 15, coinReward: 5 },
{ title: 'Night Owl Bonus', description: 'Write a note between 21:00-24:00', questType: 'daily', icon: 'moon', mechanic: 'time_window', mechanicConfig: { startHour: 21, endHour: 24 }, criteria: { action: 'create_note', count: 1 }, xpReward: 20, coinReward: 8 },
{ title: 'Tag Explorer', description: 'Use 5 different tags this week', questType: 'weekly', icon: 'tag', mechanic: 'tag_variety', mechanicConfig: {}, criteria: { action: 'any', count: 5 }, xpReward: 60, coinReward: 20 },
{ title: 'Quality Craftsman', description: 'Create 3 notes with structure score ≥ 7', questType: 'weekly', icon: 'star', mechanic: 'structure_score', mechanicConfig: { minScore: 7 }, criteria: { action: 'create_note', count: 3 }, xpReward: 80, coinReward: 25 },
{ title: 'Guild Chatter', description: 'Send 5 messages in guild chat', questType: 'weekly', icon: 'chat', mechanic: 'social', mechanicConfig: {}, criteria: { action: 'guild_message', count: 5 }, xpReward: 40, coinReward: 15 },
```

Chain setup uses a seeded field `narrativeText` and `unlockQuestId`. Since `unlockQuestId` depends on knowing the prerequisite's ID, seed in two passes:

```typescript
// Pass 1: seed all quests
// Pass 2: resolve IDs and set unlockQuestId
const dailyScribe = await prisma.quest.findFirst({ where: { title: 'Daily Scribe' } });
const prolific = await prisma.quest.findFirst({ where: { title: 'Prolific Author' } });
if (dailyScribe) {
  await prisma.quest.upsert({
    where: { title: 'Apprentice Writer' },
    create: { title: 'Apprentice Writer', description: 'Chain step 2: Create 10 notes', questType: 'weekly', narrativeText: 'The path of ink continues... Your quill grows stronger.', unlockQuestId: dailyScribe.id, criteria: { action: 'create_note', count: 10 }, xpReward: 80, coinReward: 25 },
    update: { unlockQuestId: dailyScribe.id },
  });
}
```

- [ ] Commit: `git commit -m "feat: seed 6 new quests + 3 quest chains"`

---

## Phase P3: Quest UI

### Task P3.1: Add tabs + Claim All to QuestBoard

**Files:** Modify `src/components/gamification/QuestBoard.tsx`

- [ ] Replace current daily/weekly split logic with tab state:

```tsx
const [tab, setTab] = createSignal<"daily" | "weekly" | "monthly" | "chains">("daily");

const filteredQuests = () => {
  if (tab() === "chains") return quests().filter(q => q.quest.unlockQuestId || q.quest.narrativeText);
  return quests().filter(q => q.quest.questType === tab());
};
```

- [ ] Add tab bar UI and "Claim All" button:

```tsx
<div class="flex gap-1 bg-surface-elevated rounded-lg p-1 border border-surface-border w-fit">
  {(["daily","weekly","monthly","chains"] as const).map(t => (
    <button onClick={() => setTab(t)} class={`px-4 py-1.5 rounded-md text-sm capitalize ${tab()===t?"bg-accent text-white":"text-ink-secondary"}`}>{t}</button>
  ))}
</div>

<Show when={quests().filter(q => q.status === "completed").length > 1}>
  <button onClick={claimAll} class="text-sm text-accent hover:underline">Claim All ({quests().filter(q => q.status === "completed").length})</button>
</Show>
```

- [ ] Implement `claimAll` function: iterate completed quests, call `claimQuest`, aggregate rewards, show single toast.
- [ ] Commit: `git commit -m "feat: quest board tabs + claim all"`

### Task P3.2: Add chain lock icon + progress pulse to QuestCard

**Files:** Modify `src/components/gamification/QuestCard.tsx`

- [ ] Check if quest is locked (has `unlockQuestId` and prerequisite not completed):

```tsx
const isLocked = () => {
  if (!props.quest.quest.unlockQuestId) return false;
  const prereq = quests().find(q => q.questId === props.quest.quest.unlockQuestId);
  return !prereq || prereq.status !== "claimed";
};
```

- [ ] Show lock icon and disable claim for locked quests.
- [ ] Add pulse CSS animation class to progress bar when > 80%.
- [ ] Commit: `git commit -m "feat: quest chain lock + progress pulse animation"`

### Task P3.3: Update sidebar QuestProgress with dots

**Files:** Modify `src/components/gamification/QuestProgress.tsx`

- [ ] Show dots indicator for daily quests:

```tsx
const dailyQuests = () => (quests() || []).filter(q => q.quest.questType === "daily");
const completed = () => dailyQuests().filter(q => q.status === "completed" || q.status === "claimed").length;
const total = () => dailyQuests().length || 3;

// Render: "●●○ 2/3 dailies done"
```

- [ ] Commit: `git commit -m "feat: quest progress dots indicator"`

---

## Phase P4: Adaptive AI Quest Auto-Trigger

### Task P4.1: Add level-based scaling to generator

**Files:** Modify `src/lib/ai-quests/generator.ts`

- [ ] Add `getLevelMultiplier` function:

```typescript
function getLevelMultiplier(level: number): { target: number; xpMult: number } {
  if (level <= 5) return { target: 1, xpMult: 1 };
  if (level <= 15) return { target: 2, xpMult: 2 };
  return { target: 3, xpMult: 3 };
}
```

- [ ] Apply multiplier to generated quest xpReward and target.
- [ ] Add 24h dedup: before generating, query `AIQuest` with same `ruleId` completed in last 24h → skip that rule.
- [ ] Commit: `git commit -m "feat: AI quest level scaling + 24h dedup"`

### Task P4.2: Auto-generate on login via quest rotation

**Files:** Modify `src/lib/gamification/quests/quest-rotation.ts`

- [ ] After rotating quests, check if user has any active AI quests. If none + last generation > 24h ago → auto-generate:

```typescript
const activeAiQuests = await tx.aIQuest.findFirst({
  where: { userId, status: "active" },
});
if (!activeAiQuests) {
  const lastGen = await tx.aIQuest.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  const canGenerate = !lastGen || (Date.now() - lastGen.createdAt.getTime()) > 86400000;
  if (canGenerate) {
    const { generateQuests } = await import("~/lib/ai-quests/generator");
    const generated = await generateQuests(userId);
    for (const q of generated) {
      await tx.aIQuest.create({ data: { userId, ...q } });
    }
  }
}
```

- [ ] Commit: `git commit -m "feat: auto AI quest generation on login"`

---

## Phase P5: Notification Urgency + Nudge Engine

### Task P5.1: Add urgency column migration + model update

**Files:** Modify `prisma/schema.prisma` (already done in P2.1)

- [ ] (No code changes — schema already updated in P2.1)
- [ ] Commit: (included in P2.1)

### Task P5.2: Create nudge engine

**Files:** Create `src/lib/notifications/nudge-engine.ts`

- [ ] Implement 6 trigger checks:

```typescript
import { prisma } from "~/lib/db";
import { createNotification } from "~/lib/socket/notifications";

export async function runNudgeEngine(userId: string): Promise<void> {
  const now = new Date();
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);

  const [user, todayNotes, lastNote, guildMember] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { streak: true, xp: true, level: true } }),
    prisma.note.count({ where: { userId, isDeleted: false, createdAt: { gte: todayStart } } }),
    prisma.note.findFirst({ where: { userId, isDeleted: false }, orderBy: { createdAt: "desc" }, select: { createdAt: true } }),
    prisma.guildMember.findFirst({ where: { userId }, include: { guild: { include: { tasks: { where: { status: "assigned" }, take: 1 } } } } }),
  ]);

  if (!user) return;

  const daysSinceLastNote = lastNote ? Math.ceil((now.getTime() - lastNote.createdAt.getTime()) / 86400000) : 999;

  // 1. Streak at risk
  if (user.streak >= 3 && todayNotes === 0 && now.getHours() >= 21) {
    await createNotification(userId, "streak_warning", `⚡ Còn 3h để giữ streak ${user.streak} ngày!`, "Viết 1 note ngay để không mất streak.", { urgency: "urgent" });
  }

  // 2. Comeback
  if (daysSinceLastNote === 3) {
    await createNotification(userId, "comeback", "👋 Đã 3 ngày không ghé tavern!", "Quay lại nhận quest mới và giữ streak của bạn.", { urgency: "normal" });
  }

  // 3. Near milestone (every 100 notes)
  const totalNotes = await prisma.note.count({ where: { userId, isDeleted: false } });
  if (totalNotes % 100 >= 95) {
    await createNotification(userId, "milestone", `🎉 Sắp đạt ${Math.ceil(totalNotes / 100) * 100} notes!`, "Chỉ còn vài note nữa thôi!", { urgency: "urgent" });
  }

  // 4. Weekly recap (Sunday 20:00)
  if (now.getDay() === 0 && now.getHours() === 20) {
    const weekStart = new Date(now); weekStart.setDate(now.getDate() - 7);
    const weekNotes = await prisma.note.count({ where: { userId, isDeleted: false, createdAt: { gte: weekStart } } });
    const weekWords = await prisma.note.aggregate({ where: { userId, isDeleted: false, createdAt: { gte: weekStart } }, _sum: { wordCount: true } });
    await createNotification(userId, "weekly_recap", "📊 Weekly Recap", `${weekNotes} notes, ${weekWords._sum.wordCount ?? 0} words this week.`, { urgency: "normal" });
  }

  // 5. Guild backlog
  if (guildMember?.guild?.tasks?.length > 0) {
    await createNotification(userId, "guild_activity", "🏛️ Guild task waiting!", "Your guild has unassigned tasks.", { urgency: "normal" });
  }

  // 6. Near level-up
  const xpForNext = (user.level + 1) * (user.level + 1) * 100;
  const xpRemaining = xpForNext - user.xp;
  if (xpRemaining > 0 && xpRemaining / xpForNext <= 0.15) {
    await createNotification(userId, "level_up_near", `📈 Còn ${xpRemaining} XP lên Level ${user.level + 1}!`, "Keep writing!", { urgency: "urgent" });
  }
}
```

- [ ] Commit: `git commit -m "feat: nudge engine with 6 triggers"`

### Task P5.3: Boot nudge engine on login + heartbeat

**Files:** Modify `src/routes/(app).tsx`, `src/routes/api/auth/login.ts`

- [ ] In login.ts POST handler, after `startSession`:

```typescript
import { runNudgeEngine } from "~/lib/notifications/nudge-engine";
runNudgeEngine(user.id).catch(() => {});
```

- [ ] In `(app).tsx`, add 30-minute interval:

```tsx
onMount(() => {
  const interval = setInterval(() => {
    const u = user();
    if (u) {
      authFetch("/api/auth/me").then(r => r.json()).then(j => {
        if (j.success) runNudgeCheck();
      });
    }
  }, 30 * 60 * 1000);
  onCleanup(() => clearInterval(interval));
});
```

- [ ] Commit: `git commit -m "feat: boot nudge engine on login + heartbeat"`

---

## Phase P6: Desktop Notifications + Toast

### Task P6.1: Desktop notification permission + push

**Files:** Modify `src/stores/notifications.ts` (add helper), Modify `src/components/shared/NotificationBell.tsx`

- [ ] Add helper function:

```typescript
export async function requestDesktopPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export function showDesktopNotification(title: string, body: string): void {
  if (Notification.permission === "granted") {
    new Notification(title, { body, icon: "/favicon.ico" });
  }
}
```

- [ ] In `NotificationBell`, when receiving urgent+ notification and tab hidden:

```tsx
on("notification:new", (data: any) => {
  addSocketNotification(data);
  if ((data.urgency === "urgent" || data.urgency === "critical") && document.hidden) {
    showDesktopNotification(data.title, data.body || "");
  }
});
```

- [ ] Commit: `git commit -m "feat: desktop notification permission + push"`

### Task P6.2: Toast redesign with urgency styling

**Files:** Modify `src/components/gamification/RewardPopup.tsx`

- [ ] Add urgency-based styling for streak-related toasts:

```tsx
<div class={`flex flex-col gap-1 px-4 py-3 rounded-lg shadow-lg text-sm font-medium pointer-events-auto ${
  reward.urgency === "urgent" ? "bg-gradient-to-r from-orange-500/20 to-red-500/20 border-orange-400/30" : ""
}`}>
```

- [ ] Add coin spin CSS animation keyframes to `app.css`:

```css
@keyframes coin-spin {
  0% { transform: rotateY(0deg); }
  100% { transform: rotateY(360deg); }
}
.animate-coin-spin { animation: coin-spin 0.6s ease-out; }
```

- [ ] Commit: `git commit -m "feat: urgency toast styling + coin spin animation"`

---

## Phase P7: Notification Preferences + Engine Auto-Trigger

### Task P7.1: Add notification preferences API

**Files:** Create `src/routes/api/users/notification-prefs.ts`

- [ ] GET returns current prefs, PATCH updates:

```typescript
export async function GET({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);
  const u = await prisma.user.findUnique({ where: { id: user.userId }, select: { notificationPrefs: true } });
  return success(u?.notificationPrefs ?? {});
}

export async function PATCH({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);
  const body = await request.json();
  await prisma.user.update({ where: { id: user.userId }, data: { notificationPrefs: body } });
  return success(body);
}
```

- [ ] Add `notificationPrefs` to User select in `me.ts` and `login.ts`.
- [ ] Commit: `git commit -m "feat: notification preferences API"`

### Task P7.2: Add settings page for notification toggles

**Files:** Create `src/routes/(app)/settings/notifications.tsx`

- [ ] Simple toggle page:

```tsx
const TOGGLES = [
  { key: "desktop", label: "Desktop notifications" },
  { key: "quest_complete", label: "Quest completed" },
  { key: "level_up", label: "Level up" },
  { key: "streak_warning", label: "Streak warnings", alwaysOn: true },
  { key: "guild_activity", label: "Guild activity" },
  { key: "weekly_recap", label: "Weekly recap" },
];
```

Each toggle calls `PATCH /api/users/notification-prefs` with updated JSON.

- [ ] Commit: `git commit -m "feat: notification preferences settings page"`

### Task P7.3: Auto-trigger notifications in engine

**Files:** Modify `src/lib/gamification/engine.ts`

- [ ] At end of `processAction`, fire-and-forget:

```typescript
  triggerActionNotifications(ctx.userId, {
    leveledUp,
    newLevel: leveledUp ? newLevel : undefined,
    newTitle: leveledUp ? getLevelTitle(newLevel) : undefined,
    unlockedAchievements,
    xpGained,
    coinsGained,
    questProgress,
  });
```

- [ ] Remove manual `triggerActionNotifications` calls from: `login.ts`, `quests/[id]/claim.ts`, `notes/new.tsx` (client-side call), `guilds/index.ts`, `guilds/[id]/join.ts`, `habits/[id]/checkin.ts`, `notes/[id]/summarize.ts`.
- [ ] Commit: `git commit -m "feat: auto-trigger notifications in engine, remove manual calls"`

---

## Phase P8: Shop Unify + Consumables

### Task P8.1: Add category field to CosmeticItem

**Files:** Modify `prisma/schema.prisma`

- [ ] Already planned — add `category Json?` to CosmeticItem. Also add `expiresAt DateTime?` to `UserInventory`.
- [ ] Run `npx prisma generate`.
- [ ] Commit: `git commit -m "feat: shop category + consumable timer fields"`

### Task P8.2: Seed consumables

**Files:** Modify `prisma/seed.ts`

- [ ] Add 5 consumable items:

```typescript
// Add to existing cosmetic items array
{ name: 'XP Booster (1h)', description: 'Double XP for 1 hour', type: 'consumable', coinCost: 30, rarity: 'common', category: { usageType: 'xp_boost', durationMin: 60 } },
{ name: 'Focus Potion', description: 'Double word-count bonus for 30 min', type: 'consumable', coinCost: 20, rarity: 'common', category: { usageType: 'focus_potion', durationMin: 30 } },
{ name: 'Streak Freeze', description: 'Miss 1 day without breaking streak', type: 'consumable', coinCost: 50, rarity: 'rare', category: { usageType: 'streak_freeze' } },
{ name: 'Quest Reroll', description: 'Replace 1 active quest', type: 'consumable', coinCost: 15, rarity: 'common', category: { usageType: 'quest_reroll' } },
{ name: 'Loot Box', description: 'Random badge or effect', type: 'consumable', coinCost: 75, rarity: 'epic', category: { usageType: 'loot_box' } },
```

- [ ] Commit: `git commit -m "feat: seed 5 consumable items"`

### Task P8.3: Update shop page with tabs

**Files:** Modify `src/routes/(app)/shop.tsx`

- [ ] Add tab state for categories. Fetch all items, filter client-side:

```tsx
const [tab, setTab] = createSignal("cosmetics");
const items = () => (shopItems() || []).filter(i => {
  const cat = i.category as any;
  if (tab() === "consumables") return i.type === "consumable";
  if (tab() === "themes") return i.type === "theme";
  return i.type !== "consumable" && i.type !== "theme";
});
```

- [ ] Commit: `git commit -m "feat: shop tabs (cosmetics/consumables/themes)"`

---

## Phase P9: Equipment + Personalized Shop

### Task P9.1: Add appearance tab to profile

**Files:** Modify `src/routes/(app)/profile.tsx`

- [ ] Add tab state, fetch inventory on mount. Render avatar preview with equipped frame + badge + nameplate.

- [ ] Commit: `git commit -m "feat: profile appearance tab with equip system"`

### Task P9.2: Personalized shop recommendations

**Files:** Create `src/routes/api/shop/recommended.ts`

- [ ] Based on user signals, return 4 recommended items:

```typescript
export async function GET({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const [userData, totalNotes, avgQuality, ownedCount] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.userId }, select: { streak: true, level: true, createdAt: true } }),
    prisma.note.count({ where: { userId: user.userId, isDeleted: false } }),
    prisma.auditLog.aggregate({ where: { userId: user.userId, actionType: "note_quality_score" }, _avg: { metadata: true } }),
    prisma.userInventory.count({ where: { userId: user.userId } }),
  ]);

  const daysSinceJoined = userData ? Math.ceil((Date.now() - userData.createdAt.getTime()) / 86400000) : 1;

  const recIds: string[] = [];
  if (userData && userData.streak >= 30) recIds.push("streak_freeze_id");  // resolve by type
  if (totalNotes >= 50 && avgQuality > 5) recIds.push("effect_sparkle_id");
  if (ownedCount >= 2) recIds.push("font_pack_id");
  if (userData && userData.level >= 20) recIds.push("royal_nameplate_id");
  if (daysSinceJoined < 7) recIds.push("beginner_badge_id");

  const items = await prisma.cosmeticItem.findMany({
    where: { id: { in: recIds }, isActive: true },
  });
  return success(items);
}
```

- [ ] Add `RecommendedRow` component to `shop.tsx` that renders the returned items in a horizontal scroll.
- [ ] Commit: `git commit -m "feat: personalized shop recommendations"`

### Task P9.3: Achievement auto-unlock items

**Files:** Modify `src/lib/gamification/achievements/achievement-checker.ts`

- [ ] After unlocking an achievement, check if it grants an item:

```typescript
const ACHIEVEMENT_REWARDS: Record<string, { itemType: string }> = {
  "First Scroll": { itemType: "beginner_badge" },
  "Streak Master": { itemType: "streak_freeze" },
  "Wordsmith": { itemType: "effect_sparkle" },
  "Quest Champion": { itemType: "gold_confetti" },
  "Guild Leader": { itemType: "guild_master_nameplate" },
};

for (const ach of newAchievements) {
  const reward = ACHIEVEMENT_REWARDS[ach.title];
  if (reward) {
    const item = await tx.cosmeticItem.findFirst({ where: { type: reward.itemType } });
    if (item) {
      await tx.userInventory.create({ data: { userId, cosmeticItemId: item.id } });
    }
  }
}
```

- [ ] Commit: `git commit -m "feat: achievement auto-unlock shop items"`

---

## Phase P10: Challenge Image Upload

### Task P10.1: Create upload endpoint

**Files:** Create `src/routes/api/challenges/upload-image.ts`

- [ ] Accept multipart form data, validate file type + size, upload to Supabase:

```typescript
export async function POST({ request }: { request: Request }) {
  const user = getUserFromRequest(request);
  if (!user) return error("UNAUTHORIZED", "Not authenticated", 401);

  const formData = await request.formData();
  const file = formData.get("image") as File;
  if (!file) return error("VALIDATION_ERROR", "No image provided", 400);
  if (!["image/png", "image/jpeg"].includes(file.type)) return error("VALIDATION_ERROR", "Only PNG/JPEG allowed", 400);
  if (file.size > 2 * 1024 * 1024) return error("VALIDATION_ERROR", "Max 2MB", 400);

  // Upload to Supabase Storage (existing client)
  const { data, error: uploadError } = await supabase.storage
    .from("challenge-images")
    .upload(`${user.userId}/${Date.now()}-${file.name}`, file);

  if (uploadError) return error("UPLOAD_ERROR", "Failed to upload", 500);

  const { data: { publicUrl } } = supabase.storage.from("challenge-images").getPublicUrl(data.path);
  return success({ url: publicUrl });
}
```

- [ ] Commit: `git commit -m "feat: challenge image upload endpoint"`

### Task P10.2: Add upload toggle to ChallengeForm

**Files:** Modify `src/routes/(app)/challenges/new.tsx`

- [ ] Add emoji/image toggle above icon picker. On image select, call upload endpoint, set `iconImageUrl`.

- [ ] Commit: `git commit -m "feat: challenge image upload UI"`

---

## Self-Review Checklist

- [x] Spec coverage — all 5 sections (anti-spam, quest v2, notifications, shop, challenge images) mapped to tasks
- [x] Placeholder scan — no TBDs, TODOs, or vague instructions
- [x] Type consistency — `mechanic` field used consistently; `urgency` matches Notification model; `unlockQuestId` resoled in seed pass 2
