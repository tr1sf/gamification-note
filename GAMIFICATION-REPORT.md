# TavernoteX — Gamification System Report

> **Date:** 2026-06-18  
> **Purpose:** Complete documentation of the gamification engine, mechanics, and systems  
> **Related:** All gamification code in `src/lib/gamification/`, `src/components/gamification/`, `src/stores/`

---

## 1. Architecture Overview

```
User Action (create note, login, quiz, etc.)
    │
    ▼
processAction(userId, actionType, metadata)     ← engine.ts
    │
    ├── SELECT ... FOR UPDATE (lock user row)   ← race condition prevention
    ├── calculateXP / calculateCoins            ← pure functions
    ├── UPDATE User (xp, coins, level, title)
    ├── INSERT AuditLog (full tracking)
    ├── rotateQuestsIfNeeded                    ← daily/weekly/monthly assignment
    ├── checkQuestProgress                      ← 7 mechanic types
    ├── checkAchievements                       ← criteria-based unlock
    └── triggerNotifications                    ← Socket.io push
```

The entire gamification pipeline runs in **one database transaction** (`prisma.$transaction`). The user row is locked with `SELECT ... FOR UPDATE` to prevent concurrent XP/coin race conditions.

---

## 2. XP System

### 2.1 XP Calculation — `src/lib/gamification/calculators/xp-calculator.ts`

| Action | Base XP | Formula |
|--------|---------|---------|
| `create_note` | 10 | See diminishing returns below + word bonus + quality bonus |
| `write_words` | — | min(floor(words / 100) × 1, 50) |
| `make_public` | 5 | Flat |
| `daily_login` | 5 + streak × 5 | Streak from User.streak field |
| `complete_quest` | metadata.xpReward | Variable, set per quest |
| `unlock_achievement` | metadata.xpReward | Variable, set per achievement |
| `ai_summarize` | 15 | Flat |
| `review_note` | 5 | Viewing notes > 7 days old |
| `structured_note` | 8 | Note with heading + paragraph structure |
| `export_note` | 3 | Exporting to file |
| `share_note` | 5 | Someone views your public note |
| `add_link` | 3 | Adding external links |

### 2.2 Diminishing Returns (Anti-Spam)

```
Notes per day  | XP per note
───────────────┼────────────
 1–3           | 10 XP
 4–6           |  7 XP  (-30%)
 7–10          |  5 XP  (-50%)
11–15          |  3 XP  (-70%)
16–49          |  1 XP  (-90%)
50+            |  0 XP  (hard cap)
```

Implementation: counts `AuditLog` entries with `actionType="create_note"` for the current calendar day.

### 2.3 Quality Gate

| Condition | Effect |
|-----------|--------|
| `structureScore < 3` | **0 XP** (note blocked from earning) |
| `structureScore ≥ 7` | **+5 bonus XP** |
| `isSpam === true` (duplicate detected) | **0 XP** |

`structureScore` is calculated by `src/lib/analytics/quality-scorer.ts` on a 0-10 scale based on: headings, lists, code blocks, links, tags, category, word count.

### 2.4 Duplicate Detection

Jaccard similarity ≥ 0.8 between new note content and 10 most recent notes → flagged as `isSpam` → 0 XP.

### 2.5 Delete Penalty

Deleting a note with < 50 words created within 5 minutes → **-5 XP** (anti create/delete cycle).

### 2.6 Focus Time Bonus

Each focus sprint (Pomodoro) awards **+2 XP per 5 minutes**. 3 sprints in a day = **2x multiplier**.

### 2.7 XP Boosters (Consumable)

Active `xp_boost` consumable → **2x all XP** for the duration (1 hour).

---

## 3. Level System — `src/lib/gamification/calculators/level-calculator.ts`

### 3.1 Formula

```
Level = max(1, floor(sqrt(xp / 100)))
```

| Level | Total XP Required |
|-------|-------------------|
| 1 | 0 |
| 2 | 100 |
| 3 | 400 |
| 4 | 900 |
| 5 | 2,500 |
| 10 | 10,000 |
| 20 | 40,000 |
| 50 | 250,000 |

### 3.2 Titles

| Level | Title |
|-------|-------|
| 1 | Novice Scribe |
| 5 | Apprentice Scribe |
| 10 | Scribe |
| 15 | Senior Scribe |
| 20 | Scholar |
| 30 | Archivist |
| 40 | Master Archivist |
| 50 | Grand Archivist |
| 60 | Sage |
| 75 | Lore Master |
| 100 | Tavern Sage |

### 3.3 Level-Up Event

When `newLevel > currentLevel`:
1. User's `title` field updated in DB
2. `LevelUpModal` full-screen celebration triggered
3. Notification: "Level N — Title" pushed via Socket.io
4. Audit logged with `levelBefore` and `levelAfter` metadata

---

## 4. Coin System

### 4.1 Coin Sources

| Source | Coins |
|--------|-------|
| `daily_login` | 5 |
| `complete_quest` | Variable (5–80) |
| `ai_summarize` | 3 |
| `review_note` | 1 |
| `export_note` | 1 |
| `share_note` | 2 |
| Survey completion | 50 |
| Welcome gift (onboarding) | 50 |
| Loot box drop (coins) | 5–30 |

### 4.2 Coin Sinks (Shop)

| Item | Cost | Type |
|------|------|------|
| Beginner Badge | 0 | Badge |
| Scholar's Quill | 50 | Badge |
| Emerald Ink | 75 | Name Color |
| Golden Frame | 100 | Avatar Frame |
| Ancient Map | 150 | Avatar Frame |
| Obsidian Theme | 200 | Theme |
| XP Booster (1h) | 30 | Consumable |
| Focus Potion | 20 | Consumable |
| Streak Freeze | 50 | Consumable |
| Quest Reroll | 15 | Consumable |
| Loot Box | 75 | Consumable |
| Alchemy Ticket | 15 | Consumable |
| Journey Theme | 50 | Theme |
| Night Owl Theme | 50 | Theme |
| Forest Theme | 100 | Theme |
| Ember Theme | 100 | Theme |
| Royal Theme | 200 | Theme |

### 4.3 Coin Economy

- Avg coin income: ~200/week for active users
- Total items to purchase: ~1,300 coins (one-time) + consumables (recurring)
- Coin sinks designed for long-term engagement: consumables create recurring spending

---

## 5. Quest System — `src/lib/gamification/quests/`

### 5.1 Quest Types

| Type | Rotation | Pool Size | User Gets |
|------|----------|-----------|-----------|
| **Daily** | Every calendar day | 9 quests | 3 random |
| **Weekly** | Every Monday | 13 quests | 3 random |
| **Monthly** | Every 1st of month | 3 quests | 1 random |
| **Chain** | Prerequisite-based | 3 chains | Sequential |

### 5.2 Quest Mechanic Types (7 total)

| Mechanic | How It Works | Example |
|----------|-------------|---------|
| **counter** | Count matching actions | "Create 1 note" |
| **time_limit** | Action within N minutes of quest assignment | "Write note in 15 min" |
| **streak_guard** | Keep streak ≥ current value | "Keep streak alive today" |
| **time_window** | Action within specific hours | "Write between 21:00-24:00" |
| **tag_variety** | Use N different tags | "Use 5 different tags" |
| **structure_score** | Notes with score ≥ threshold | "Create 3 notes with score ≥ 7" |
| **social** | Count guild messages | "Send 5 guild messages" |

### 5.3 All Seeded Quests (27 total)

#### Daily (9)
| Quest | Mechanic | Criteria | XP | Coins |
|-------|----------|----------|-----|-------|
| Daily Scribe | counter | Create 1 note | 20 | 5 |
| Word Weaver | counter | Write 500 words | 30 | 10 |
| Daily Login | counter | Login today | 10 | 5 |
| Open Book | counter | Make 1 note public | 15 | 5 |
| AI Scribe | counter | AI summarize 1 note | 20 | 5 |
| Knowledge Keeper | counter | Review 1 old note | 15 | 3 |
| Speed Writer | time_limit | Write note in 15 min | 25 | 8 |
| Streak Guardian | streak_guard | Keep streak | 15 | 5 |
| Night Owl Bonus | time_window | Write 21:00-24:00 | 20 | 8 |

#### Weekly (13)
| Quest | Mechanic | Criteria | XP | Coins |
|-------|----------|----------|-----|-------|
| Prolific Author | counter | Create 10 notes | 100 | 50 |
| Guild Founder | counter | Join/create guild | 150 | 30 |
| Knowledge Sharer | counter | Make 3 notes public | 80 | 25 |
| Tavern Regular | counter | Login 5 days | 80 | 20 |
| Public Library | counter | Make 10 notes public | 120 | 40 |
| Architect | counter | 5 structured notes | 50 | 15 |
| Scribe Weekly | counter | Review 5 notes | 60 | 15 |
| Tag Explorer | tag_variety | Use 5 different tags | 60 | 20 |
| Quality Craftsman | structure_score | 3 notes score ≥ 7 | 80 | 25 |
| Guild Chatter | social | 5 guild messages | 40 | 15 |
| Knowledge Recycler | counter (add_link) | Improve duplicate note | 15 | 5 |
| (Chain) Apprentice Writer | counter | Create 10 notes | 80 | 25 |
| (Chain) Sage's Archive | counter | Review 20 notes | 120 | 40 |

#### Monthly (3)
| Quest | Mechanic | Criteria | XP | Coins |
|-------|----------|----------|-----|-------|
| Cartographer | counter | Create 20 notes | 200 | 50 |
| Chronicler | counter | Write 10,000 words | 300 | 80 |
| Archaeologist | counter | Review 15 notes | 250 | 60 |

### 5.4 Quest Flow

```
Login → rotateQuestsIfNeeded()
  ├── Check if user has quests for this period
  ├── If not: expire old → assign 3 new random
  └── All in $transaction, with FOR UPDATE lock

User performs action → checkQuestProgress()
  ├── Match active quests by actionType
  ├── Apply mechanic-specific increment logic
  ├── If progress >= criteria.count → mark "completed"
  └── Return progress array for UI update

User claims reward → POST /api/quests/[id]/claim
  ├── Atomic guard: updateMany status=completed→claimed (count must = 1)
  ├── processAction("complete_quest", xpReward, coinReward)
  └── Returns gamification result
```

### 5.5 Quest Chains

| Chain | Step 1 | Step 2 | Step 3 |
|-------|--------|--------|--------|
| **Path of the Scribe** | Daily Scribe | Apprentice Writer | (future) |
| **Wisdom Seeker** | Knowledge Keeper | Sage's Archive | (future) |

Chains use `unlockQuestId` field — Step N only appears when Step N-1 is completed.

---

## 6. Achievement System — `src/lib/gamification/achievements/achievement-checker.ts`

### 6.1 All Achievements (10 seeded)

| Achievement | Criteria | XP Reward | Unlocks |
|-------------|----------|-----------|---------|
| **First Scroll** | Create 1 note | 50 | Beginner Badge (free) |
| **Scribe Apprentice** | Create 50 notes | 200 | — |
| **Streak Master** | 7-day login streak | 100 | 1× Streak Freeze |
| **Wordsmith** | Write 10,000 words | 300 | Note Sparkle effect |
| **Guild Leader** | Create a guild | 150 | "Guild Master" Nameplate |
| **Quest Champion** | Complete 30 quests | 250 | Gold Confetti effect |
| **AI Scholar** | AI summarize 1 note | 50 | — |
| **Historian** | Review 50 old notes | 100 | — |
| **Builder** | Create 100 structured notes | 200 | — |
| **Ambassador** | 10 shared note views | 150 | — |

### 6.2 Auto-Unlock Items

When an achievement is first unlocked, related cosmetic items are automatically granted via `UserInventory.upsert()`.

---

## 7. Boss Fight System — `src/lib/boss/`

### 7.1 Boss Types

| Type | Spawn Trigger | HP Formula | Reward |
|------|--------------|------------|--------|
| **Daily Minion** | First login each day | 50 + level × 10 | 20 XP, 10 coins |
| **Weekly Elite** | First login each week | 200 + level × 50 | 100 XP, 30 coins + loot |
| **Custom Boss** | User creates via Challenges | Configurable | User-set |
| **Guild Raid** | Guild owner summons | 1,000 + members × 200 | Per-player loot roll |

### 7.2 Damage Sources

| Source | Base Damage | Formula |
|--------|------------|---------|
| **Write Note** | 5 | `5 × max(1, structureScore / 5)` |
| **Complete Quiz** | 10 | `10 × (1 + accuracy) × (1 + streak × 0.2)` |
| **Daily Habit** | 3 | `3 + streak` |
| **Combo Bonus** | ×1.5 | 3+ attacks in 24h (server-side) |

### 7.3 Loot Table (Weekly Boss)

| Rarity | Drop Rate | Items |
|--------|-----------|-------|
| Common | 70% | 30 bonus coins |
| Uncommon | 20% | XP Booster |
| Rare | 8% | Random badge |
| Epic | 2% | Random avatar frame |

All damage is atomic: `$executeRaw` UPDATE with `GREATEST(0, hp - dmg)`. Status completion checked inside `$transaction`.

---

## 8. Streak System

### 8.1 Calculation — `src/routes/api/auth/login.ts`

```
1. Query AuditLog for daily_login entries (last 365 days, excluding today)
2. Deduplicate by date, sort descending
3. Count consecutive days backwards from yesterday
4. If streak === 0, check for Streak Freeze consumable
5. If freeze found → consume it → set streak = user.streak (preserve)
6. Otherwise → set streak = 0
7. On successful login → streak + 1
```

### 8.2 Streak Rewards

- Login XP: 5 + streak × 5
- At risk notification: after 21:00, if no note today
- Streak Freeze: auto-consumed when streak would break
- Streak milestones: 7-day badge, 30-day boosted rewards

---

## 9. Shop & Cosmetics

### 9.1 Item Types

| Type | Can Equip? | Effect |
|------|-----------|--------|
| **badge** | Yes (Profile) | Icon next to username |
| **avatar_frame** | Yes (Profile) | Border around avatar |
| **name_color** | Yes (Profile) | Custom username color |
| **theme** | Yes (Global) | CSS variable override for entire UI |
| **consumable** | No (Activate) | Timed effect (XP boost, focus, etc.) |

### 9.2 Consumable Effects

| Item | Effect | Duration |
|------|--------|----------|
| XP Booster | 2× all XP | 1 hour |
| Focus Potion | 2× word-count bonus | 30 min |
| Streak Freeze | Auto-consume when streak breaks | One-time |
| Quest Reroll | Replace 1 active quest | One-time |
| Loot Box | Random cosmetic item | One-time |
| Alchemy Ticket | Play Potion Match minigame | One-time |

### 9.3 Theme System

7 themes stored with CSS variables matching `app.css @theme` block:
- Tavern (default, warm parchment)
- Scholar (bright academic)
- Journey (adventurer tones)
- Night Owl (dark minimalist)
- Forest (nature green)
- Ember (fire warmth)
- Royal (purple gold)

Equip: `POST /api/users/theme` → unequip all → equip selected → save to localStorage.
Light/Dark: clear inline overrides for light mode; re-apply for dark mode.

---

## 10. Rewards & Feedback

### 10.1 Reward Popup — `src/components/gamification/RewardPopup.tsx`

Shows on every XP/coin gain:
- Slide-in animation from top-right
- Contextual message from `messages.ts` (per action type)
- XP amount + coin amount
- Level-up announcement with new title
- Achievement unlock with icon
- Auto-dismiss after 3.5 seconds

### 10.2 Level-Up Modal — `src/components/gamification/LevelUpModal.tsx`

Full-screen celebration when user levels up:
- New level number + new title
- Confetti animation
- Stats summary
- "Continue" button to dismiss

### 10.3 Contextual Messages — `src/lib/gamification/messages.ts`

Each action type has a custom message template:
```
create_note: "New scroll added to your collection! +10 XP"
daily_login: "7-day streak! The tavern welcomes you back. +35 XP"
complete_quest: "Quest complete: Daily Scribe! +20 XP, +5 coins"
review_note: "Reviewing old knowledge keeps the mind sharp! +5 XP"
structured_note: "A well-structured scroll — a true scholar's work! +8 XP"
```

---

## 11. Path System — `src/lib/path-unlocks.ts`

### 11.1 Student Path (14 features)
| Lv | Feature |
|----|---------|
| 1 | Notes |
| 2 | Daily Quests |
| 4 | AI Quiz (⚡ earliest) |
| 5 | Spaced Repetition |
| 7 | Boss Fight (⚡ earliest) |
| 8 | AI Summarize |
| 10 | Habit Tracker |
| 12 | Guilds |
| 14 | Analytics |
| 16 | Markdown Export |
| 18 | Custom Themes |
| 20 | Raid Boss |

### 11.2 Professional Path (14 features)
| Lv | Feature |
|----|---------|
| 1 | Notes |
| 2 | Daily Quests |
| 4 | AI Summarize (⚡ earliest) |
| 5 | Markdown Export (⚡ earliest) |
| 7 | Habit Tracker (⚡ earliest) |
| 8 | AI Quiz |
| 10 | Guilds (⚡ earliest) |
| 12 | Boss Fight |
| 14 | Analytics |
| 16 | Spaced Repetition |
| 18 | Custom Themes |
| 20 | Raid Boss |

### 11.3 Journaler Path (14 features)
| Lv | Feature |
|----|---------|
| 1 | Notes |
| 2 | Daily Quests |
| 3 | Daily Prompts (⚡ exclusive) |
| 4 | Streak Boost (⚡ exclusive) |
| 6 | Custom Themes (⚡ earliest) |
| 8 | AI Summarize |
| 10 | Guilds |
| 12 | AI Quiz |
| 14 | Habit Tracker |
| 16 | Boss Fight |
| 18 | Analytics |
| 20 | Markdown Export |

### 11.4 Path-Specific Widgets (Tavern Hall)

| Path | Widget |
|------|--------|
| Student | Active Bosses ❤️ + Pending Quizzes 🧠 |
| Professional | Smart Inbox Digest + Focus Sprint Timer + Projects |
| Journaler | Mood Picker + Gratitude Garden |

---

## 12. Anti-Exploitation Measures

| Layer | Mechanism | Impact |
|-------|-----------|--------|
| **Diminishing Returns** | XP/note drops 10→7→5→3→1→0 per daily count | Prevents note spam farming |
| **Quality Gate** | structureScore < 3 → 0 XP | Blocks empty/low-quality notes |
| **Duplicate Detection** | Jaccard similarity ≥ 0.8 → 0 XP | Blocks copy-paste farming |
| **Delete Penalty** | -5 XP for quick-deleting short notes | Blocks create/delete cycles |
| **Row Locking** | SELECT FOR UPDATE in every processAction | Prevents concurrent XP race conditions |
| **Atomic Quest Claim** | updateMany with status guard | Prevents double-claiming rewards |
| **Boss HP Atomic** | $executeRaw with GREATEST | Prevents negative HP overflow |
| **Server-Side Combo** | Combo multiplier from DB, not client | Prevents client-trust exploit |
| **Attack Cooldown** | 1 attack per 30s per boss | Prevents script farming |

---

## 13. Gamification Preferences

Users choose their style during onboarding:

| Style | Effect |
|-------|--------|
| **competitive** | All features enabled, XP bar visible, guild + leaderboard visible |
| **balanced** | Default — all features |
| **collaborative** | Focus guild goals, team rewards |
| **solo** | Hide guild features |
| **minimal** | Hide XP bar, simplified quests |

Controlled by `User.gamificationStyle` field. UI adapts via conditional rendering in sidebar and layout.

---

## 14. Data Points Tracked (AuditLog)

Every gamification event is tracked with:
- `actionType` — Which action was performed
- `xpChange` — XP gained/lost
- `coinChange` — Coins gained/lost
- `metadata` — JSON with event-specific details (noteId, questId, bossId, structureScore, wordCount, etc.)
- `levelBefore` — User's level before the action
- `levelAfter` — User's level after the action
- `createdAt` — Timestamp

This enables full analytics: XP history, quest completion rates, boss kill stats, feature usage distribution, A/B test metrics.

---

## 15. Quick Reference: Files

| Area | Path |
|------|------|
| Engine | `src/lib/gamification/engine.ts` |
| XP Calculator | `src/lib/gamification/calculators/xp-calculator.ts` |
| Coin Calculator | `src/lib/gamification/calculators/coin-calculator.ts` |
| Level Calculator | `src/lib/gamification/calculators/level-calculator.ts` |
| Constants | `src/lib/gamification/constants.ts` |
| Messages | `src/lib/gamification/messages.ts` |
| Quest Checker | `src/lib/gamification/quests/quest-checker.ts` |
| Quest Rotation | `src/lib/gamification/quests/quest-rotation.ts` |
| Achievement Checker | `src/lib/gamification/achievements/achievement-checker.ts` |
| Boss Spawner | `src/lib/boss/spawner.ts` |
| Boss Damage | `src/lib/boss/damage.ts` |
| Anti-Spam | `src/lib/gamification/constants.ts` (thresholds), `src/lib/analytics/quality-scorer.ts` |
