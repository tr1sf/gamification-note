# Tracking & Analytics System — Plan

> **Ngày:** 2026-06-12
> **Trạng thái:** Kế hoạch (chưa triển khai)
> **Mục đích:** Đo lường hiệu quả gamification cho báo cáo luận văn

---

## 1. Tổng quan

Hệ thống tracking sẽ thu thập dữ liệu từ **7 nhóm** để đánh giá hiệu quả gamification, dựa trên:
- Self-Determination Theory (Autonomy, Competence, Relatedness)
- Octalysis Gamification Framework
- Retention & Engagement metrics

### 1.1 Data Collection Philosophy
- **Server-side tracking** (AuditLog) cho tất cả action quan trọng
- **Minimal client-side** — chỉ track page views và session duration
- **No PII** — không track IP, browser fingerprint, location
- **GDPR-friendly** — survey là optional, dữ liệu aggregate khi báo cáo
- **Transparency** — user có thể xem "My Data" trong Settings

---

## 2. Event Tracking Architecture

### 2.1 Mở rộng AuditLog hiện có

AuditLog hiện tại đã có: `userId`, `actionType`, `xpChange`, `coinChange`, `metadata`, `createdAt`.

**Chiến lược:** KHÔNG tạo bảng mới — chỉ cần **chuẩn hóa metadata** theo convention:

```typescript
// Unified metadata interface per actionType
type AuditMetadata = {
  // ── App Usage ──
  sessionId?: string;
  device?: 'desktop' | 'mobile' | 'tablet';
  duration?: number;          // seconds (for session_end)
  page?: string;              // current route
  tab?: string;               // dashboard tab

  // ── Note ──
  noteId?: string;
  noteTitle?: string;
  wordCount?: number;
  wordDelta?: number;         // change in word count
  timeSinceCreated?: number;  // seconds
  timeSinceLastView?: number;
  isOwnNote?: boolean;
  daysSinceCreated?: number;  // for review_note
  shareType?: string;         // 'public' | 'link'
  exportFormat?: string;      // 'md' | 'txt' | 'html'
  
  // ── Note Quality ──
  structureScore?: number;    // 0-10 auto-calculated
  hasH1?: boolean;
  hasH2?: boolean;
  hasList?: boolean;
  hasCode?: boolean;
  hasImage?: boolean;
  linkCount?: number;
  tagCount?: number;
  hasCategory?: boolean;
  hasAiSummary?: boolean;
  isBlockContent?: boolean;

  // ── Gamification ──
  questId?: string;
  questTitle?: string;
  questType?: string;          // 'daily' | 'weekly' | 'monthly'
  questTarget?: number;
  questProgress?: number;
  questDuration?: number;      // seconds to complete
  declineReason?: string;      // 'too_hard' | 'not_interested' | 'busy'
  achievementId?: string;
  achievementTitle?: string;
  levelBefore?: number;
  levelAfter?: number;
  xpReward?: number;
  coinReward?: number;
  itemType?: string;           // 'theme' | 'badge' | 'frame'
  itemName?: string;
  coinCost?: number;
  coinBalance?: number;

  // ── Habit ──
  habitId?: string;
  habitTitle?: string;
  streakBefore?: number;
  streakAfter?: number;
  maxStreak?: number;

  // ── Community ──
  guildId?: string;
  guildName?: string;
  role?: string;
  messageLength?: number;
  taskId?: string;
  taskTitle?: string;
  assigneeId?: string;
  viewerId?: string;
  viewerCount?: number;
  commentLength?: number;

  // ── Survey ──
  surveyId?: string;
  surveyType?: string;
  questionId?: string;
  questionText?: string;
  answerScore?: number;        // Likert 1-5
  answerText?: string;
  overallScore?: number;
};
```

---

## 3. Event Types — 7 Nhóm Dữ liệu

### 3.1 Nhóm 1: Sử dụng App

| Event Name | Trigger | Metadata | Purpose |
|-----------|---------|----------|---------|
| `session_start` | Login / mở app | `sessionId`, `device`, `page` | Đo DAU, login frequency |
| `session_end` | Logout / idle 30min | `sessionId`, `duration` | Đo session length |
| `page_view` | Route change | `page`, `time` | Đo feature usage |
| `dashboard_open` | Mở dashboard | `tab` (notes, quests, guild, etc.) | Đo which tab most used |

### 3.2 Nhóm 2: Ghi chú

| Event Name | Trigger | Metadata | Purpose |
|-----------|---------|----------|---------|
| `note_create` | Create note | `noteId`, `wordCount`, `isBlockContent`, `hasTags`, `hasCategory`, `hasTitle` | Đo note creation behavior |
| `note_edit` | Save edit | `noteId`, `wordDelta`, `timeSinceCreated` | Đo editing patterns |
| `note_view` | Mở note detail | `noteId`, `timeSinceLastView`, `isOwnNote` | Đo what notes get viewed |
| `note_delete` | Soft delete | `noteId`, `age` (days since created) | Đo deletion patterns |
| `note_search` | Search query | `query`, `resultCount` | Đo search behavior |
| `note_share` | Make public / copy link | `noteId`, `shareType` | Đo sharing |
| `note_export` | Export to file | `noteId`, `format` | Đo export usage |
| `note_ai_summarize` | Use AI summarize | `noteId`, `wordCount` | Đo AI feature usage |
| `note_review` | View note >7 days old | `noteId`, `daysSinceCreated` | Đo review behavior |

### 3.3 Nhóm 3: Chất lượng Note

| Event Name | Trigger | Metadata | Purpose |
|-----------|---------|----------|---------|
| `note_quality_score` | Auto (on save) | `noteId`, `structureScore`, `hasH1`, `hasList`, `hasCode`, `linkCount`, `tagCount`, `wordCount` | Đo whether users create quality notes or spam |

**Cách tính `structureScore` (0-10):**
```typescript
function calculateStructureScore(blocksOrContent: string, tags: string[], category: string | null): number {
  let score = 0;
  
  const blocks = parseBlocks(blocksOrContent);
  const hasH1 = blocks.some(b => b.type === 'heading' && b.attrs?.level === 1);
  const hasH2 = blocks.some(b => b.type === 'heading' && b.attrs?.level === 2);
  const hasList = blocks.some(b => b.type === 'bulletList' || b.type === 'orderedList');
  const hasCode = blocks.some(b => b.type === 'codeBlock');
  const linkCount = blocks.filter(b => b.type === 'paragraph' && b.content?.some(c => c.type === 'link')).length;
  const wordCount = computeBlockWordCount(blocks);
  const hasImage = blocks.some(b => b.type === 'image');
  
  if (hasH1) score += 1;            // 1: có heading chính
  if (hasH2) score += 1;            // 1: có sub-heading (cấu trúc)
  if (hasList) score += 1;          // 1: có danh sách
  if (hasCode) score += 1;          // 1: có code
  if (linkCount > 0) score += Math.min(linkCount, 2); // 0-2: có reference
  if (wordCount > 50) score += 1;   // 1: đủ dài
  if (wordCount > 200) score += 1;  // 1: khá dài
  if (tags.length > 0) score += 1;  // 1: có tags
  if (category) score += 1;         // 1: có category
  
  return Math.min(10, score);
}
```

### 3.4 Nhóm 4: Gamification

| Event Name | Trigger | Metadata | Purpose |
|-----------|---------|----------|---------|
| `quest_view` | Mở quest board | `questId`, `questType` | Đo quest visibility |
| `quest_accept` | Quest assigned (rotation) | `questId`, `questTitle`, `questType` | Đo quest acceptance |
| `quest_complete` | Finish quest | `questId`, `questTitle`, `questType`, `questTarget`, `questDuration` | Đo quest completion |
| `quest_decline` | Decline quest | `questId`, `questTitle`, `declineReason` | Đo why users decline |
| `reward_claim` | Claim XP/coins | `questId`, `xpReward`, `coinReward` | Đo reward claiming |
| `level_up` | Level up | `levelBefore`, `levelAfter`, `title` | Đo level progression |
| `achievement_unlock` | Unlock achievement | `achievementId`, `achievementTitle` | Đo achievement appeal |
| `coin_spend` | Spend coins in shop | `itemType`, `itemName`, `coinCost`, `coinBalance` | Đo shop usage |
| `xp_gained` | Any XP gain | `source` (action type), `amount` | Đo XP acquisition rate |

### 3.5 Nhóm 5: Duy trì Thói quen

| Event Name | Trigger | Metadata | Purpose |
|-----------|---------|----------|---------|
| `habit_checkin` | Complete habit | `habitId`, `habitTitle` | Đo habit tracking |
| `streak_maintain` | Keep streak alive | `currentStreak`, `maxStreak` | Đo streak engagement |
| `streak_break` | Lose streak | `previousStreak`, `daysSinceLastLogin` | Đo why streaks break |
| `daily_login` | First login of day (existing) | `streak`, `daysActiveThisWeek` | Đo DAU retention |
| `retention_day3` | (Calculated) User active on day 3 after signup | — | Đo short-term retention |
| `retention_day7` | (Calculated) User active on day 7 after signup | — | Đo medium-term retention |
| `retention_day30` | (Calculated) User active on day 30 after signup | — | Đo long-term retention |

**Retention Calculation:**
```sql
-- D3 Retention = users active on day 3 / total signups on day 0
SELECT 
  DATE(signup.createdAt) as cohort,
  COUNT(DISTINCT signup.userId) as signups,
  COUNT(DISTINCT active.userId) as retained,
  ROUND(COUNT(DISTINCT active.userId) * 100.0 / COUNT(DISTINCT signup.userId), 2) as retention_pct
FROM User signup
LEFT JOIN AuditLog active ON active.userId = signup.userId 
  AND active.actionType = 'session_start'
  AND active.createdAt >= DATE(signup.createdAt + INTERVAL '3 days')
  AND active.createdAt < DATE(signup.createdAt + INTERVAL '4 days')
WHERE signup.createdAt >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(signup.createdAt)
ORDER BY cohort;
```

### 3.6 Nhóm 6: Cộng đồng

| Event Name | Trigger | Metadata | Purpose |
|-----------|---------|----------|---------|
| `guild_join` | Join guild | `guildId`, `guildName`, `role` | Đo social adoption |
| `guild_leave` | Leave guild | `guildId`, `guildName`, `daysMember` | Đo guild retention |
| `guild_message` | Send message | `guildId`, `messageLength` | Đo communication |
| `guild_task_create` | Create task | `guildId`, `taskId`, `taskTitle` | Đo collaboration |
| `guild_task_complete` | Complete task | `guildId`, `taskId`, `taskTitle`, `assigneeId` | Đo task completion |
| `share_view` | Someone views shared note | `noteId`, `viewerId?` (null if anonymous) | Đo note reach |
| `profile_view` | View someone's profile | `targetUserId` | Đo social interaction |

### 3.7 Nhóm 7: Cảm nhận Người dùng

| Event Name | Trigger | Metadata | Purpose |
|-----------|---------|----------|---------|
| `survey_start` | Open survey | `surveyId`, `surveyType` | Đo survey engagement |
| `survey_question` | Answer question | `surveyId`, `questionId`, `questionText`, `answerScore` | Đo individual question |
| `survey_complete` | Submit survey | `surveyId`, `surveyType`, `overallScore`, `answers` (all scores) | Đo overall satisfaction |
| `survey_abandon` | Close without submit | `surveyId`, `lastQuestion` | Đo survey drop-off |
| `feedback_submit` | Submit text feedback | `feedbackType`, `feedbackText` | Qualitative data |

---

## 4. Survey System

### 4.1 Database Schema

```prisma
model Survey {
  id          String   @id @default(uuid()) @db.Uuid
  title       String                         // "Đánh giá trải nghiệm TavernoteX"
  description String?
  surveyType  String   @default("post_signup") // post_signup | weekly | monthly | post_level_up | custom
  questions   Json     @default("[]")         // [{id, text, type ("likert"|"text"), required}]
  
  // Trigger rules
  triggerDaysAfterSignup Int?               // 7 = show after 7 days
  triggerAfterLevelUp   Boolean @default(false)
  triggerWeekly         Boolean @default(false)  // Every Sunday
  triggerMonthly        Boolean @default(false)  // First of month
  
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  
  responses SurveyResponse[]
}

model SurveyResponse {
  id          String   @id @default(uuid()) @db.Uuid
  surveyId    String   @db.Uuid
  userId      String   @db.Uuid
  answers     Json                              // [{questionId, answerScore, answerText}]
  overallScore Float?                           // Average Likert score
  comments    String?                           // Free text feedback
  completedAt DateTime @default(now())
  
  survey Survey @relation(fields: [surveyId], references: [id], onDelete: Cascade)
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@unique([surveyId, userId])                  // One response per survey per user
  @@index([userId, completedAt])
}
```

### 4.2 Survey Questions (Post-Signup — 7 days)

| # | Question | Type | Dimension |
|---|---------|------|-----------|
| 1 | Tôi cảm thấy có động lực ghi chú hơn khi dùng TavernoteX | Likert 1-5 | Motivation / Intrinsic |
| 2 | Tôi thích cảm giác được tự do lựa chọn cách ghi chú của mình | Likert 1-5 | Autonomy (SDT) |
| 3 | Tôi cảm thấy mình đang tiến bộ trong việc ghi chú | Likert 1-5 | Competence (SDT) |
| 4 | Tôi cảm thấy thoải mái khi chia sẻ note và tham gia guild | Likert 1-5 | Relatedness (SDT) |
| 5 | Hệ thống XP/quest giúp tôi duy trì thói quen ghi chú | Likert 1-5 | Gamification Efficacy |
| 6 | Tôi KHÔNG cảm thấy áp lực hoặc lo lắng về điểm số/XP | Likert 1-5 (đảo) | Pressure (negative) |
| 7 | Tôi thấy quest và achievement phù hợp với nhu cầu của tôi | Likert 1-5 | Personalization |
| 8 | Tôi sẽ tiếp tục dùng app này trong thời gian tới | Likert 1-5 | Retention Intent |
| 9 | Bạn có ý kiến hoặc góp ý gì không? | Text | Qualitative |

### 4.3 Survey Triggers

```typescript
// Khi login: kiểm tra nếu cần show survey
async function checkSurveyTrigger(userId: string): Promise<Survey | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const daysSinceSignup = daysBetween(user.createdAt, new Date());
  
  // Tìm survey active, chưa trả lời
  const activeSurveys = await prisma.survey.findMany({
    where: { isActive: true },
    include: { 
      responses: { 
        where: { userId },
        select: { id: true }
      }
    },
  });
  
  for (const survey of activeSurveys) {
    if (survey.responses.length > 0) continue; // Already answered
    
    // Check trigger conditions
    if (survey.triggerDaysAfterSignup && daysSinceSignup >= survey.triggerDaysAfterSignup) {
      return survey;
    }
    if (survey.triggerAfterLevelUp) {
      // Check if just leveled up (from recent audit log)
      const recentLevelUp = await prisma.auditLog.findFirst({
        where: { userId, actionType: 'level_up', createdAt: { gte: new Date(Date.now() - 3600000) } }
      });
      if (recentLevelUp) return survey;
    }
  }
  
  return null;
}
```

---

## 5. Analytics API

### 5.1 Endpoints

```typescript
// src/routes/api/analytics/overview.ts (ADMIN ONLY)
GET /api/analytics/overview
Response: {
  dau: number,                      // Daily Active Users
  wau: number,                      // Weekly Active Users
  mau: number,                      // Monthly Active Users
  totalUsers: number,
  totalNotes: number,
  avgNotesPerUser: number,
  avgNoteQuality: number,           // Average structureScore (0-10)
  avgSessionDuration: number,       // Seconds
  avgNotesPerSession: number,
  questCompletionRate: number,      // % quests completed vs total assigned
  gamificationEngagement: number,   // % users who interacted with quests/XP
  shopEngagement: number,           // % users who spent coins
  streakRetention: number,          // % users with streak >= 7
  guildAdoption: number,            // % users in guild
  surveyAvg: {                      // Average scores from latest survey
    motivation: number,
    autonomy: number,
    competence: number,
    relatedness: number,
    gamificationEfficacy: number,
    pressure: number,               // Lower is better
    personalization: number,
    retention: number,
  },
  surveyResponseRate: number,       // % users who completed survey
}

// src/routes/api/analytics/retention.ts (ADMIN ONLY)
GET /api/analytics/retention?days=90
Response: {
  cohorts: [
    { date: "2026-01-15", signups: 50, d3: 65%, d7: 42%, d30: 28% },
    ...
  ],
  overall: { d3: 68%, d7: 45%, d30: 30% },
}

// src/routes/api/analytics/gamification.ts (ADMIN ONLY)
GET /api/analytics/gamification?period=30days
Response: {
  xpDistribution: { "0-100": 40%, "100-500": 35%, "500-1000": 15%, "1000+": 10% },
  levelDistribution: { "1-5": 60%, "6-10": 25%, "11-20": 12%, "20+": 3% },
  topQuests: [{ title, completedCount, completionRate }],
  topAchievements: [{ title, unlockedCount }],
  coinBalanceDistribution: { "0": 20%, "1-50": 45%, "51-200": 25%, "200+": 10% },
  streaks: { "0": 15%, "1-3": 40%, "4-6": 25%, "7-14": 15%, "14+": 5% },
}

// src/routes/api/analytics/notes.ts (ADMIN ONLY)
GET /api/analytics/notes?period=30days
Response: {
  totalNotes: number,
  avgWordsPerNote: number,
  qualityDistribution: { "0-3": 15%, "4-6": 45%, "7-8": 30%, "9-10": 10% },
  topTags: [{ tag, count }],
  topCategories: [{ category, count }],
  aiUsageRate: number,             // % notes using AI summarize
  publicRate: number,              // % notes public
}

// src/routes/api/users/my-stats.ts (USER)
GET /api/users/my-stats
Response: {
  totalNotes: number,
  totalWords: number,
  avgWordsPerNote: number,
  avgQualityScore: number,
  totalQuestsCompleted: number,
  totalAchievements: number,
  currentStreak: number,
  longestStreak: number,
  daysActive: number,
  mostProductiveHour: number,
  mostProductiveDay: string,
  topTags: [{ tag, count }],
  // So với trung bình platform (anonymous)
  comparedToAvg: {
    notes: "top 30%",
    quality: "top 15%",
    engagement: "top 45%",
    streak: "top 10%",
  },
}
```

---

## 6. Implementation Order

| Phase | Feature | Files | Effort |
|-------|---------|-------|--------|
| **1** | Mở rộng AuditLog metadata chuẩn | `engine.ts` (cập nhật cách gọi AuditLog), các API routes (thêm metadata vào event) | 2h |
| **2** | Session tracking | `session_start/end`, `page_view` events, auto-trigger ở middleware/layout | 1.5h |
| **3** | Note quality scoring | `src/lib/analytics/quality-scorer.ts`, auto-trigger on note save | 1h |
| **4** | Event tracking trong API routes | Thêm AuditLog entries vào tất cả các action: create/update/delete note, quest, guild, habit, shop | 3h |
| **5** | Survey system | `Survey` + `SurveyResponse` models, API CRUD, UI form | 3h |
| **6** | Analytics API (admin) | `/api/analytics/overview`, `/retention`, `/gamification`, `/notes` | 3h |
| **7** | My Stats page (user) | `/stats` page, `MyStatsCard`, `ComparedToAvg` | 2h |
| **8** | Analytics Dashboard (admin) | Admin page with charts (bar, line, pie) | 3h |

**Total: ~18.5 hours**

---

## 7. Privacy & Ethics

### 7.1 Principles
- **Opt-in for survey**: Always voluntary, có nút "Skip for now"
- **Aggregate only**: Analytics dashboard NEVER shows individual user data
- **Anonymization**: "My Stats" comparison uses percentile (top X%), not rank
- **Data retention**: AuditLog auto-archives after 180 days (configurable)
- **Deletion**: When user deletes account, ALL their AuditLog + SurveyResponse deleted (cascade)

### 7.2 User Transparency
- Settings page: "Data & Privacy" tab
- Show: "App đang thu thập các dữ liệu sau để cải thiện trải nghiệm..."
- Checkbox opt-out of analytics (opt-out không affect gamification, chỉ không log vào AuditLog phân tích)

---

## 8. Metrics for Thesis Report

Đây là các metrics chính để đưa vào báo cáo luận văn:

### 8.1 Effectiveness Metrics (Gamification works?)
| Metric | Calculation | Hypothesis |
|--------|------------|-----------|
| **DAU growth** | Δ DAU week-over-week | Gamification increases app stickiness |
| **Retention D7** | % users active on day 7 | Gamification improves short-term retention |
| **Avg notes/user/week** | Σ notes ÷ active users per week | Gamification increases note-taking frequency |
| **Quest completion rate** | completed ÷ (completed + expired) | Users engage with quest mechanics |
| **Level progression** | avg level delta per month | XP system motivates continued use |
| **Streak rate** | % users with streak ≥ 7 | Streak mechanic sustains daily habit |
| **Avg note quality** | avg structureScore | Quality-based rewards reduce spam |

### 8.2 Perception Metrics (Users like it?)
| Metric | Calculation | Hypothesis |
|--------|------------|-----------|
| **Survey: Motivation** | avg score Q1 | Gamification increases writing motivation |
| **Survey: Autonomy** | avg score Q2 | Users feel in control, not forced |
| **Survey: Competence** | avg score Q3 | XP/levels create sense of progress |
| **Survey: Relatedness** | avg score Q4 | Guild/sharing creates social bond |
| **Survey: Gamification Efficacy** | avg score Q5 | Quests/XP directly help habit formation |
| **Survey: Pressure** | avg score Q6 (inverted) | Low pressure = healthy gamification |
| **Survey: Retention Intent** | avg score Q8 | Users intend to continue using |
| **Survey response rate** | % users who completed survey | Survey engagement indicates interest |

### 8.3 Comparison Metrics (With gamification vs without)
| Metric | Baseline (week 1, no gamification) | Post-gamification (week 4+) |
|--------|-------------------------------------|---------------------------|
| DAU | — | — |
| Avg notes/user | — | — |
| Avg session duration | — | — |
| Retention D7 | — | — |

---

## 9. File Structure

```
src/
├── lib/
│   └── analytics/
│       ├── tracker.ts            // Central tracking function
│       ├── quality-scorer.ts     // Note quality auto-scoring
│       ├── session.ts            // Session management
│       └── types.ts              // AuditMetadata types
├── components/
│   └── analytics/
│       ├── MyStatsCard.tsx       // User's personal stats
│       ├── ComparedToAvg.tsx     // "You're in top X%"
│       ├── StatsChart.tsx        // Reusable chart component
│       └── SurveyWidget.tsx      // Survey popup/modal
├── routes/
│   ├── (app)/
│   │   ├── stats.tsx             // My Stats page
│   │   └── settings/
│   │       └── data.tsx          // Data & Privacy settings
│   └── api/
│       ├── analytics/
│       │   ├── overview.ts       // Admin: aggregate overview
│       │   ├── retention.ts      // Admin: cohort retention
│       │   ├── gamification.ts   // Admin: gamification stats
│       │   └── notes.ts          // Admin: note analytics
│       ├── surveys/
│       │   ├── index.ts          // GET active surveys, POST response
│       │   ├── [id].ts           // GET survey detail + questions
│       │   └── admin.ts          // Admin CRUD surveys
│       └── users/
│           ├── my-stats.ts       // User's own stats
│           └── data-export.ts    // Export all user data (GDPR)
```
