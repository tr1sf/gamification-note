# Quest v2 + Notification + Shop Polish — Design Spec

> **Date:** 2026-06-14
> **Status:** Approved
> **Approach:** Incremental (build on existing infrastructure)

---

## Overview

Polish 3 interconnected systems to make TavernoteX more engaging:
1. **Quest v2** — chains, adaptive AI, new types
2. **Notifications** — Duolingo-style urgency, desktop push, auto-trigger
3. **Shop** — unified flow, consumables, equipment, personalized recs
4. **Anti-spam** — multi-layer gamification exploit protection

---

## Section 1: Anti-Spam Gamification Fixes

### Problem
Users can farm XP by spamming low-quality notes. Current system rewards quantity.

### Solution: 5-Layer Defense

| Layer | Mechanism | Implementation |
|-------|-----------|---------------|
| **1. Diminishing Returns** | XP per `create_note` decreases based on count in last 24h | Count `AuditLog` entries for today; apply curve: 1-3=10XP, 4-6=7XP, 7-10=5XP, 11-15=3XP, 16-49=1XP, 50+=0XP |
| **2. Quality Gate** | Notes with `structureScore < 3` get 0 XP | Already scored in `note_create` tracking; add gate in `xp-calculator.ts`; notes with score ≥ 7 get +5 bonus |
| **3. Duplicate Detection** | Content similarity check against 10 most recent notes | Simple hash + Levenshtein ratio. Similarity > 80% → 0 XP + toast "Looks similar to a recent note" |
| **4. Delete Penalty** | Hard-delete note < 50 words within 5 min → -5 XP | Check `wordCount` and `createdAt` on delete; only apply if < 50 words AND age < 5 min |
| **5. Focus Time Bonus** | +5 XP per 5 minutes of continuous editing | Track edit session via Socket.io presence + `edit:focus` events; grant via `grantReward` |

### File Changes
- `src/lib/gamification/calculators/xp-calculator.ts` — diminishing returns + quality gate
- `src/lib/gamification/constants.ts` — new XP constants
- `src/routes/api/notes/[id].ts` — delete penalty check
- `src/routes/api/notes/index.ts` — duplicate detection on create
- `src/lib/socket/handlers.ts` — focus time tracking

---

## Section 2: Quest v2

### 2.1 Schema Changes

```prisma
model Quest {
  // existing fields...
  narrativeText  String?    // RPG-flavor intro text
  unlockQuestId  String?    @db.Uuid  // prerequisite quest
  iconEmoji      String?    // override icon with emoji
  mechanic       String     @default("counter")  // counter | time_limit | streak_guard | time_window | tag_variety | structure_score | social
  mechanicConfig Json       @default("{}")       // mechanic-specific params
}
```

### 2.2 Quest Chains

Three storylines, each 2-3 quests in sequence. `unlockQuestId` creates parent-child chain.

| Chain | Step 1 | Step 2 | Step 3 |
|-------|--------|--------|--------|
| **Path of the Scribe** | Daily Scribe | Apprentice Writer (10 notes) | Master Chronicler (50 notes) |
| **Wisdom Seeker** | Knowledge Keeper | Insight Miner (5 reviews) | Sage's Archive (20 reviews) |
| **Community Builder** | Guild Founder | Guild Leader (recruit 5 members) | — |

Chain quests only appear when prerequisite is completed.

### 2.3 New Mechanic Types

| Mechanic | How It Works | Seed Examples |
|----------|-------------|---------------|
| `counter` | Count matching actions (existing) | All current quests |
| `time_limit` | Note must be created within N minutes of quest assignment | "Speed Writer" (15 min) |
| `streak_guard` | Keep streak ≥ current value for the day | "Streak Guardian" (daily) |
| `time_window` | Action must occur within specific hours | "Night Owl" (21h-24h) |
| `tag_variety` | Use N different tags across notes | "Tag Explorer" (5 tags) |
| `structure_score` | Notes must have score ≥ threshold | "Quality Craftsman" (score ≥ 7) |
| `social` | Count guild message / guild interactions | "Guild Chatter" (5 messages) |

`quest-checker.ts` — extend with mechanic-specific switch case.

### 2.4 Adaptive AI Quest

- **Auto-generate on login**: inside `rotateQuestsIfNeeded`, if no active AI quests → call `generateQuests`
- **Level-based scaling**:
  - Level 1-5: target=1, XP=10-15
  - Level 6-15: target=1-2, XP=20-30
  - Level 16+: target=2-3, XP=40-60
- **24h dedup**: same `ruleId` cannot appear again within 24h
- **Max 1 generation/day**: user can still manually generate but auto only once/day

### 2.5 Quest UI

- **Tab bar**: Daily | Weekly | Monthly | Chains
- **Chains tab**: visual tree layout showing quest sequence, lock icons for locked
- **Progress pulse**: progress bar pulses (CSS animation) when > 80%
- **Claim all button**: if > 1 quest completed → "Claim All" with combined reward toast
- **Sidebar mini widget**: dots indicator "●●○ 2/3 dailies done"

---

## Section 3: Notification v2 (Duolingo-style)

### 3.1 Schema

```prisma
model Notification {
  urgency   String   @default("normal")  // normal | urgent | critical
  expiresAt DateTime?
}
```

### 3.2 Nudge Engine

`src/lib/notifications/nudge-engine.ts` — background scheduler (runs on login + every 30 min via Socket.io heartbeat):

| Trigger | Condition | Message | Urgency |
|---------|-----------|---------|---------|
| Streak at risk | No note today + streak ≥ 3 + time ≥ 21:00 | "⚡ Còn 3h để giữ streak {N} ngày!" | urgent |
| Comeback | daysSinceLastNote == 3 | "👋 Đã 3 ngày không ghé tavern!" | normal |
| Near milestone | totalNotes % 100 >= 95 | "🎉 Sắp đạt {N} notes!" | urgent |
| Weekly recap | Sunday 20:00 | "📊 Tuần này: {notes} notes, {words} từ" | normal |
| Guild backlog | guild has tasks unassigned > 24h | "🏛️ Guild có task tồn đọng!" | normal |
| Near level-up | xpToNext ≤ 15% of total | "📈 Còn {xp} XP lên Level {L}!" | urgent |

### 3.3 Desktop Notifications

- `Notification.requestPermission()` prompt on first urgent notification
- When tab hidden (`document.hidden`): fire `new Notification(title, { body, icon })` for urgent+
- When tab visible: app toast instead
- Persist permission state in `localStorage`

### 3.4 Toast Redesign

- Slide-in from top-right with spring bounce animation
- Streak-related toasts: gradient background (orange→red) + 🔥 icon
- Reward toasts: combined message (no separate XP/coin lines) + coin spin animation

### 3.5 Notification Preferences

New API: `PATCH /api/users/notification-prefs`
Saved as `User.notificationPrefs Json`:

```json
{
  "desktop": true,
  "quest_complete": true,
  "level_up": true,
  "streak_warning": true,
  "guild_activity": true,
  "weekly_recap": true
}
```

Settings page at `/settings/notifications` with toggle switches.

### 3.6 Engine Auto-Trigger

`triggerActionNotifications()` now called automatically inside `processAction()` (fire-and-forget, after DB commit). Remove all manual calls from API routes.

---

## Section 4: Shop Polish

### 4.1 Unify Shop Flow

Add `category` field to `CosmeticItem`:

```prisma
CosmeticItem {
  category Json?  // e.g. { "type": "badge", "badgeIcon": "scholar" }
  // ... existing fields
}
```

Shop page tabs: Cosmetics | Badges | Effects | Consumables

### 4.2 Consumables

New items in seed, same `CosmeticItem` model with `type: "consumable"`:

| Item | Effect | Cost | Usage |
|------|--------|------|-------|
| XP Booster (1h) | 2x XP all actions | 30 | Auto-activate on purchase, 1h timer |
| Focus Potion | Double word-count bonus | 20 | 30 min timer |
| Streak Freeze | Miss 1 day without breaking streak | 50 | Auto-consumed on missed day |
| Quest Reroll | Replace 1 active quest | 15 | Click "Reroll" button on quest card |
| Loot Box | Random badge/frame/effect | 75 | "Open" animation reveals item |

Implementation:
- `UserInventory` tracks `isEquipped` (for permanent items) and `expiresAt` (for consumables)
- `purchasedAt` used to compute remaining time for timers

### 4.3 Equipment System

Profile page → "Appearance" tab:
- **Avatar preview**: user avatar + selected frame + badge + nameplate
- Dropdown selects from inventory where `isEquipped`
- "Save appearance" → `PATCH /api/users/appearance`
- Real-time preview via CSS (no page reload)

### 4.4 Personalized Shop Recommendations

`GET /api/shop/recommended?take=4` — returns items based on:

| User Signal | Recommendation |
|-------------|---------------|
| streak ≥ 30 | Streak Freeze |
| totalNotes ≥ 50 + high avg quality | Note Sparkle effect |
| owned ≥ 2 themes | Custom Font Pack |
| level ≥ 20 | Royal Nameplate |
| daysSinceJoined < 7 | Beginner's Badge (cheap) |

### 4.5 Achievement Unlockables

Certain achievements auto-grant items:

| Achievement | Unlocked Item |
|-------------|--------------|
| First Scroll | Beginner Badge |
| Streak Master (7d) | 1x Streak Freeze |
| Wordsmith (10k words) | Note Sparkle |
| Quest Champion (30) | Gold Confetti |
| Guild Leader | "Guild Master" Nameplate |

Implementation: `checkAchievements` in engine auto-creates `UserInventory` entry when achievement is first unlocked.

---

## Section 5: Challenge Custom Images

Existing `Challenge.iconImageUrl` + `iconType` fields. Add:

- **Upload endpoint**: `POST /api/challenges/upload-image` → Supabase Storage → return URL
- **UI**: tab "Emoji | Upload" in ChallengeForm; preview thumbnail
- **Validation**: max 2MB, `.png/.jpg/.jpeg`, resize to 256x256 client-side

---

## Section 6: Implementation Phases

| Phase | Content | Effort | Depends On |
|-------|---------|--------|------------|
| **P1** | Anti-spam (5 layers) | 3h | None |
| **P2** | Quest v2 schema + chains + new mechanics | 4h | P1 |
| **P3** | Quest UI (tabs, chains, claim all) | 3h | P2 |
| **P4** | Adaptive AI quest auto-trigger | 2h | P2 |
| **P5** | Notification urgency + nudge engine | 3h | None |
| **P6** | Desktop notifications + toast redesign | 2h | P5 |
| **P7** | Notification preferences + engine auto-trigger | 2h | P5 |
| **P8** | Shop unify + consumables | 3h | None |
| **P9** | Equipment system + personalized shop | 3h | P8 |
| **P10** | Challenge image upload | 1.5h | None |
| | **Total** | **~26.5h** | |

---

## Section 7: Risks

| Risk | Mitigation |
|------|-----------|
| Diminishing returns confuses users | Tooltip on XP bar: "XP per note decreases after 3/day" |
| Duplicate detection false positives | Only warn, don't block creation; threshold configurable |
| Desktop notification spam | Preference page + urgency-based filtering |
| Focus time tracking inaccurate | Heartbeat every 30s via Socket.io; ≤ 30s idle resets timer |
