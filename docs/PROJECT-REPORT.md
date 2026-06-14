# BÁO CÁO ĐỒ ÁN TỐT NGHIỆP

## TavernoteX — Ứng dụng Ghi chú Gamified với Chủ đề Medieval Tavern

**Sinh viên thực hiện:** Phạm Đình Minh Trí  
**Ngày hoàn thành:** 06/2026  

---

## Mục lục

1. [Phần 1: Tổng quan dự án](#phần-1-tổng-quan-dự-án)
   - [1.1. Mục đích và bài toán giải quyết](#11-mục-đích-và-bài-toán-giải-quyết)
   - [1.2. Tính năng chính](#12-tính-năng-chính)
   - [1.3. Luồng người dùng chính](#13-luồng-người-dùng-chính)
2. [Phần 2: Kiến trúc hệ thống](#phần-2-kiến-trúc-hệ-thống)
   - [2.1. Sơ đồ kiến trúc tổng thể](#21-sơ-đồ-kiến-trúc-tổng-thể)
   - [2.2. Cấu trúc thư mục chi tiết](#22-cấu-trúc-thư-mục-chi-tiết)
   - [2.3. Công nghệ sử dụng](#23-công-nghệ-sử-dụng)
3. [Phần 3: Backend](#phần-3-backend)
   - [3.1. Database Schema](#31-database-schema)
   - [3.2. API Routes](#32-api-routes)
   - [3.3. Auth Flow](#33-auth-flow)
   - [3.4. Gamification Engine](#34-gamification-engine)
   - [3.5. Real-time (Socket.io)](#35-real-time-socketio)
   - [3.6. Hệ thống Social](#36-hệ-thống-social)
4. [Phần 4: Frontend](#phần-4-frontend)
   - [4.1. Cấu trúc Component](#41-cấu-trúc-component)
   - [4.2. State Management](#42-state-management)
   - [4.3. Routing](#43-routing)
   - [4.4. UI/UX & Theme](#44-uiux--theme)
   - [4.5. Block Editor](#45-block-editor)
5. [Phần 5: Triển khai](#phần-5-triển-khai)
   - [5.1. Các bước cài đặt local](#51-các-bước-cài-đặt-local)
   - [5.2. Cấu hình môi trường](#52-cấu-hình-môi-trường)
   - [5.3. Database Setup](#53-database-setup)
   - [5.4. Deploy lên Railway](#54-deploy-lên-railway)
6. [Phần 6: Kết luận](#phần-6-kết-luận)
   - [6.1. Những gì đã làm được](#61-những-gì-đã-làm-được)
   - [6.2. Hạn chế và hướng phát triển](#62-hạn-chế-và-hướng-phát-triển)

---

## Phần 1: Tổng quan dự án

### 1.1. Mục đích và bài toán giải quyết

Trong thời đại số, việc ghi chú là một hoạt động thiết yếu phục vụ học tập và làm việc. Tuy nhiên, các ứng dụng ghi chú hiện nay (Notion, Obsidian, Google Keep) thường thiếu yếu tố tạo động lực để người dùng duy trì thói quen ghi chú lâu dài. Nhiều người dùng bắt đầu hăng hái nhưng nhanh chóng bỏ cuộc vì thiếu cảm giác tiến bộ và ghi nhận.

**TavernoteX** được xây dựng với mục tiêu giải quyết vấn đề trên bằng cách kết hợp **gamification** (trò chơi hóa) vào ứng dụng ghi chú. Người dùng sẽ nhập vai như những "nhà thám hiểm tri thức" (adventurer), viết ghi chú (scrolls), hoàn thành nhiệm vụ (quests), thăng cấp (level up), tham gia bang hội (guilds) và nhận phần thưởng (rewards) — tất cả trong một không gian mang phong cách quán rượu (tavern) thời trung cổ.

**Bài toán cụ thể:**
- Làm thế nào để duy trì động lực ghi chú cho người dùng trong dài hạn?
- Làm thế nào để biến việc ghi chú từ một công việc "phải làm" thành một hoạt động thú vị?
- Làm sao để áp dụng các cơ chế game (XP, level, quest, achievement) vào ứng dụng năng suất mà không gây xao nhãng?

### 1.2. Tính năng chính

Dự án được chia làm 4 nhóm tính năng chính:

#### A. Note CRUD (Quản lý ghi chú)
- **Block Editor:** Trình soạn thảo dạng block (giống Notion) hỗ trợ 11 loại block: text, heading (1/2/3), quote, divider, bullet_list, numbered_list, code, callout, todo
- **Tạo / Đọc / Sửa / Xóa** ghi chú với phân trang (cursor-based pagination)
- **Soft Delete:** Ghi chú bị xóa được lưu vào thùng rác, có thể khôi phục
- **Duplicate:** Sao chép nhanh một ghi chú
- **Search:** Tìm kiếm toàn văn (full-text search) qua PostgreSQL tsvector, fallback ILIKE
- **Public Notes:** Chia sẻ ghi chú công khai qua link
- **Export:** Xuất ghi chú ra Markdown hoặc HTML
- **Phiên bản (version):** Phát hiện xung đột khi nhiều phiên cùng chỉnh sửa
- **Tags và Categories:** Phân loại ghi chú

#### B. Gamification (Trò chơi hóa)
- **Hệ thống XP & Level:** Người dùng nhận XP khi tạo ghi chú, viết từ, đăng nhập hàng ngày, công khai ghi chú. Công thức level: `level = floor(sqrt(xp / 100))`
- **Hệ thống Coin:** Nhận coin qua đăng nhập hàng ngày và hoàn thành quest
- **Danh hiệu (Titles):** Tự động thay đổi theo level (Novice Scribe → Apprentice Scribe → ... → Tavern Sage)
- **Streak:** Theo dõi chuỗi ngày đăng nhập liên tục, thưởng XP bonus
- **Quests (Nhiệm vụ):** Nhiệm vụ hàng ngày (daily) và hàng tuần (weekly), tự động xoay vòng
- **Achievements (Thành tựu):** Mốc thành tựu (First Scroll, Wordsmith, Streak Master, v.v.)
- **Audit Log:** Ghi lại mọi thay đổi XP/Coin để kiểm tra

#### C. Social (Xã hội)
- **Guilds (Bang hội):** Tạo/tham gia/rời guild, giới hạn 50 thành viên
- **Guild Chat:** Trò chuyện real-time trong guild qua Socket.io (rate limit 10 msg/10s)
- **Guild Tasks:** Chủ guild/admin giao task cho thành viên, có review approve/reject
- **Guild Notes:** Chia sẻ ghi chú trong guild
- **Leaderboard:** Bảng xếp hạng toàn cầu và trong guild, cache 60 giây
- **Hệ thống mời:** Mỗi guild có invite code riêng

#### D. Các tính năng bổ trợ
- **Habit Tracker (Daily Rituals):** Theo dõi thói quen cá nhân với streak riêng
- **Shop:** Mua vật phẩm trang trí (cosmetic items) bằng coin
- **Profile:** Trang cá nhân với stats, achievements, inventory
- **Notifications:** Thông báo real-time (level up, achievement, quest complete)
- **Dark/Light Theme:** Hỗ trợ giao diện sáng/tối với theme tavern
- **Rate Limiting:** Giới hạn request (token bucket): login 5/phút, register 5/30phút

### 1.3. Luồng người dùng chính

```mermaid
flowchart TD
    A[Trang chủ] --> B{Đã đăng nhập?}
    B -->|Chưa| C[Đăng ký]
    B -->|Chưa| D[Đăng nhập]
    C --> E[Tavern Hall]
    D --> E
    
    E --> F[Viết Scroll mới]
    E --> G[Xem Scrolls của tôi]
    E --> H[Bảng Quest]
    E --> I[Guilds]
    E --> J[Leaderboard]
    E --> K[Profile]
    E --> L[Shop]
    E --> M[Daily Rituals]
    
    F --> N{Block Editor}
    N --> O[Nhận XP + Kiểm tra Quest]
    O --> P{Cập nhật Level?}
    P -->|Có| Q[Level Up + Title mới]
    P -->|Không| R[Tiếp tục]
    
    H --> S[Hoàn thành Quest]
    S --> T[Nhận XP + Coin]
    
    I --> U[Tạo/Tham gia Guild]
    I --> V[Guild Chat Real-time]
    I --> W[Guild Tasks]
```

---

## Phần 2: Kiến trúc hệ thống

### 2.1. Sơ đồ kiến trúc tổng thể

```mermaid
graph TB
    subgraph "Client (Browser)"
        A[SolidStart SPA]
        B[SolidJS Stores]
        C[Socket.io Client]
    end

    subgraph "Server (Railway.app)"
        subgraph "SolidStart App Server (port 3000)"
            D[File-based Routes]
            E[API Routes]
            F[Auth Middleware]
        end
        subgraph "Socket.io Server (port 3001)"
            G[WebSocket Server]
            H[Event Handlers]
        end
        subgraph "Business Logic"
            I[Gamification Engine]
            J[Quest System]
            K[Achievement System]
        end
    end

    subgraph "Data Layer"
        L[(PostgreSQL)]
        M[Prisma ORM]
        N[FTS Engine]
    end

    A --> D
    A --> C
    C --> G
    D --> F
    E --> I
    E --> J
    E --> K
    I --> M
    J --> M
    K --> M
    M --> L
    G --> H
    H --> M
    N --> L
```

**Luồng dữ liệu chính:**

```mermaid
sequenceDiagram
    participant Client
    participant Middleware
    participant API Route
    participant Gamification
    participant Prisma
    participant PostgreSQL

    Client->>Middleware: HTTP Request (cookie: access_token)
    Middleware->>Middleware: Verify JWT
    alt Token hợp lệ
        Middleware->>API Route: Forward with user payload
        API Route->>API Route: Zod Validation
        API Route->>Prisma: CRUD Operation
        Prisma->>PostgreSQL: SQL Query
        PostgreSQL-->>Prisma: Result
        API Route->>Gamification: processAction()
        Gamification->>Prisma: SELECT ... FOR UPDATE
        Gamification->>Gamification: calculateXP / calculateLevel
        Gamification->>Prisma: UPDATE user + INSERT auditLog
        Gamification->>Gamification: checkQuests + checkAchievements
        Gamification-->>API Route: ActionResult
        API Route-->>Client: { success, data, gamification }
    else Token hết hạn / không hợp lệ
        Middleware-->>Client: 401 UNAUTHORIZED
    end
```

### 2.2. Cấu trúc thư mục chi tiết

```
tavernoteX/
├── plans/                              # Tài liệu kế hoạch phát triển
│   ├── plan.md                         # Kế hoạch tổng thể
│   ├── phase-00-prerequisites.md       # Giai đoạn 0: Tiền đề
│   ├── phase-01-core-mvp.md            # Giai đoạn 1: Core MVP
│   ├── phase-02-gamification.md        # Giai đoạn 2: Gamification
│   ├── phase-03-social-realtime.md     # Giai đoạn 3: Social & Real-time
│   └── phase-04-ai-polish.md           # Giai đoạn 4: AI & Polish
│
├── prisma/                             # Database layer
│   ├── schema.prisma                   # Định nghĩa 14 models
│   ├── migrations/                     # Prisma migrations
│   ├── fts-setup.sql                   # Full-text search setup (trigger, GIN index)
│   └── seed.ts                         # Seed data (quests, items, achievements)
│
├── src/
│   ├── app.tsx                         # Entry point: Router + FileRoutes
│   ├── app.css                         # TailwindCSS + theme variables + animations
│   ├── entry-client.tsx                # Client-side entry
│   ├── entry-server.tsx                # Server-side entry (SSR document)
│   ├── middleware.ts                   # Auth middleware (JWT verification)
│   │
│   ├── routes/                         # SolidStart file-based routes
│   │   ├── index.tsx                   # Trang chủ (landing page)
│   │   ├── login.tsx                   # Trang đăng nhập
│   │   ├── register.tsx                # Trang đăng ký
│   │   ├── share/[id].tsx              # Trang xem ghi chú công khai
│   │   ├── profile/[username].tsx      # Trang profile công khai
│   │   ├── (app).tsx                   # Layout có auth (sidebar, header, gamification)
│   │   ├── (app)/
│   │   │   ├── tavern.tsx              # Dashboard chính
│   │   │   ├── notes/
│   │   │   │   ├── index.tsx           # Danh sách ghi chú
│   │   │   │   ├── new.tsx             # Tạo ghi chú mới
│   │   │   │   └── [id].tsx            # Xem / sửa ghi chú
│   │   │   ├── quests.tsx              # Bảng nhiệm vụ
│   │   │   ├── habits.tsx              # Daily Rituals
│   │   │   ├── guilds/
│   │   │   │   ├── index.tsx           # Danh sách guild
│   │   │   │   └── [id].tsx            # Chi tiết guild
│   │   │   ├── leaderboard.tsx         # Bảng xếp hạng
│   │   │   ├── profile.tsx             # Trang cá nhân
│   │   │   └── shop.tsx                # Cửa hàng vật phẩm
│   │   └── api/                        # REST API endpoints
│   │       ├── auth/                   # login, register, refresh, logout, me, socket-token
│   │       ├── notes/                  # index, search, [id], duplicate, trash, export, public
│   │       ├── quests/                 # index, active, [id], [id]/claim
│   │       ├── guilds/                 # index, [id], join, leave, invite, members, messages, notes, tasks
│   │       ├── shop/                   # index, [itemId]/purchase
│   │       ├── habits/                 # index, [id], [id]/checkin
│   │       ├── notifications/          # index, [id]/read, read-all
│   │       ├── stats/dashboard.ts      # Thống kê người dùng
│   │       ├── users/[username].ts     # Profile công khai
│   │       └── leaderboard.ts          # Bảng xếp hạng
│   │
│   ├── components/                     # UI Components
│   │   ├── auth/                       # LoginForm, RegisterForm
│   │   ├── editor/                     # BlockEditor, BlockRenderer
│   │   ├── gamification/              # XPBar, LevelBadge, CoinDisplay, QuestBoard,
│   │   │                                QuestCard, QuestProgress, DailyStreak,
│   │   │                                StreakTracker, RewardPopup, LevelUpModal, RadarChart
│   │   ├── guild/                     # GuildCard, GuildChat, CreateGuild, MemberList,
│   │   │                                GuildTasks, GuildNotes
│   │   ├── profile/                   # CharacterSheet, StatsPanel, AchievementList, InventoryPanel
│   │   ├── shared/                    # NotificationBell
│   │   ├── shop/                      # ShopGrid
│   │   ├── notes/                     # NotePresence
│   │   └── ui/                        # Toast, ConfirmModal, Breadcrumb
│   │
│   ├── lib/                            # Business logic
│   │   ├── db.ts                       # Prisma client singleton
│   │   ├── env.ts                      # Zod env validation
│   │   ├── api-response.ts             # Standard response envelope
│   │   ├── rate-limit.ts              # Token bucket rate limiter
│   │   ├── markdown.ts                # Markdown → HTML renderer
│   │   ├── blocks.ts                   # Block model, parser, serializer, export
│   │   ├── time-ago.ts                # Relative time formatting
│   │   ├── auth/
│   │   │   ├── jwt.ts                  # JWT sign/verify + cookie helpers + password hash
│   │   │   └── get-user.ts             # Extract user from request
│   │   ├── gamification/
│   │   │   ├── engine.ts               # processAction() + grantReward()
│   │   │   ├── constants.ts            # XP/coin constants
│   │   │   ├── calculators/
│   │   │   │   ├── xp-calculator.ts    # XP per action type
│   │   │   │   ├── coin-calculator.ts  # Coin per action type
│   │   │   │   └── level-calculator.ts # Level formula + titles
│   │   │   ├── quests/
│   │   │   │   ├── quest-rotation.ts   # Daily/weekly quest rotation
│   │   │   │   └── quest-checker.ts    # Quest progress update
│   │   │   └── achievements/
│   │   │       └── achievement-checker.ts  # Achievement progress + unlock
│   │   └── socket/
│   │       ├── index.ts                # Socket.io server initialization
│   │       ├── handlers.ts             # Event handlers (guild, note, chat)
│   │       ├── notifications.ts        # Push notification via socket
│   │       ├── note-presence.ts        # SolidJS hook: presence + edit lock
│   │       ├── client.ts               # Socket.io client singleton
│   │       └── standalone.ts           # Standalone socket server entry
│   │
│   ├── stores/                         # SolidJS state management
│   │   ├── auth.ts                     # Auth state + login/register/logout/fetchMe
│   │   ├── user.ts                     # Gamification state (XP, coins, level)
│   │   ├── ui.ts                       # UI state (sidebar, theme, toasts, rewards)
│   │   ├── quests.ts                   # Active quests state
│   │   ├── guild.ts                    # Guild state + API calls
│   │   ├── notifications.ts            # Notification state
│   │   ├── habits.ts                   # Habit tracker state
│   │   └── tasks.ts                    # Guild tasks state
│   │
│   └── validators/                     # Zod validation schemas
│       ├── auth.ts                     # Login & Register
│       ├── note.ts                     # CreateNote & UpdateNote
│       ├── guild.ts                    # CreateGuild, UpdateGuild, JoinGuild
│       ├── habit.ts                    # CreateHabit & UpdateHabit
│       └── task.ts                     # Guild task validation
│
├── public/                             # Static assets
├── .env                                # Environment variables
├── app.config.ts                       # Vinxi/SolidStart config
├── package.json                        # Dependencies
└── tsconfig.json                       # TypeScript config
```

### 2.3. Công nghệ sử dụng

| Tầng | Công nghệ | Phiên bản | Mục đích |
|------|-----------|-----------|----------|
| **Framework** | SolidStart (Vinxi) | ^1.3.2 | Full-stack SSR framework |
| **UI Library** | SolidJS | ^1.9.12 | Reactive UI library |
| **CSS** | TailwindCSS | ^4.3.0 | Utility-first CSS |
| **Styling** | CSS Custom Properties | — | Theme system (light/dark) |
| **Database** | PostgreSQL | 16+ | Primary database |
| **ORM** | Prisma | ^7.8.0 | Type-safe database client |
| **DB Adapter** | @prisma/adapter-pg | ^7.8.0 | Direct PostgreSQL driver connection |
| **Auth** | JWT (jsonwebtoken) | ^9.0.3 | Access/Refresh token auth |
| **Password** | bcryptjs | ^3.0.3 | Password hashing (12 rounds) |
| **Real-time** | Socket.io | ^4.8.3 | WebSocket server & client |
| **Validation** | Zod | ^4.4.3 | Schema validation |
| **Markdown** | Custom (src/lib/markdown.ts) | — | Inline Markdown → HTML |
| **Block Editor** | Custom (src/lib/blocks.ts) | — | Notion-style block editor |
| **Icons** | Emoji native | — | UI icons (no icon library) |
| **Fonts** | Google Fonts | — | Cinzel, Crimson Text, JetBrains Mono |
| **Runtime** | Node.js | 20+ | Server runtime |
| **Dev Tools** | TypeScript, tsx, vitest | — | Development & testing |
| **Deploy** | Railway.app | — | Production hosting |

---

## Phần 3: Backend

### 3.1. Database Schema

Hệ thống sử dụng PostgreSQL với 14 bảng chính, được quản lý qua Prisma ORM.

#### Mermaid ER Diagram

```mermaid
erDiagram
    User ||--o{ Note : "tạo"
    User ||--o{ NoteAttachment : "tạo"
    User ||--o{ UserQuest : "có"
    User ||--o{ GuildMember : "là"
    User ||--o{ GuildMessage : "gửi"
    User ||--o{ Notification : "nhận"
    User ||--o{ AuditLog : "ghi"
    User ||--o{ UserInventory : "sở hữu"
    User ||--o{ UserAchievement : "đạt"
    User ||--o{ Habit : "tạo"
    User ||--o{ HabitCheckin : "check-in"
    User ||--o{ Guild : "sở hữu"
    User ||--o{ GuildTask : "tạo"
    User ||--o{ GuildTask : "được giao"

    Note ||--o{ NoteAttachment : "có"
    Note }o--|| Guild : "thuộc"

    Quest ||--o{ UserQuest : "được giao"

    Guild ||--o{ GuildMember : "có"
    Guild ||--o{ GuildMessage : "có"
    Guild ||--o{ Note : "có"
    Guild ||--o{ GuildTask : "có"

    CosmeticItem ||--o{ UserInventory : "được mua"

    Achievement ||--o{ UserAchievement : "được mở"

    Habit ||--o{ HabitCheckin : "có"
```

#### Chi tiết từng Model

**User** — Người dùng
| Trường | Kiểu | Mô tả |
|--------|------|-------|
| id | UUID (PK) | ID người dùng |
| email | String (UNIQUE) | Email đăng nhập |
| username | String (UNIQUE) | Tên hiển thị |
| passwordHash | String | Mật khẩu đã hash (bcrypt) |
| avatarUrl | String? | URL ảnh đại diện |
| level | Int (default: 1) | Cấp độ hiện tại |
| xp | Int (default: 0) | Tổng điểm kinh nghiệm |
| coins | Int (default: 0) | Số coin hiện có |
| title | String (default: "Novice Scribe") | Danh hiệu |
| streak | Int (default: 0) | Chuỗi ngày đăng nhập |
| role | String (default: "user") | Vai trò |
| refreshTokenHash | String? | Hash của refresh token |
| lastLoginAt | DateTime? | Lần đăng nhập cuối |
| isBanned | Boolean | Trạng thái khóa |
| createdAt / updatedAt | DateTime | Timestamp |

**Indexes:** `email` (UNIQUE), `username` (UNIQUE), `level`

---

**Note** — Ghi chú
| Trường | Kiểu | Mô tả |
|--------|------|-------|
| id | UUID (PK) | ID ghi chú |
| title | String | Tiêu đề |
| content | TEXT | Nội dung (Markdown hoặc JSON blocks) |
| category | String? | Danh mục |
| tags | String[] | Mảng tags |
| isPublic | Boolean | Công khai? |
| isDeleted | Boolean | Đã xóa mềm? |
| deletedAt | DateTime? | Thời điểm xóa |
| version | Int | Phiên bản (optimistic locking) |
| wordCount | Int | Số từ |
| aiSummary | String? | Tóm tắt AI (GPT-4o-mini) |
| aiImageUrl | String? | Ảnh tạo bởi DALL-E |
| searchVector | tsvector | Vector tìm kiếm toàn văn |

**Indexes:** `(userId, createdAt DESC)`, `category`, `(isPublic, createdAt DESC)`, GIN trên `searchVector`

---

**Guild** — Bang hội
| Trường | Kiểu | Mô tả |
|--------|------|-------|
| id | UUID (PK) | ID guild |
| name | String | Tên guild |
| description | String? | Mô tả |
| inviteCode | String (UNIQUE) | Mã mời tham gia |
| maxMembers | Int (default: 50) | Số thành viên tối đa |
| isPublic | Boolean | Công khai? |
| ownerId | UUID (FK) | ID chủ guild |

---

**GuildTask** — Nhiệm vụ trong guild
| Trường | Kiểu | Mô tả |
|--------|------|-------|
| id | UUID (PK) | ID task |
| creatorId | UUID (FK) | Người tạo task |
| assigneeId | UUID (FK) | Người được giao |
| title / description | String | Nội dung task |
| xpReward / coinReward | Int | Phần thưởng |
| dueAt | DateTime? | Hạn hoàn thành |
| status | String | assigned → submitted → approved |
| reviewNote | String? | Ghi chú của reviewer |

---

**Habit** — Thói quen cá nhân
| Trường | Kiểu | Mô tả |
|--------|------|-------|
| id | UUID (PK) | ID habit |
| title / description | String | Tên / mô tả |
| icon | String (default: "✅") | Biểu tượng |
| xpReward / coinReward | Int | Phần thưởng mỗi lần check-in |
| streak / bestStreak | Int | Chuỗi hiện tại / kỷ lục |
| lastCompletedOn | Date? | Ngày hoàn thành gần nhất |
| isArchived | Boolean | Đã lưu trữ? |

**Unique:** `(habitId, date)` trên HabitCheckin — mỗi ngày chỉ check-in 1 lần/habit.

---

**Các bảng hỗ trợ:**

| Model | Quan hệ | Mục đích |
|-------|---------|----------|
| **Quest** | 1-N UserQuest | Định nghĩa nhiệm vụ (daily/weekly) |
| **UserQuest** | User-Quest (unique) | Tiến độ nhiệm vụ của user |
| **Achievement** | 1-N UserAchievement | Định nghĩa thành tựu |
| **UserAchievement** | User-Ach (unique) | Tiến độ thành tựu của user |
| **CosmeticItem** | 1-N UserInventory | Vật phẩm trong shop |
| **UserInventory** | User-Item (unique) | Túi đồ của user |
| **Notification** | N-1 User | Thông báo (level up, achievement...) |
| **AuditLog** | N-1 User | Nhật ký thay đổi XP/Coin |
| **GuildMember** | Guild-User (unique) | Thành viên guild |
| **GuildMessage** | N-1 Guild, N-1 User | Tin nhắn trong guild |
| **NoteAttachment** | N-1 Note, N-1 User | File đính kèm |
| **HabitCheckin** | N-1 Habit, N-1 User | Lịch sử check-in |

#### Full-Text Search

PostgreSQL FTS được kích hoạt qua `prisma/fts-setup.sql`:
- **Trigger:** `BEFORE INSERT OR UPDATE` trên bảng Note, tự động cập nhật `searchVector` từ title (weight A), content (weight B), category (weight C)
- **Config:** `'simple'` (hỗ trợ tiếng Việt không dấu tốt hơn `'english'`)
- **Index:** GIN index trên `searchVector` để tìm kiếm nhanh
- **Fallback:** Nếu FTS không khả dụng (chưa chạy setup), API search fallback về ILIKE với parameterized query an toàn

### 3.2. API Routes

Tất cả API đều tuân theo chuẩn response envelope:

```json
{
  "success": true,
  "data": { ... },
  "meta": { ... },
  "timestamp": "2026-06-11T12:00:00.000Z"
}

// Error:
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input",
    "details": { ... }
  },
  "timestamp": "2026-06-11T12:00:00.000Z"
}
```

#### Danh sách toàn bộ API Endpoints

**Authentication (`/api/auth/`)**
| Method | Endpoint | Mô tả | Auth | Rate Limit |
|--------|----------|-------|------|------------|
| POST | `/api/auth/register` | Đăng ký tài khoản | Public | 5/30phút |
| POST | `/api/auth/login` | Đăng nhập, set cookie | Public | 5/phút |
| POST | `/api/auth/refresh` | Làm mới access token | Cookie | Không |
| POST | `/api/auth/logout` | Đăng xuất, xóa cookie | Cookie | Không |
| GET | `/api/auth/me` | Lấy thông tin user hiện tại | Token | Không |
| POST | `/api/auth/socket-token` | Lấy token cho socket auth | Token | Không |

**Notes (`/api/notes/`)**
| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| GET | `/api/notes` | Danh sách ghi chú (cursor page) | Token |
| POST | `/api/notes` | Tạo ghi chú mới (+ XP) | Token |
| GET | `/api/notes/search?q=` | Tìm kiếm toàn văn | Token |
| GET | `/api/notes/trash` | Danh sách ghi chú đã xóa | Token |
| GET | `/api/notes/export?format=md\|html` | Export tất cả ghi chú | Token |
| GET | `/api/notes/public/[id]` | Xem ghi chú công khai | Public |
| GET | `/api/notes/[id]` | Chi tiết ghi chú | Token/Owner |
| PUT | `/api/notes/[id]` | Cập nhật ghi chú (version check) | Owner |
| DELETE | `/api/notes/[id]` | Xóa mềm ghi chú | Owner |
| POST | `/api/notes/[id]/duplicate` | Nhân bản ghi chú | Token |

**Quests (`/api/quests/`)**
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/quests` | Tất cả quest có sẵn |
| GET | `/api/quests/active` | Quest đang active của user |
| POST | `/api/quests/[id]/claim` | Nhận thưởng quest hoàn thành |

**Guilds (`/api/guilds/`)**
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/guilds` | Danh sách guild công khai |
| POST | `/api/guilds` | Tạo guild mới (+ XP) |
| GET | `/api/guilds/[id]` | Chi tiết guild |
| DELETE | `/api/guilds/[id]` | Xóa guild (owner only) |
| POST | `/api/guilds/[id]/join` | Tham gia guild |
| POST | `/api/guilds/[id]/leave` | Rời guild |
| POST | `/api/guilds/[id]/invite` | Tạo invite code mới |
| GET | `/api/guilds/[id]/members` | Danh sách thành viên |
| PATCH | `/api/guilds/[id]/members/[userId]` | Đổi role thành viên |
| DELETE | `/api/guilds/[id]/members/[userId]` | Kick thành viên |
| GET | `/api/guilds/[id]/messages?cursor=` | Lịch sử chat |
| GET/POST | `/api/guilds/[id]/notes` | Guild notes |
| DELETE | `/api/guilds/[id]/notes/[noteId]` | Gỡ note khỏi guild |
| GET/POST | `/api/guilds/[id]/tasks` | Guild tasks |
| POST | `/api/guilds/[id]/tasks/[taskId]/submit` | Nộp task |
| POST | `/api/guilds/[id]/tasks/[taskId]/review` | Duyệt task |
| DELETE | `/api/guilds/[id]/tasks/[taskId]` | Xóa task |

**Shop (`/api/shop/`)**
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/shop` | Vật phẩm chưa sở hữu |
| POST | `/api/shop/[itemId]/purchase` | Mua vật phẩm |

**Habits (`/api/habits/`)**
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/habits` | Danh sách habits |
| POST | `/api/habits` | Tạo habit mới |
| PATCH | `/api/habits/[id]` | Cập nhật habit |
| DELETE | `/api/habits/[id]` | Xóa habit |
| POST | `/api/habits/[id]/checkin` | Check-in hôm nay |

**Notifications (`/api/notifications/`)**
| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/notifications` | Danh sách thông báo |
| PATCH | `/api/notifications/[id]/read` | Đánh dấu đã đọc |
| PATCH | `/api/notifications/read-all` | Đánh dấu tất cả đã đọc |

**Khác**
| Method | Endpoint | Mô tả | Auth |
|--------|----------|-------|------|
| GET | `/api/leaderboard?scope=global\|guild&guildId=` | BXH (cache 60s) | Token |
| GET | `/api/stats/dashboard` | Thống kê cá nhân | Token |
| GET | `/api/users/[username]` | Profile công khai | Public |

### 3.3. Auth Flow

Hệ thống sử dụng cơ chế **JWT dual token** (access + refresh) được lưu trong **httpOnly cookie**:

#### Kiến trúc Auth

```mermaid
sequenceDiagram
    participant Browser
    participant Server
    participant DB

    Note over Browser,Server: ĐĂNG NHẬP
    Browser->>Server: POST /api/auth/login { email, password }
    Server->>DB: SELECT user WHERE email = ?
    Server->>Server: bcrypt.compare(password, hash)
    Server->>Server: signAccessToken(user) — 15 phút
    Server->>Server: signRefreshToken(user) — 7 ngày
    Server->>Server: hashRefreshToken → DB
    Server-->>Browser: Set-Cookie: access_token (HttpOnly, 15min)
    Server-->>Browser: Set-Cookie: refresh_token (HttpOnly, 7d, path=/api/auth)
    Server-->>Browser: { user data + gamification }

    Note over Browser,Server: REQUEST CÓ AUTH
    Browser->>Server: GET /api/notes (Cookie: access_token=...)
    Server->>Server: Middleware verify access_token
    alt Token hợp lệ
        Server->>Server: Gắn user payload vào request.locals
        Server-->>Browser: 200 OK + data
    else Token hết hạn
        Server-->>Browser: 401 Unauthorized
        Browser->>Server: POST /api/auth/refresh (Cookie: refresh_token)
        Server->>Server: verifyRefreshToken + compare hash trong DB
        Server-->>Browser: Set-Cookie: access_token (mới)
        Browser->>Server: Retry request gốc
    else Token không hợp lệ
        Server-->>Browser: 401 → redirect /login
    end
```

#### Chi tiết kỹ thuật

- **Access Token:** HS256, 15 phút, chứa `{ userId, email, username }`
- **Refresh Token:** HS256, 7 ngày, hash lưu trong DB (`refreshTokenHash`)
- **Cookie flags:** `HttpOnly`, `SameSite=Lax`, `Secure` (production only), `Path=/` (access), `Path=/api/auth` (refresh)
- **Middleware:** `src/middleware.ts` — kiểm tra mọi request không nằm trong `publicPaths`
- **Public paths:** `/api/auth/*`, `/api/notes/public/*`, `/api/users/*`, `/login`, `/register`, `/share/*`, `/profile/*`, `/`, static assets
- **Password:** bcrypt hash với 12 salt rounds
- **Client-side auto-refresh:** `authFetch()` tự động gọi `/api/auth/refresh` khi nhận 401, nếu refresh thất bại → logout

### 3.4. Gamification Engine

Hệ thống gamification được thiết kế theo kiến trúc **event-driven**, đảm bảo tính nhất quán dữ liệu với database transaction và row-level locking.

#### Sơ đồ Gamification Engine

```mermaid
flowchart TD
    A[User Action] --> B[processAction - DB Transaction]
    
    subgraph "Transaction (SELECT ... FOR UPDATE)"
        B --> C[SELECT user xp, coins, level FOR UPDATE]
        C --> D[calculateXP - pure function]
        C --> E[calculateCoins - pure function]
        D --> F[UPDATE user xp, coins, level]
        E --> F
        F --> G[INSERT audit_log]
        G --> H[rotateQuestsIfNeeded]
        H --> I[checkQuestProgress]
        I --> J[checkAchievements]
    end
    
    H --> K{Daily quests hết hạn?}
    K -->|Có| L[Xóa quest cũ, random 3 quest mới]
    K -->|Không| I
    
    I --> M{Duyệt từng active quest}
    M --> N{Criteria.action match?}
    N -->|Có| O[Cập nhật progress]
    O --> P{Đạt target?}
    P -->|Có| Q[Status = completed]
    
    J --> R{Duyệt từng achievement}
    R --> S{Criteria.action match?}
    S -->|Có| T[Cập nhật progress]
    T --> U{Đạt target?}
    U -->|Có| V[unlockedAt = now]
    
    B --> W[Return ActionResult]
    W --> X[Trigger notifications - async]
    X --> Y[Socket.io emit notification:new]
```

#### Cơ chế tính XP

| Action | Base XP | Bonus |
|--------|---------|-------|
| create_note | 10 | +1 XP mỗi 100 từ (max 50) |
| write_words | 0 | +1 XP mỗi 100 từ (max 50) |
| make_public | 5 | — |
| daily_login | 5 | +5 XP × streak (chuỗi ngày) |
| complete_quest | xpReward | Theo quest được seed |
| join_guild | 0 | — |
| create_guild | 0 | Tạo guild không cho XP trực tiếp |

#### Cơ chế tính Level

```
level = max(1, floor(sqrt(xp / 100)))
XP cần để đạt level N = N² × 100
```

#### Hệ thống Danh hiệu (Titles)

| Level | Danh hiệu |
|-------|-----------|
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

#### Quest System
- **Daily Quests:** Reset mỗi ngày, chọn ngẫu nhiên 3/9 quest có sẵn
- **Weekly Quests:** Reset mỗi tuần, chọn ngẫu nhiên 3/9 quest
- **Quest types:** create_note, write_words, daily_login, make_public, join_guild
- **Progress:** Mỗi hành động khớp với `criteria.action` sẽ tăng progress. Khi đạt `criteria.count`, quest chuyển sang trạng thái "completed"
- **Claim:** Người dùng phải chủ động nhấn "Claim" để nhận XP + Coin

#### Achievement System
- 6 thành tựu được seed sẵn (First Scroll, Scribe Apprentice, Streak Master, Wordsmith, Guild Leader, Quest Champion)
- Mỗi lần `processAction` chạy, engine kiểm tra tất cả achievement có `criteria.action` khớp
- Tăng progress, tự động unlock khi đạt `criteria.count`
- Achievement đã unlock sẽ bị skip ở những lần kiểm tra sau

### 3.5. Real-time (Socket.io)

Hệ thống Socket.io chạy trên một server riêng (port 3001) để không ảnh hưởng đến HTTP server chính.

#### Kiến trúc Socket

```mermaid
flowchart LR
    subgraph "Browser"
        A[Solid App]
        B[useSocket hook]
    end
    
    subgraph "Port 3001"
        C[Socket.io Server]
        D[JWT Auth Middleware]
        E[Guild Handlers]
        F[Note Presence Handlers]
        G[Edit Lock Manager]
    end
    
    subgraph "Port 3000"
        H[API Server]
        I[createNotification]
    end
    
    A <-->|WebSocket| C
    B -->|authFetch /api/auth/socket-token| H
    C --> D
    D --> E
    D --> F
    D --> G
    H --> I
    I -->|getIO().to().emit| C
```

#### Các Event Handlers

**Guild:**
| Event (client→server) | Event (server→client) | Mô tả |
|----------------------|----------------------|-------|
| `guild:join` | `guild:user-joined` | Tham gia phòng chat guild |
| `guild:leave` | `guild:user-left` | Rời phòng chat guild |
| `guild:send-message` | `guild:message` | Gửi tin nhắn (rate limit 10msg/10s, max 2000 ký tự) |

**Note Presence:**
| Event | Mô tả |
|-------|-------|
| `note:join` / `note:user-joined` | Vào phòng note |
| `note:leave` / `note:user-left` | Rời phòng note |
| `note:editing-start` / `note:editing-started` | Bắt đầu chỉnh sửa (lock 5 phút) |
| `note:editing-end` / `note:editing-ended` | Kết thúc chỉnh sửa |

**Notifications:**
| Event | Mô tả |
|-------|-------|
| `notification:new` | Server push thông báo mới đến user room |

#### Edit Lock

- Mỗi note có thể bị lock bởi **chính chủ sở hữu**
- TTL lock: **5 phút**, tự động clean mỗi 30 giây
- Khi user disconnect, tất cả lock của user đó được giải phóng
- User khác vào note sẽ thấy thông báo "Note đang được chỉnh sửa"

### 3.6. Hệ thống Social

#### Guild (Bang hội)

**Mô hình phân quyền:**
- **Owner:** Toàn quyền (xóa guild, đổi role, kick member, tạo invite)
- **Admin:** Quản lý member (đổi role member↔admin, kick member), tạo guild tasks
- **Member:** Chat, xem guild notes, nhận guild tasks

**Quy trình tham gia guild:**
1. Guild công khai: Join trực tiếp
2. Guild riêng tư: Cần invite code
3. Giới hạn: 50 thành viên/guild

**Guild Tasks:**
- Owner/Admin tạo task gán cho member
- Member submit task
- Owner/Admin review: approve (thưởng XP+Coin) hoặc reject
- Task được approve sẽ gọi `grantReward()` để cộng XP/Coin

#### Leaderboard

- **Global scope:** Top 100 user theo XP (cache 60 giây)
- **Guild scope:** Top user trong guild (yêu cầu là member)
- Trả về: rank, username, level, xp, title, avatarUrl

---

## Phần 4: Frontend

### 4.1. Cấu trúc Component

```mermaid
graph TD
    subgraph "App Shell ((app).tsx)"
        A[Sidebar Navigation]
        B[Header Bar]
        C[ToastContainer]
        D[RewardPopup]
        E[LevelUpModal]
    end

    subgraph "Auth Components"
        A1[LoginForm]
        A2[RegisterForm]
    end

    subgraph "Notes Components"
        N1[BlockEditor]
        N2[BlockRenderer]
        N3[NotePresence]
    end

    subgraph "Gamification Components"
        G1[XPBar]
        G2[LevelBadge]
        G3[CoinDisplay]
        G4[QuestBoard]
        G5[QuestCard]
        G6[QuestProgress]
        G7[DailyStreak]
        G8[StreakTracker]
        G9[RewardPopup]
        G10[LevelUpModal]
        G11[RadarChart]
    end

    subgraph "Guild Components"
        GL1[GuildCard]
        GL2[GuildChat]
        GL3[CreateGuild]
        GL4[MemberList]
        GL5[GuildTasks]
        GL6[GuildNotes]
    end

    subgraph "Profile Components"
        P1[CharacterSheet]
        P2[StatsPanel]
        P3[AchievementList]
        P4[InventoryPanel]
    end

    subgraph "Shared/UI Components"
        S1[NotificationBell]
        S2[Toast]
        S3[ConfirmModal]
        S4[Breadcrumb]
        S5[ShopGrid]
    end
```

### 4.2. State Management

Sử dụng **SolidJS Signals** và **Stores** — không cần thư viện quản lý state bên ngoài.

#### Tổng quan các Stores

```mermaid
graph LR
    subgraph "Stores"
        SA[auth.ts] --> |signals| SA1[user, loading]
        SB[user.ts] --> |signals| SB1[gamification]
        SC[ui.ts] --> |store| SC1[sidebarOpen, theme, toasts]
        SC --> |signal| SC2[rewardQueue]
        SD[quests.ts] --> |signals| SD1[quests, questsLoading]
        SE[guild.ts] --> |signals| SE1[guilds, currentGuild, members, chatMessages]
        SF[notifications.ts] --> |signals| SF1[notifications, unreadCount]
        SG[habits.ts] --> |functions| SG1[fetchHabits, createHabit, checkinHabit]
        SH[tasks.ts] --> |functions| SH1[fetchTasks, createTask, submitTask]
    end

    subgraph "Data Flow"
        API[API Response] --> SA
        API --> SB
        API --> SD
        API --> SE
        API --> SF
        Socket[Socket.io] --> SF
        Socket --> SE
    end
```

| Store | Loại | Dữ liệu quản lý |
|-------|------|----------------|
| `auth.ts` | Signal | `user`, `loading`; các hàm `login`, `register`, `logout`, `fetchMe`, `authFetch` |
| `user.ts` | Signal | `gamification` (xp, coins, level, title, streak); helper `xpProgressInLevel`, `applyReward` |
| `ui.ts` | Store + Signal | `sidebarOpen`, `theme` (dark/light), `toasts`, `rewardQueue` |
| `quests.ts` | Signal | `quests`, `questsLoading` |
| `guild.ts` | Signals | `guilds`, `currentGuild`, `members`, `chatMessages` |
| `notifications.ts` | Signal | `notifications`, `unreadCount` |
| `habits.ts` | Functions | API calls cho habit CRUD + checkin |
| `tasks.ts` | Functions | API calls cho guild tasks |

#### AuthFetch — Auto Refresh Token

```typescript
// src/stores/auth.ts
export async function authFetch(url, options) {
  let res = await fetch(url, { ...options, credentials: "include" });
  if (res.status === 401) {
    const refreshed = await refreshToken();  // POST /api/auth/refresh
    if (refreshed) {
      res = await fetch(url, { ...options, credentials: "include" });
    } else {
      setUser(null);
      throw new Error("SESSION_EXPIRED");
    }
  }
  return res;
}
```

### 4.3. Routing

SolidStart sử dụng **file-based routing** với cấu trúc thư mục `src/routes/`:

| File/Thư mục | Route | Mô tả |
|-------------|-------|-------|
| `index.tsx` | `/` | Landing page |
| `login.tsx` | `/login` | Đăng nhập |
| `register.tsx` | `/register` | Đăng ký |
| `share/[id].tsx` | `/share/:id` | Xem ghi chú công khai |
| `profile/[username].tsx` | `/profile/:username` | Profile công khai |
| `(app).tsx` | Layout có auth | Sidebar + Header + Gamification |
| `(app)/tavern.tsx` | `/tavern` | Dashboard chính |
| `(app)/notes/index.tsx` | `/notes` | Danh sách ghi chú |
| `(app)/notes/new.tsx` | `/notes/new` | Tạo ghi chú |
| `(app)/notes/[id].tsx` | `/notes/:id` | Xem/sửa ghi chú |
| `(app)/quests.tsx` | `/quests` | Bảng nhiệm vụ |
| `(app)/habits.tsx` | `/habits` | Daily Rituals |
| `(app)/guilds/index.tsx` | `/guilds` | Danh sách guild |
| `(app)/guilds/[id].tsx` | `/guilds/:id` | Chi tiết guild |
| `(app)/leaderboard.tsx` | `/leaderboard` | Bảng xếp hạng |
| `(app)/profile.tsx` | `/profile` | Trang cá nhân |
| `(app)/shop.tsx` | `/shop` | Cửa hàng |

**Route groups:**
- `(app)` là **route group** — tất cả route con đều được bọc bởi layout `(app).tsx` (yêu cầu đăng nhập)
- Các route không trong group (login, register, index, share) là public

**API Routes:** Bắt đầu bằng `/api/`, trả về `Response` object trực tiếp (không render HTML)

### 4.4. UI/UX & Theme

#### Hệ thống Theme

Hệ thống sử dụng **CSS Custom Properties** kết hợp với **TailwindCSS v4**:

- **Light theme:** Parchment ấm áp, contrast cao — gợi nhớ giấy da cổ
- **Dark theme:** Mặc định — không gian quán rượu ánh nến (candlelit espresso)

**Bảng màu chính:**

| Variable | Light | Dark | Mục đích |
|----------|-------|------|----------|
| `--color-surface` | #F7F1E3 | #1A140E | Nền chính |
| `--color-surface-elevated` | #FFFDF6 | #261D13 | Nền nâng cao |
| `--color-surface-border` | #D6C4A0 | #4A3A26 | Viền |
| `--color-ink-primary` | #291F14 | #F7F6F3 | Chữ chính |
| `--color-ink-secondary` | #6B5A44 | #CAC2B6 | Chữ phụ |
| `--color-accent` | #9C6E1A | #E0AE56 | Màu nhấn |
| `--color-xp` | #2F7846 | #7EB868 | XP bar |
| `--color-coin` | #A87A1C | #E8B850 | Coin |

**Theme switching:** Lưu trong `localStorage`, áp dụng qua `data-theme` attribute. Script inline trong `<head>` chạy trước first paint để tránh flash.

**Fonts:**
- **Display:** Cinzel (serif) — tiêu đề, headings
- **Body:** Crimson Text (serif) — nội dung văn bản
- **Mono:** JetBrains Mono — code blocks

**Animations:**
- `slide-in` — toast notifications
- `fade-up` — reward popup
- `shimmer` — loading skeletons
- `glow-pulse` — active navigation items

**Accessibility:**
- `prefers-reduced-motion` — tắt animation khi user yêu cầu
- ARIA labels trên tất cả interactive elements
- Progress bar có `aria-valuenow`, `aria-valuemin`, `aria-valuemax`
- Semantic HTML: `<nav>`, `<main>`, `<aside>`, `<header>`

### 4.5. Block Editor

Trình soạn thảo block (Notion-style) được xây dựng hoàn toàn tùy chỉnh, không phụ thuộc thư viện bên ngoài.

#### Block Model (`src/lib/blocks.ts`)

```typescript
type BlockType = 'text' | 'heading1' | 'heading2' | 'heading3' 
  | 'quote' | 'divider' | 'bullet_list' | 'numbered_list' 
  | 'code' | 'callout' | 'todo';

interface Block {
  id: string;
  type: BlockType;
  content: string;
  checked?: boolean;      // cho todo
  language?: string;      // cho code
  calloutIcon?: string;   // cho callout
}
```

Block được serialize thành JSON string và lưu vào cột `content` của Note.

#### Các tính năng của Block Editor

| Tính năng | Mô tả |
|-----------|-------|
| **11 loại block** | Text, 3 cấp heading, quote, divider, bullet/numbered list, code, callout, todo |
| **Slash command (`/`)** | Gõ `/` để mở menu chọn loại block, có tìm kiếm theo tên/keyword |
| **Markdown shortcuts** | `#`, `##`, `###`, `>`, `-`, `1.`, `[]`, `---`, ` ``` ` tự động chuyển block type |
| **Drag to reorder** | Kéo thả để sắp xếp lại các block |
| **Auto-continue lists** | Enter trong list/todo tạo block mới cùng loại; Enter khi rỗng → text |
| **Backspace merge** | Backspace ở đầu block merge với block trên |
| **Keyboard navigation** | Arrow Up/Down di chuyển giữa các block |
| **Code block** | Hỗ trợ language label, monospace font |
| **Callout block** | Có icon tùy chỉnh, nền accent nhạt |
| **Todo block** | Checkbox có thể toggle |
| **Responsive textarea** | Auto-resize theo nội dung |

#### Export

Hàm `blocksToMarkdown()` và `blocksToHtml()` cho phép export ghi chú ra các định dạng:
- **Markdown:** Chuẩn markdown với heading, list, quote, code fences
- **HTML:** HTML đầy đủ với Tailwind classes cho hiển thị

#### Render

`BlockRenderer.tsx` component render block content ra HTML (dùng `innerHTML`) cho chế độ xem. Cũng hỗ trợ render markdown cũ qua `renderMarkdown()`.

---

## Phần 5: Triển khai

### 5.1. Các bước cài đặt local

#### Yêu cầu hệ thống
- **Node.js** 20+
- **PostgreSQL** 16+ (local hoặc Docker)
- **npm** hoặc **pnpm**

#### Bước 1: Clone repository
```bash
git clone <repository-url>
cd tavernoteX
```

#### Bước 2: Cài đặt dependencies
```bash
npm install
```

#### Bước 3: Cấu hình environment
```bash
cp .env.example .env
# Chỉnh sửa các biến trong .env (xem 5.2)
```

#### Bước 4: Setup database
```bash
# Đảm bảo PostgreSQL đang chạy
# Tạo database:
createdb tavernotex

# Chạy migration:
npm run db:migrate

# Setup Full-Text Search:
psql "$DATABASE_URL" -f prisma/fts-setup.sql

# Seed dữ liệu:
npm run db:seed
```

#### Bước 5: Chạy development server
```bash
# Terminal 1: App server (port 3000)
npm run dev

# Terminal 2: Socket.io server (port 3001)
npm run dev:socket
```

Mở trình duyệt tại `http://localhost:3000`

### 5.2. Cấu hình môi trường (.env)

```env
# Database — PostgreSQL connection string
DATABASE_URL=postgresql://username:password@localhost:5432/tavernotex

# JWT secrets — phải đủ dài (tối thiểu 16 ký tự)
JWT_ACCESS_SECRET=your-access-secret-at-least-16-characters
JWT_REFRESH_SECRET=your-refresh-secret-at-least-16-characters

# OpenAI API key (tùy chọn — cho tính năng AI summary/image)
OPENAI_API_KEY=sk-...

# Environment
NODE_ENV=development

# Client URL (cho CORS)
CLIENT_URL=http://localhost:3000
```

| Biến | Bắt buộc | Mô tả |
|------|----------|-------|
| `DATABASE_URL` | Có | Connection string PostgreSQL |
| `JWT_ACCESS_SECRET` | Có | Secret ký access token (min 16 chars) |
| `JWT_REFRESH_SECRET` | Có | Secret ký refresh token (min 16 chars) |
| `OPENAI_API_KEY` | Không | API key cho tính năng AI |
| `NODE_ENV` | Không | `development` / `production` / `test` |
| `CLIENT_URL` | Không | URL client cho CORS |

Validation env được thực hiện qua Zod (`src/lib/env.ts`), app sẽ crash ngay khi khởi động nếu thiếu biến bắt buộc.

### 5.3. Database Setup (PostgreSQL, Prisma)

#### Schema & Migrations

Prisma schema được định nghĩa trong `prisma/schema.prisma` với 14 models và đầy đủ relations, indexes, unique constraints.

**Các lệnh quản lý database:**

| Lệnh | Mô tả |
|------|-------|
| `npm run db:migrate` | Tạo và chạy migration mới (dev) |
| `npm run db:push` | Push schema trực tiếp (không migration) |
| `npm run db:seed` | Seed dữ liệu mẫu |
| `npm run db:studio` | Mở Prisma Studio GUI |

#### Seed Data

Script `prisma/seed.ts` tạo dữ liệu ban đầu:
- **9 quests** (5 daily + 4 weekly) — tạo idempotently theo title
- **5 cosmetic items** (Scholar Quill, Golden Frame, Obsidian Theme, Emerald Ink, Ancient Map) — chỉ tạo khi bảng trống
- **6 achievements** (First Scroll, Scribe Apprentice, Streak Master, Wordsmith, Guild Leader, Quest Champion) — chỉ tạo khi bảng trống

#### Full-Text Search Setup

File `prisma/fts-setup.sql` cần được chạy thủ công SAU KHI migration:

```sql
-- 1. Đổi cột searchVector từ TEXT → tsvector
ALTER TABLE "Note" ALTER COLUMN "searchVector" TYPE tsvector;

-- 2. Tạo trigger function tự động cập nhật search vector
CREATE FUNCTION note_search_vector_update() RETURNS trigger ...

-- 3. Tạo trigger BEFORE INSERT/UPDATE
CREATE TRIGGER trg_note_search_vector ...

-- 4. Tạo GIN index cho tìm kiếm nhanh
CREATE INDEX idx_note_search_vector ON "Note" USING GIN("searchVector");
```

Nếu chưa chạy FTS setup, API search sẽ tự động fallback về ILIKE pattern matching (parameterized, an toàn).

### 5.4. Deploy lên Railway

Railway.app được chọn làm nền tảng deploy vì hỗ trợ native WebSocket và PostgreSQL.

#### Cấu trúc deploy

```mermaid
graph TB
    subgraph "Railway.app"
        subgraph "App Service (SolidStart)"
            A[Node.js Runtime]
            B[SolidStart SSR + API]
        end
        subgraph "Socket Service"
            C[Node.js Runtime]
            D[Socket.io Standalone]
        end
        E[(PostgreSQL)]
    end
    
    F[GitHub Repository] -->|Auto Deploy| A
    F -->|Auto Deploy| C
    B --> E
    D --> E
    G[Client Browser] -->|HTTPS| B
    G -->|WSS| D
```

#### Các bước deploy

1. **Push code lên GitHub**

2. **Tạo project trên Railway:**
   - Kết nối GitHub repository
   - Railway tự động detect Node.js project

3. **Cấu hình Services:**
   - **Service 1 (App):** `npm run build && npm run start` — port 3000
   - **Service 2 (Socket):** `npm run dev:socket` — port 3001
   - **Database:** Add PostgreSQL plugin

4. **Cấu hình Environment Variables:**
   - `DATABASE_URL` — Railway tự cung cấp từ PostgreSQL plugin
   - `JWT_ACCESS_SECRET` — Generate secret mới
   - `JWT_REFRESH_SECRET` — Generate secret mới
   - `NODE_ENV=production`
   - `CLIENT_URL` — URL của Railway app

5. **Post-deploy:**
   ```bash
   # Chạy migration trên production (qua Railway CLI hoặc shell)
   railway run npx prisma migrate deploy
   
   # Setup FTS
   railway run psql "$DATABASE_URL" -f prisma/fts-setup.sql
   
   # Seed (nếu cần)
   railway run npx prisma db seed
   ```

#### Production Considerations

- **Cookie Secure flag:** Tự động bật khi `NODE_ENV=production` (xem `setAuthCookies`)
- **CORS:** Socket.io server tự động cấu hình origin từ `CLIENT_URL`
- **Prisma:** Sử dụng `@prisma/adapter-pg` cho direct connection pool
- **Logging:** Chỉ log `error` trong production

---

## Phần 6: Kết luận

### 6.1. Những gì đã làm được

Dự án TavernoteX đã hoàn thành một ứng dụng ghi chú gamified hoàn chỉnh với các kết quả sau:

#### Về mặt kỹ thuật

| Thành phần | Kết quả |
|------------|---------|
| **Database** | 14 models PostgreSQL với quan hệ chặt chẽ, 30+ indexes, Full-Text Search với GIN index và trigger tự động |
| **Backend API** | 50+ RESTful endpoints với Zod validation, rate limiting, cursor-based pagination |
| **Authentication** | JWT dual token (access 15phút + refresh 7 ngày) với httpOnly cookie, auto-refresh, bcrypt hashing |
| **Gamification Engine** | Event-driven với database transaction + `SELECT ... FOR UPDATE` đảm bảo nhất quán, 7 action types, level formula, quest rotation, achievement system |
| **Real-time** | Socket.io server độc lập với JWT auth, guild chat (có rate limit), note presence, edit lock |
| **Block Editor** | 11 loại block, slash command, markdown shortcuts, drag-to-reorder, export markdown/html |
| **State Management** | 8 SolidJS stores/signals với auto-refresh token, optimistic UI |
| **UI/UX** | Theme system light/dark với CSS custom properties, medieval tavern aesthetic, 3 font families, responsive layout |
| **Security** | Rate limiting (token bucket), Zod input validation, XSS prevention (safeUrl, escapeHtml), CSRF protection (SameSite cookies), SQL injection prevention (parameterized queries) |
| **Deploy** | Cấu hình sẵn cho Railway.app với WebSocket + PostgreSQL |

#### Về mặt tính năng

- **Ghi chú (Notes):** CRUD hoàn chỉnh với block editor, search FTS, soft delete, tags, categories, public sharing, export, version conflict detection
- **Gamification:** XP, Level (công thức sqrt), 10 danh hiệu, Coin, Streak, Daily/Weekly Quests (9 quest mẫu), 6 Achievements, Audit Log
- **Social:** Guild (tạo/tham gia/rời), Guild Chat real-time, Guild Tasks (assign → submit → review), Guild Notes, Leaderboard (global + guild)
- **Habit Tracker:** CRUD habits, check-in hàng ngày với streak tracking, tích hợp gamification (XP + Coin thưởng)
- **Shop:** 5 cosmetic items, mua bằng coin, inventory management
- **Profile:** Stats dashboard, achievements list, inventory panel
- **Notifications:** Real-time push qua Socket.io (level up, achievement, quest complete)

### 6.2. Hạn chế và hướng phát triển

#### Hạn chế hiện tại

| Hạn chế | Mô tả | Mức độ |
|---------|-------|--------|
| **Không có collaborative editing** | Edit lock hiện tại chỉ thông báo có người đang sửa, chưa hỗ trợ đồng bộ nội dung real-time (CRDT/OT) | Trung bình |
| **File upload chưa hoàn thiện** | Model NoteAttachment đã có nhưng chưa có API upload file (yêu cầu Supabase Storage) | Thấp |
| **AI features hạn chế** | OpenAI integration đã có trong dependencies nhưng chưa có UI hoàn chỉnh (summarize, image generation) | Thấp |
| **Chưa có email verification** | Trường `emailVerifiedAt` đã có trong schema nhưng chưa implement flow xác thực email | Trung bình |
| **Không có i18n** | Toàn bộ UI là tiếng Anh, chưa hỗ trợ đa ngôn ngữ (kể cả tiếng Việt) | Thấp |
| **Chưa có testing đầy đủ** | Vitest đã được cấu hình nhưng chưa có test coverage đáng kể | Trung bình |
| **FTS với tiếng Việt** | PostgreSQL config `'simple'` hỗ trợ tiếng Việt không dấu nhưng chưa tối ưu cho có dấu | Thấp |
| **Mobile UX** | Responsive đã có nhưng trải nghiệm mobile chưa được tối ưu (block editor khó dùng trên mobile) | Trung bình |
| **PWA / Offline** | Chưa có offline support hay PWA capabilities | Thấp |

#### Hướng phát triển

**Ngắn hạn (1-3 tháng):**
1. **Hoàn thiện AI features:** Tích hợp GPT-4o-mini để tóm tắt ghi chú và DALL-E để tạo ảnh minh họa
2. **File upload:** Tích hợp Supabase Storage hoặc Cloudflare R2
3. **Email verification:** Gửi email xác thực khi đăng ký
4. **Testing:** Viết unit test cho gamification engine, integration test cho API
5. **i18n cơ bản:** Hỗ trợ tiếng Việt cho UI

**Trung hạn (3-6 tháng):**
6. **Collaborative hints:** Hiển thị cursor vị trí của người cùng chỉnh sửa (không cần CRDT đầy đủ)
7. **Nâng cấp Gamification:**
   - Thêm quest types mới (streak milestones, guild contributions)
   - Hệ thống badge hiển thị trên avatar
   - Event đặc biệt (theo mùa, sự kiện)
8. **Guild nâng cao:** Guild level, guild quests, guild treasury
9. **PWA:** Offline mode, push notifications qua Service Worker
10. **Mobile app:** React Native hoặc PWA tối ưu cho mobile

**Dài hạn (6-12 tháng):**
11. **Full collaborative editing:** Tích hợp Yjs hoặc tương tự cho real-time collaboration
12. **AI nâng cao:** AI gợi ý tags, tự động categorize, smart search với embeddings
13. **Marketplace:** Người dùng có thể tạo và chia sẻ quest templates, theme tùy chỉnh
14. **Analytics dashboard:** Thống kê chi tiết thói quen ghi chú, insight cá nhân hóa
15. **API công khai:** REST API cho third-party integrations

---

*Báo cáo này được tạo tự động từ codebase của dự án TavernoteX — phiên bản 0.1.0 — ngày 11 tháng 6 năm 2026.*
