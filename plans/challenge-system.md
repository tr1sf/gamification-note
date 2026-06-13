# Challenge System — Plan

> **Ngày:** 2026-06-12
> **Trạng thái:** Kế hoạch (chưa triển khai)
> **Ưu tiên:** Sau gamification-v2 (Phase B)

---

## 1. Concept

Người dùng tạo "Challenge" (mục tiêu/chướng ngại) và định nghĩa các "Action" (hành động) để tiến tới mục tiêu. Mỗi action hoàn thành = tiến độ tăng. Khi đạt 100% = Challenge hoàn thành, nhận reward.

**Khác với "Boss Fight" gốc:** Concept trung lập, không combat, customizable, phù hợp mọi đối tượng.

---

## 2. Terminology

| Term | Ý nghĩa |
|------|---------|
| **Challenge** | Mục tiêu/cột mốc người dùng muốn đạt |
| **Action** | Hành động cụ thể để tiến tới Challenge |
| **Progress** | Tiến độ hoàn thành (thanh ngang / segmented) |
| **Complete** | Hoàn thành Challenge |
| **Reward** | Phần thưởng (XP, coins, theme, badge) |

---

## 3. Visual Themes (6 options)

| Theme | Icon | Progress Visual | Action Button | Completed State |
|-------|------|----------------|---------------|-----------------|
| **🌱 Growth** | Seed → Tree → Flower | Cây mọc lên theo stages | "Nurture" | Cây ra hoa |
| **🧭 Journey** | Map path | Nhân vật di chuyển trên path | "Advance" | Đến đích, cắm cờ |
| **🧩 Puzzle** | Jigsaw pieces | Các mảnh ghép lắp dần | "Place" | Bức tranh hoàn chỉnh |
| **⭐ Constellation** | Stars + lines | Các ngôi sao sáng dần | "Illuminate" | Chòm sao hoàn chỉnh |
| **🏛️ Museum** | Exhibit shelves | Hiện vật xuất hiện trên kệ | "Curate" | Gian triển lãm đầy đủ |
| **📚 Scholar** | Bookshelf | Sách lấp đầy kệ | "Study" | Giá sách đầy sách |

---

## 4. Image Options (Mixed B + D)

### Option B: Upload từ máy
- File input `.png, .jpg, .jpeg`, max 2MB
- Resize to 256x256
- Store in Supabase Storage (existing)
- Generate public URL → lưu vào `iconImageUrl`

### Option D: Emoji
- Sử dụng native emoji picker (web `emoji-picker-element` hoặc custom grid)
- Lưu emoji string (e.g., "🌱") vào `iconEmoji`
- Hiển thị as-is trong UI

### UI Toggle
```
[📷 Upload image]  [😊 Pick emoji]

Khi chọn Upload: hiện file input
Khi chọn Emoji:   hiện emoji grid
Khi chọn xong:    preview icon
```

---

## 5. Database Schema

```prisma
model Challenge {
  id          String   @id @default(uuid()) @db.Uuid
  userId      String   @db.Uuid
  title       String
  description String?
  theme       String   @default("growth")    // growth | journey | puzzle | star | museum | scholar
  difficulty  String   @default("medium")    // easy | medium | hard | epic

  // Visual
  iconType    String   @default("emoji")     // emoji | image
  iconEmoji   String?                        // e.g. "🌱"
  iconImageUrl String?                       // User upload URL

  // Progress
  targetProgress Int    @default(100)
  currentProgress Int   @default(0)
  progressUnit  String  @default("percent")  // percent | count | custom (e.g., "notes")

  // Status
  status      String   @default("active")    // active | completed | paused | archived
  isPublic    Boolean  @default(false)       // Show in public gallery

  // Reward
  rewardXp    Int      @default(50)
  rewardCoins Int      @default(10)
  rewardThemeId String? @db.Uuid             // Unlock theme when completed

  // Templates
  isTemplate  Boolean  @default(false)       // Pre-made challenge template

  // Meta
  completedAt DateTime?
  pausedAt    DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user   User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  actions ChallengeAction[]

  @@index([userId, status])
  @@index([isPublic, status])
  @@index([isTemplate])
}

model ChallengeAction {
  id            String   @id @default(uuid()) @db.Uuid
  challengeId   String   @db.Uuid
  title         String
  description   String?
  
  // Visual
  iconType      String   @default("emoji")   // emoji | image
  iconEmoji     String?                      // e.g. "📖"
  
  // Progress
  progressValue Int      @default(10)        // How much this action contributes
  order         Int      @default(0)         // Order in list
  
  // App integration (optional)
  linkedActionType String?                   // e.g. "create_note", "review_note", "ai_summarize", null = manual
  linkedTarget  Int?                         // How many (e.g., 3 notes)
  linkedProgress Int      @default(0)        // How many already done
  
  // Repeatable
  isRepeatable  Boolean  @default(false)     // Can be done multiple times
  maxRepeats    Int?                         // null = unlimited
  repeatCount   Int      @default(0)         // Times completed
  
  // Status
  status        String   @default("active")  // active | completed | paused
  completedAt   DateTime?
  createdAt     DateTime @default(now())
  
  challenge Challenge @relation(fields: [challengeId], references: [id], onDelete: Cascade)
  
  @@index([challengeId, order])
  @@index([status])
}

model ChallengeTemplate {
  id          String   @id @default(uuid()) @db.Uuid
  title       String
  description String
  theme       String   @default("growth")
  difficulty  String   @default("medium")
  iconEmoji   String?                      // Default emoji
  targetProgress Int    @default(100)
  rewardXp    Int      @default(50)
  rewardCoins Int      @default(10)
  defaultActions Json  @default("[]")     // Pre-defined action list
  usageCount  Int      @default(0)        // How many times used
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
}
```

---

## 6. Challenge Flow

### 6.1 Create Challenge
```
User clicks "New Challenge" → Form:
  1. Title: [text]
  2. Description: [textarea]
  3. Theme: [dropdown: Growth/Journey/Puzzle/Star/Museum/Scholar] + live preview
  4. Difficulty: [Easy/Medium/Hard/Epic]
  5. Visual: [Upload image] | [Pick emoji]
  6. Target progress: [number]
  7. Actions: [dynamic list]
     - Title: [text]
     - Description: [textarea]
     - Icon: [emoji picker]
     - Progress value: [number]
     - Linked action: [dropdown: None / Create Note / Review Note / AI Summarize / Make Public]
     - Repeatable: [checkbox]
  8. Reward: XP [number] Coins [number] Theme unlock? [dropdown]
  9. [Save] [Save as Template]
```

### 6.2 Complete Action (Flow)
```
User clicks "Complete" on an action:
  1. Nếu linkedActionType != null:
     - Kiểm tra xem user đã thực sự làm action chưa (query AuditLog / Note table)
     - Nếu chưa → show tooltip: "Create a [actionType] to complete this!"
     - Nếu đã → auto-complete
  2. Increment challenge.currentProgress += action.progressValue
  3. Mark action as completed (status = "completed", completedAt = now())
  4. If action.isRepeatable:
     - Reset action status → "active"
     - Increment repeatCount
     - Nếu maxRepeats reached → final complete
  5. Show progress animation (theme-specific)
  6. If challenge.currentProgress >= targetProgress:
     - Trigger challenge completion (see 6.3)
```

### 6.3 Challenge Completion
```
Challenge completed:
  1. Status = "completed"
  2. completedAt = now()
  3. Grant reward: XP + coins via grantReward()
  4. If rewardThemeId → unlock theme for user
  5. Create notification: "🎉 Challenge '[title]' completed!"
  6. Achievement check: "Challenge Completer" etc.
  7. Show completion modal with:
     - Theme-specific animation (big celebration)
     - Reward summary
     - Option: Share to guild / public
     - Option: Create next challenge
     - Option: Restart (archive + duplicate)
```

---

## 7. API Routes

```typescript
// src/routes/api/challenges/index.ts
POST   /api/challenges                // Create challenge
GET    /api/challenges                // List user's challenges
GET    /api/challenges/public         // Public gallery (for inspiration)
GET    /api/challenges/templates      // List templates

// src/routes/api/challenges/[id].ts
GET    /api/challenges/:id            // Get challenge detail + actions
PUT    /api/challenges/:id            // Update challenge
DELETE /api/challenges/:id            // Archive challenge
POST   /api/challenges/:id/restart    // Restart (archive + duplicate)
POST   /api/challenges/:id/complete   // Manual force-complete

// src/routes/api/challenges/[id]/actions.ts
POST   /api/challenges/:id/actions          // Add action
PUT    /api/challenges/:id/actions/:aid     // Update action
DELETE /api/challenges/:id/actions/:aid     // Remove action
POST   /api/challenges/:id/actions/:aid/complete  // Complete action
POST   /api/challenges/:id/actions/:aid/reset     // Reset action (repeatable)

// src/routes/api/challenges/templates.ts
POST   /api/challenges/templates            // Create template (admin)
GET    /api/challenges/templates            // List templates
DELETE /api/challenges/templates/:id        // Delete template
POST   /api/challenges/templates/:id/use   // Create challenge from template
```

---

## 8. Frontend Components

### 8.1 Pages
| Route | Component | Purpose |
|-------|-----------|---------|
| `/challenges` | `ChallengeListPage` | Active/completed/paused challenges |
| `/challenges/new` | `ChallengeCreatePage` | Create form |
| `/challenges/templates` | `ChallengeTemplatesPage` | Browse templates |
| `/challenges/[id]` | `ChallengeDetailPage` | Challenge detail + actions |
| `/challenges/public` | `ChallengePublicGallery` | Public challenges |

### 8.2 Components
| Component | Purpose |
|-----------|---------|
| `ChallengeCard` | Card in grid/list with progress bar |
| `ChallengeList` | Grid view + filter (active/completed/paused) |
| `ChallengeForm` | Create/edit form (shared) |
| `ThemeSelector` | 6 theme previews in grid |
| `ActionItem` | Action row: icon, title, progress, complete button |
| `ActionForm` | Inline form to add/edit action |
| `ActionList` | Sortable list of actions |
| `ProgressBar` | Theme-aware progress bar (linear/segmented) |
| `ProgressAnimation` | CSS animation for each theme |
| `CompletionModal` | Celebration modal with reward |
| `IconPicker` | Emoji grid + upload tab |
| `TemplateCard` | Template preview card |
| `RestartModal` | Confirm restart (archive + duplicate) |

### 8.3 Theme-Specific Progress Components
| Component | Visual |
|-----------|--------|
| `GrowthProgress` | 5 stages: seed → sprout → seedling → budding → flowering |
| `JourneyProgress` | Path with dots from A to B, character at current position |
| `PuzzleProgress` | Grid of pieces, revealed as progress increases |
| `StarProgress` | Canvas with stars, connected by lines when adjacent |
| `MuseumProgress` | Shelf with spots, items placed as progress increases |
| `ScholarProgress` | Bookshelf, books slide in from side |

### 8.4 Navigation Integration

Thêm vào sidebar trong `(app).tsx`:
```tsx
// Nhóm "Challenges"
<SidebarSection title="Challenges">
  <NavLink href="/challenges" icon="🏆">My Challenges</NavLink>
  <NavLink href="/challenges/templates" icon="📋">Templates</NavLink>
  <NavLink href="/challenges/public" icon="🌍">Gallery</NavLink>
</SidebarSection>
```

---

## 9. Gamification Integration

### 9.1 Actions
```typescript
// Thêm vào engine.ts ActionType union:
type ActionType = ... | "complete_challenge_action" | "complete_challenge" | "create_challenge";

// Khi complete action:
processAction({
  userId,
  actionType: "complete_challenge_action",
  metadata: {
    challengeId,
    challengeTitle,
    actionId,
    actionTitle,
    progressValue,
    theme,
  }
});

// Khi complete challenge:
processAction({
  userId,
  actionType: "complete_challenge",
  metadata: {
    challengeId,
    challengeTitle,
    theme,
    difficulty,
    xpReward,
    coinReward,
    totalActions,
  }
});

// Khi create challenge:
processAction({
  userId,
  actionType: "create_challenge",
  metadata: {
    challengeId,
    challengeTitle,
    theme,
    difficulty,
  }
});
```

### 9.2 XP/Coin Rewards
```typescript
// constants.ts additions:
export const XP_CREATE_CHALLENGE = 5;
export const XP_COMPLETE_CHALLENGE_ACTION = 5;
export const XP_COMPLETE_CHALLENGE_EASY = 50;
export const XP_COMPLETE_CHALLENGE_MEDIUM = 100;
export const XP_COMPLETE_CHALLENGE_HARD = 200;
export const XP_COMPLETE_CHALLENGE_EPIC = 500;

export const COIN_COMPLETE_CHALLENGE_ACTION = 1;
export const COIN_COMPLETE_CHALLENGE_EASY = 10;
export const COIN_COMPLETE_CHALLENGE_MEDIUM = 20;
export const COIN_COMPLETE_CHALLENGE_HARD = 50;
export const COIN_COMPLETE_CHALLENGE_EPIC = 100;
```

### 9.3 Achievements
| Achievement | Criteria | Reward |
|------------|----------|--------|
| **First Challenge** | Complete 1 challenge | +100 XP |
| **Challenge Master** | Complete 10 challenges | +300 XP |
| **Growth Seeker** | Complete 5 Growth challenges | +150 XP |
| **Journey Walker** | Complete 5 Journey challenges | +150 XP |
| **Jack of All Themes** | Complete 1 of each 6 themes | +500 XP |
| **Template Creator** | Create 3 public templates | +200 XP |
| **Challenge Designer** | Create 10 challenges | +250 XP |

### 9.4 Quests
| Quest | Type | Criteria | Reward |
|-------|------|----------|--------|
| **Daily Challenger** | daily | Complete 1 challenge action today | +15 XP, +5 coins |
| **Challenge Creator** | weekly | Create 3 challenges this week | +50 XP, +15 coins |
| **Theme Explorer** | weekly | Create challenges in 3 different themes | +80 XP, +20 coins |
| **Epic Quest** | monthly | Complete 1 epic challenge | +300 XP, +100 coins |

---

## 10. Public Gallery

### Concept
Người dùng có thể browse public challenges để lấy inspiration, fork về dùng.

```
GET /api/challenges/public?theme=growth&difficulty=medium&sort=popular&page=1
```

### UI
```
┌──────────────────────────────────────────────────────────┐
│  🌍 Challenge Gallery                                    │
│  [Filter: Theme ▾] [Difficulty ▾] [Sort: Popular ▾]      │
├──────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │ 🌱 Learn      │  │ 🧭 Write      │  │ ⭐ Master     │   │
│  │ React         │  │ Novel         │  │ Python        │   │
│  │              │  │              │  │              │   │
│  │ by @anh.dev  │  │ by @writer   │  │ by @coder    │   │
│  │ 15 users     │  │ 8 users      │  │ 23 users     │   │
│  │ Medium       │  │ Hard         │  │ Epic         │   │
│  │ [Use This]   │  │ [Use This]   │  │ [Use This]   │   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
└──────────────────────────────────────────────────────────┘
```

---

## 11. Implementation Order

| Phase | Feature | Files | Effort |
|-------|---------|-------|--------|
| **1** | DB Schema (Challenge, ChallengeAction, ChallengeTemplate) | Prisma migration | 30 min |
| **2** | Seed Templates (10 pre-made challenges) | `prisma/seed.ts` | 30 min |
| **3** | API Challenge CRUD | `routes/api/challenges/*.ts` (8 route files) | 2h |
| **4** | ProgressBar Component (6 themes) | `ProgressBar.tsx`, CSS modules | 2h |
| **5** | Challenge List Page | `challenges/index.tsx`, `ChallengeCard`, `ChallengeList` | 1.5h |
| **6** | Create Challenge Form | `challenges/new.tsx`, `ChallengeForm`, `ThemeSelector`, `ActionForm`, `IconPicker` | 2h |
| **7** | Challenge Detail Page | `challenges/[id].tsx`, `ActionItem`, `ActionList` | 2h |
| **8** | Gamification Integration | `engine.ts`, `constants.ts`, `xp-calc.ts`, `coin-calc.ts`, `seed.ts` | 1h |
| **9** | Public Gallery | `challenges/public.tsx`, API | 1.5h |
| **10** | Completion Animations (6 themes) | `CompletionModal.tsx`, CSS animations | 1.5h |
| **11** | Template System | `challenges/templates.tsx`, TemplateCard | 1h |
| **12** | Navigation & Polish | `(app).tsx` sidebar, toast messages, edge cases | 1h |

**Total: ~16 hours**

---

## 12. UI Mockups

### Challenge List Page
```
┌─────────────────────────────────────────────────────────────┐
│  🏆 My Challenges                             [+ New]      │
├─────────────────────────────────────────────────────────────┤
│  [Active] [Completed] [Paused] [From Template]             │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ 🌱 Learn      │  │ 🧭 Write      │  │ ⭐ Portfolio  │      │
│  │ React         │  │ Thesis        │  │ App           │      │
│  │              │  │              │  │              │      │
│  │ ▓▓▓▓░░░░░░  │  │ ▓▓▓▓▓▓▓░░░  │  │ ▓▓▓░░░░░░░  │      │
│  │  40%        │  │  70%        │  │  30%        │      │
│  │ 2/5 actions │  │ 5/7 actions │  │ 1/4 actions │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐                        │
│  │ 📚 Data       │  │ 🏛️ Collection│                        │
│  │ Structures    │  │ Art Gallery  │                        │
│  │              │  │              │                        │
│  │ ▓▓▓▓▓▓▓▓▓▓ │  │ ░░░░░░░░░░  │                        │
│  │  100% ✓     │  │  0%         │                        │
│  │ COMPLETED   │  │ 0/6 actions │                        │
│  └──────────────┘  └──────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

### Challenge Detail Page
```
┌─────────────────────────────────────────────────────────────┐
│  ← Back to Challenges                                      │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  🌱 Learn React                                     │   │
│  │  Build a complete React app from scratch            │   │
│  │                                                    │   │
│  │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░ 70%            │   │
│  │                                                    │   │
│  │  Difficulty: Medium  |  7/10 actions               │   │
│  │  Created: 2 weeks ago                              │   │
│  │  Reward: +100 XP, +20 Coins                        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Actions:                                              [Reorder]  [+ Add Action]
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ✓ 📖 Read React docs (Complete!)             10pts  │   │
│  │ ✓ 📝 Create components (Complete!)            10pts  │   │
│  │ ✓ 🎨 Style with Tailwind (Complete!)           10pts  │   │
│  │ ○ 📡 Add API calls                        10pts  │ [Complete]
│  │ ○ 🔄 Add routing                           10pts  │ [Complete]
│  │ ○ 🚀 Deploy app                            10pts  │ [Complete]
│  │ ─────────────────────────────────────────────────  │   │
│  │ ○ 📊 Add analytics                         10pts  │ [Complete]
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [Pause Challenge]  [Edit]  [Delete]                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 13. File Structure

```
src/
├── routes/
│   ├── (app)/
│   │   └── challenges/
│   │       ├── index.tsx            // Challenge list
│   │       ├── new.tsx              // Create challenge
│   │       ├── templates.tsx        // Browse templates
│   │       ├── public.tsx           // Public gallery
│   │       └── [id].tsx             // Challenge detail
│   └── api/
│       └── challenges/
│           ├── index.ts             // POST, GET
│           ├── public.ts            // GET public gallery
│           ├── templates.ts         // POST, GET templates
│           └── [id]/
│               ├── index.ts         // GET, PUT, DELETE
│               ├── complete.ts      // POST force-complete
│               ├── restart.ts       // POST restart
│               └── actions/
│                   ├── index.ts     // POST add action
│                   └── [aid]/
│                       ├── index.ts       // PUT, DELETE action
│                       ├── complete.ts    // POST complete action
│                       └── reset.ts       // POST reset action
├── components/
│   └── challenges/
│       ├── ChallengeCard.tsx
│       ├── ChallengeList.tsx
│       ├── ChallengeForm.tsx
│       ├── ThemeSelector.tsx
│       ├── ThemePreview.tsx
│       ├── ProgressBar.tsx          // Main component (theme-aware)
│       ├── ProgressAnimations.tsx   // CSS animation components
│       ├── ActionItem.tsx
│       ├── ActionForm.tsx
│       ├── ActionList.tsx
│       ├── CompletionModal.tsx
│       ├── IconPicker.tsx           // Emoji + upload tab
│       ├── TemplateCard.tsx
│       ├── RestartModal.tsx
│       └── theme-progress/
│           ├── GrowthProgress.tsx
│           ├── JourneyProgress.tsx
│           ├── PuzzleProgress.tsx
│           ├── StarProgress.tsx
│           ├── MuseumProgress.tsx
│           └── ScholarProgress.tsx
├── lib/
│   └── gamification/
│       ├── engine.ts                // Thêm action types
│       ├── constants.ts             // Thêm XP/coin constants
│       │   ├── xp-calculator.ts     // Thêm cases
│       │   └── coin-calculator.ts   // Thêm cases
│       └── seed-data/
│           └── challenge-templates.ts // 10 pre-made templates
├── stores/
│   └── challenges.ts               // Challenge store
```
