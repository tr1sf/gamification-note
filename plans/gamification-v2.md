# Gamification v2 — Dựa trên 8 Insights từ Nghiên cứu

> **Ngày:** 2026-06-11
> **Trạng thái:** Kế hoạch (chưa triển khai)
> **Sau khi hoàn thành Phase 1-4**

---

## Tổng quan

Sau khi phân tích 8 insights từ tài liệu nghiên cứu gamification, các thay đổi sau được đề xuất để nâng cấp hệ thống gamification của TavernoteX, tập trung vào:
- Động lực duy trì (Insight 1)
- Thưởng chất lượng thay vì số lượng (Insight 2)
- Personal progress thay vì cạnh tranh (Insight 3)
- Đa theme + narrative (Insight 4)
- Kết hợp intrinsic + extrinsic (Insight 5)
- Feedback tức thì (Insight 6)
- Cá nhân hóa (Insight 7)

---

## Các quyết định từ người dùng

| # | Quyết định |
|---|-----------|
| Theme | **Phát triển multi-theme system**: Tạo nhiều theme (Tavern, Journey, Scholar, Night Owl...) để người dùng mua trong shop hoặc unlock qua achievement |
| Leaderboard | **Ẩn hoàn toàn global leaderboard**, thay bằng personal progress + guild group goals |
| Knowledge Map | **Bỏ qua** |
| Khác | Implement tất cả feature còn lại trong đề xuất |
| DB | Không thêm `lastViewedAt`, dùng `updatedAt` để xác định note cũ (>7 ngày) |

---

## Phase A: Multi-Theme System (Insight 4)

### A.1 Theme Model
- Thêm bảng `Theme` vào Prisma schema:
  ```prisma
  model Theme {
    id          String  @id @default(uuid()) @db.Uuid
    name        String
    description String?
    imageUrl    String?
    coinCost    Int
    rarity      String  @default("common")   // common | rare | epic | legendary
    cssVariables Json  @default("{}")        // e.g. { "--bg": "#1a1a2e", "--accent": "#e2b96f" }
    isDefault   Boolean @default(false)
    isActive    Boolean @default(true)
    createdAt   DateTime @default(now())
    
    users UserTheme[]
  }
  
  model UserTheme {
    id        String    @id @default(uuid()) @db.Uuid
    userId    String    @db.Uuid
    themeId   String    @db.Uuid
    isEquipped Boolean  @default(false)
    unlockedAt DateTime @default(now())
    
    user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)
    theme Theme @relation(fields: [themeId], references: [id], onDelete: Cascade)
    
    @@unique([userId, themeId])
  }
  ```

### A.2 Default Themes (Seed)
- **Tavern (Default, Free)**: Current medieval parchment theme
  - Colors: `--bg: #1a1a2e`, `--accent: #d4a574`, `--surface: #2d2d3f`
- **Scholar (Free)**: Clean academic theme
  - Colors: `--bg: #faf8f2`, `--accent: #2c5282`, `--surface: #ffffff`
- **Journey (50 coins)**: Adventure/wanderer theme
  - Colors: `--bg: #0d1b2a`, `--accent: #e2b96f`, `--surface: #1b2838`
- **Night Owl (50 coins)**: Dark minimalist theme
  - Colors: `--bg: #0f0f23`, `--accent: #7c3aed`, `--surface: #1e1e3a`
- **Forest (100 coins)**: Nature green theme
  - Colors: `--bg: #1a2518`, `--accent: #4ade80`, `--surface: #243322`
- **Ember (100 coins)**: Fire/warmth theme
  - Colors: `--bg: #2d1a0e`, `--accent: #f97316`, `--surface: #3d2a18`
- **Royal (200 coins)**: Purple/gold premium theme
  - Colors: `--bg: #1a0a2e`, `--accent: #fbbf24`, `--surface: #2a1a3e`

### A.3 Theme Implementation
- `src/lib/themes/`: Theme engine — apply CSS variables to `:root` based on equipped theme
- `src/lib/themes/defaults.ts`: Default theme definitions
- `src/routes/api/themes/`: API CRUD for themes
- `src/routes/api/users/theme.ts`: Equip/purchase endpoint
- `src/components/shop/ThemePicker.tsx`: Shop UI — preview themes, purchase with coins
- `src/components/shop/ThemePreview.tsx`: Live preview component
- **Gamification action**: `purchase_theme` → achievement "Collector" (own 3 themes)

### A.4 Theme CSS Variable Contract
```css
:root {
  --color-bg: #1a1a2e;
  --color-surface: #2d2d3f;
  --color-surface-elevated: #3a3a52;
  --color-surface-hover: #35354a;
  --color-surface-border: #4a4a6a;
  --color-accent: #d4a574;
  --color-accent-hover: #c4955f;
  --color-ink-primary: #f0e6d3;
  --color-ink-secondary: #a0937d;
  --color-success: #4ade80;
  --color-success-bg: rgba(74, 222, 128, 0.1);
  --color-error: #f87171;
  --color-error-bg: rgba(248, 113, 113, 0.1);
  --color-xp: #fbbf24;
  --color-coin: #e2b96f;
  
  --font-display: "Cinzel", serif;
  --font-body: "Crimson Text", serif;
  
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  
  /* Theme-specific textures */
  --bg-texture: url("/textures/parchment.png");
}
```

---

## Phase B: Quality-Based Actions (Insight 2)

### B.1 New Action Types

Thêm vào `engine.ts`:

| Action | XP | Coins | Trigger |
|--------|-----|-------|---------|
| `review_note` | +5 | +1 | Mở note có `updatedAt` > 7 ngày so với hiện tại |
| `structured_note` | +8 | 0 | Tạo note dạng blocks (JSON) có ít nhất 1 heading + 1 paragraph |
| `export_note` | +3 | +1 | Export note ra .md/.txt/.html |
| `share_note` | +5 | +2 | Note được người khác view qua link share (server-side track) |
| `add_link` | +3 | 0 | Thêm external link hoặc cross-reference trong note |

### B.2 Implementation

**Files:**
- `src/lib/gamification/constants.ts`: Thêm `XP_REVIEW_NOTE=5`, `XP_STRUCTURED=8`, v.v.
- `src/lib/gamification/calculators/xp-calculator.ts`: Thêm cases
- `src/lib/gamification/calculators/coin-calculator.ts`: Thêm cases
- `src/routes/api/notes/[id].ts` (GET): Trigger `review_note` khi mở note cũ
- `src/routes/api/notes/[id].ts` (PUT): Trigger `structured_note` khi save block content
- `src/routes/api/notes/export.ts`: Trigger `export_note`
- `src/routes/share/[id].tsx`: Increment viewCount + trigger `share_note` cho owner

### B.3 New Quests + Achievements

**Quests:**
- "Librarian's Review" (daily): Review 1 old note → +15 XP, +3 coins
- "Architect" (weekly): Create 5 structured notes → +50 XP, +15 coins

**Achievements:**
- "Historian": Review 50 old notes → +100 XP
- "Builder": Create 100 structured notes → +200 XP
- "Ambassador": 10 shared note views → +150 XP

---

## Phase C: Hide Leaderboard + Personal Progress (Insight 1, 3)

### C.1 UI Changes
- **Xóa** route `src/routes/(app)/leaderboard.tsx` (hoặc redirect về `/progress`)
- **Xóa** menu item "Leaderboard" trong sidebar/header
- **Thêm** route `src/routes/(app)/progress.tsx` — Personal Progress Page

### C.2 Personal Progress Page

```
/progress
├── Weekly Summary Card
│   ├── Notes created this week: X
│   ├── Words written: Y
│   ├── Reviews done: Z
│   └── vs last week: +15% / -5%
├── Monthly Summary Card
│   ├── Total notes: X
│   ├── Total words: Y
│   ├── Best day: Thursday
│   └── Most used tag: #javascript
├── Streak Calendar (GitHub-style heatmap)
│   └── Last 90 days, intensity by note count
├── Quest Progress (existing, moved here)
└── Achievements Unlocked
```

### C.3 API Routes
- `GET /api/users/progress?period=week|month`: Aggregate stats
- `GET /api/users/progress/heatmap`: 90-day activity data

### C.4 Data Source
- Dùng `AuditLog` hiện có → count `create_note`, `write_words` theo ngày
- Dùng `Note` table → count, words per day

---

## Phase D: Guild Group Goals (Insight 3)

### D.1 Concept
Thay vì "Guild Leaderboard by XP", thay bằng "Guild Goals":
- Guild owner đặt goal hàng tuần: "Guild hoàn thành X review sessions", "Tạo Y notes"
- Tất cả members contribute vào goal
- Khi đạt goal → toàn bộ guild nhận bonus (XP, coins, guild badge)

### D.2 Schema
```prisma
model GuildGoal {
  id          String   @id @default(uuid()) @db.Uuid
  guildId     String   @db.Uuid
  title       String
  description String?
  targetCount Int
  currentCount Int    @default(0)
  startDate   DateTime
  endDate     DateTime
  rewardXp    Int      @default(50)
  rewardCoins Int      @default(15)
  isCompleted Boolean  @default(false)
  createdAt   DateTime @default(now())
  
  guild Guild @relation(fields: [guildId], references: [id], onDelete: Cascade)
  
  @@index([guildId, endDate])
}
```

### D.3 Flow
- Guild owner/admin creates goal
- Mỗi lần member làm action → check các active `GuildGoal` và increment `currentCount`
- Khi `currentCount >= targetCount` → `isCompleted = true`, grant reward cho tất cả members
- Notification: "🎉 [Guild Name] đã đạt goal '[Goal Title]'! +50 XP bonus!"

---

## Phase E: Gamification Preferences (Insight 7)

### E.1 Schema Addition
Thêm field vào User model:
```prisma
gamificationStyle String @default("balanced") // competitive | collaborative | solo | minimal | balanced
```

### E.2 Preferences UI
- Trang `/settings/gamification`:
  - **Competitive**: Show ranking, guild goals, challenge quests
  - **Collaborative**: Focus guild goals, team rewards, shared progress
  - **Solo**: Personal progress only, hide guild features
  - **Minimal**: Hide XP bar, chỉ streak + basic notifications
  - **Balanced** (default): All features enabled

### E.3 Adaptive UI
- Components check `user().gamificationStyle`:
  - XPBar: hidden in "minimal" mode
  - Guild tab: hidden in "solo" mode
  - Quest board: simplified in "minimal" mode

---

## Phase F: Rich Immediate Feedback (Insight 6)

### F.1 Contextual Toast Messages
Thay vì "XP +10" generic:
```
"📜 Note mới đã vào bộ sưu tập! +10 XP"
"📐 Note có cấu trúc rõ ràng! +8 XP"  
"🔍 Ôn lại kiến thức cũ — thông thái! +5 XP"
"✨ AI đã trích xuất 3 ý chính cho bạn! +15 XP"
"📤 Note đã được xuất — chuẩn bị chia sẻ! +3 XP"
"👁️ Note của bạn vừa có người đọc! +5 XP"
```

### F.2 Implementation
- `processAction()` trả về thêm `message: string`
- Components đọc `result.message` và hiển thị trong toast
- `src/lib/gamification/messages.ts`: Map action → message templates

---

## Phase G: Long-Term Quest Loops (Insight 1)

### G.1 Monthly Quest Pool
Thêm vào `quest-rotation.ts`:

```ts
// Monthly rotation — 1 fixed quest, không rotate trong tháng
async function rotateMonthlyQuests(tx, userId) {
  // Kiểm tra đã assign trong tháng chưa
  // Nếu chưa → assign 1 quest ngẫu nhiên từ monthly pool
}
```

### G.2 Monthly Quests (Seed)
- "Cartographer" (monthly): Create 20 notes this month → +200 XP, +50 coins
- "Chronicler" (monthly): Write 10000 words this month → +300 XP, +80 coins
- "Archaeologist" (monthly): Review 15 old notes this month → +250 XP, +60 coins

### G.3 Weekly Review Quests
- "Weekly Reflection" (weekly): Review 5 notes from this week → +80 XP
- "Insight Harvester" (weekly): Use AI summarize 3 times this week → +60 XP

---

## Phase H: Knowledge Insights (Insight 5)

### H.1 `/insights` Page
Trang phân tích thống kê cá nhân (no visualization map):
```
/insights
├── Top Tags Card: "Bạn viết nhiều về: #javascript (45 notes), #design (23 notes)"
├── Productivity Card: "Ngày sáng tạo nhất: Thứ 3 (35% total notes)"
├── Writing Speed: "Tốc độ trung bình: 234 từ/ngày tuần này (+12% vs. tuần trước)"
├── Most Reviewed: "Note được xem lại nhiều nhất: [title] (7 lần)"
├── Streak History: "Chuỗi dài nhất: 14 ngày (3/2026)"
└── Monthly Comparison: "Tháng này vs. tháng trước: +8 notes, +3400 words"
```

### H.2 API
- `GET /api/users/insights`: Aggregated analytics

---

## Implementation Order (Ưu tiên)

| Phase | Feature | Effort | Impact | Order |
|-------|---------|--------|--------|-------|
| **E** | Gamification Preferences | Small | Medium | 1st (dễ nhất, tạo nền cho các phase sau) |
| **B** | Quality Actions | Medium | High | 2nd (giải quyết Insight 2 ngay) |
| **F** | Rich Feedback | Small | High | 3rd (dễ, impact lớn) |
| **C** | Personal Progress | Medium | High | 4th (thay thế leaderboard) |
| **G** | Long-Term Quest Loops | Medium | High | 5th (Insight 1) |
| **A** | Multi-Theme System | Large | High | 6th (phức tạp nhất, nhiều UI) |
| **D** | Guild Group Goals | Medium | Low | 7th (cần guild active) |
| **H** | Knowledge Insights | Medium | Medium | 8th (analytics) |

---

## Tóm tắt files sẽ tạo/sửa

### Files mới
- `src/routes/(app)/progress.tsx` — Personal progress page
- `src/routes/(app)/insights.tsx` — Analytics page
- `src/routes/(app)/settings/gamification.tsx` — Preferences page
- `src/routes/(app)/shop/themes.tsx` — Theme shop
- `src/routes/api/users/progress.ts` — Progress API
- `src/routes/api/users/insights.ts` — Insights API
- `src/routes/api/users/theme.ts` — Theme equip/purchase
- `src/routes/api/themes/index.ts` — Theme CRUD
- `src/routes/api/guilds/[id]/goals.ts` — Guild goals API
- `src/lib/gamification/messages.ts` — Feedback message templates
- `src/lib/themes/engine.ts` — Theme CSS variable engine
- `src/lib/themes/defaults.ts` — Default theme configurations
- `src/components/shop/ThemePicker.tsx` — Shop UI
- `src/components/shop/ThemePreview.tsx` — Theme preview
- `src/components/progress/WeekSummary.tsx`
- `src/components/progress/StreakCalendar.tsx`
- `src/components/progress/MonthCompare.tsx`
- `src/components/insights/TagCloud.tsx`
- `src/components/insights/ProductivityCard.tsx`

### Files sửa
- `prisma/schema.prisma` — Thêm Theme, UserTheme, GuildGoal models; thêm gamificationStyle vào User
- `prisma/seed.ts` — Seed themes, monthly quests, new achievements
- `src/lib/gamification/engine.ts` — Thêm action types, return message
- `src/lib/gamification/constants.ts` — Thêm XP/coin constants
- `src/lib/gamification/calculators/xp-calculator.ts` — Thêm cases
- `src/lib/gamification/calculators/coin-calculator.ts` — Thêm cases
- `src/lib/gamification/quests/quest-rotation.ts` — Thêm monthly rotation
- `src/routes/api/notes/[id].ts` (GET) — Trigger review_note
- `src/routes/api/notes/[id].ts` (PUT) — Trigger structured_note
- `src/routes/api/notes/export.ts` — Trigger export_note
- `src/routes/share/[id].tsx` — Track share views
- `src/routes/(app)/leaderboard.tsx` — XÓA hoặc redirect
- `src/routes/(app)/layout.tsx` — Remove leaderboard link, add progress/insights/themes links
- `src/stores/user.ts` — Thêm gamificationStyle vào GamificationState
- `src/components/gamification/XPBar.tsx` — Check preference visibility
