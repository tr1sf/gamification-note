# AI Quest System — Plan

> **Ngày:** 2026-06-11
> **Trạng thái:** Kế hoạch (chưa triển khai)
> **Sau khi hoàn thành Challenge System**

---

## 1. Concept

Thay vì quest cố định (seed DB), hệ thống sẽ **phân tích hành vi người dùng** và đề xuất quest phù hợp. Quest có thể:
- **Rule-based**: Áp dụng rules từ user stats (nhanh, free, deterministic)
- **AI-generated**: Gọi Gemini API để tạo quest sáng tạo (linh hoạt, tốn token)

---

## 2. User Behavior Analysis

### 2.1 Dữ liệu thu thập
| Metric | Nguồn | Ý nghĩa |
|--------|-------|---------|
| `lastNoteCreatedAt` | Note table | Phát hiện lười ghi chú |
| `avgNoteLength` | Note content | Phát hiện note dài/ngắn |
| `noteCountThisWeek` | AuditLog | Tốc độ viết |
| `overdueTasks` | GuildTask | Quản lý công việc |
| `studyTimePattern` | AuditLog (hour) | Giờ thường học |
| `favoriteTags` | Note tags | Sở thích chủ đề |
| `streak` | User table | Độ duy trì |
| `aiSummaryCount` | AuditLog | Mức độ dùng AI |
| `reviewCount` | AuditLog | Tần suất review |

### 2.2 Phân tích real-time
```typescript
interface UserBehaviorProfile {
  lastActive: Date;
  daysSinceLastNote: number;
  avgNoteLength: number;
  notesThisWeek: number;
  notesThisMonth: number;
  overdueTasks: number;
  studyHours: number[]; // [0,0,0,1,0,2,0...] 24h
  topTags: string[];
  aiUsage: number;
  streak: number;
  mostProductiveDay: string;
  mostProductiveHour: number;
}
```

---

## 3. Quest Generation Rules

### 3.1 Rule-Based (Primary)

```typescript
const questRules = [
  // Insight: Lười ghi chú
  {
    id: 'warm-up',
    condition: (profile) => profile.daysSinceLastNote > 2,
    quest: {
      title: 'Warm-up Writer',
      description: 'Bạn đã ${days} ngày không ghi chú. Viết 1 note ngắn 100 từ để lấy lại nhịp!',
      action: 'create_note',
      target: 1,
      xpReward: 15,
      coinReward: 5,
      urgency: 'high',
    }
  },
  
  // Insight: Note dài chưa tóm tắt
  {
    id: 'summarizer',
    condition: (profile) => profile.avgNoteLength > 800,
    quest: {
      title: 'Insight Miner',
      description: 'Bạn có note dài trung bình ${avg} từ. Hãy tóm tắt 1 note thành 5 bullet!',
      action: 'ai_summarize',
      target: 1,
      xpReward: 20,
      coinReward: 5,
    }
  },
  
  // Insight: Nhiều task quá hạn
  {
    id: 'task-breaker',
    condition: (profile) => profile.overdueTasks > 3,
    quest: {
      title: 'Task Breaker',
      description: 'Bạn có ${overdue} task quá hạn. Hoàn thành 1 task nhỏ trong 15 phút!',
      action: 'complete_task',
      target: 1,
      xpReward: 15,
      coinReward: 5,
      urgency: 'high',
    }
  },
  
  // Insight: Hay học buổi tối
  {
    id: 'night-scholar',
    condition: (profile) => profile.mostProductiveHour >= 19,
    quest: {
      title: 'Night Scholar',
      description: 'Bạn thường học hiệu quả lúc ${hour}h. Tạo 1 focus session lúc ${hour}h!',
      action: 'create_note',
      target: 1,
      xpReward: 10,
      coinReward: 3,
    }
  },
  
  // Insight: Streak sắp đứt
  {
    id: 'streak-saver',
    condition: (profile) => profile.streak > 5 && profile.daysSinceLastNote === 1,
    quest: {
      title: 'Streak Keeper',
      description: 'Chuỗi ${streak} ngày của bạn sắp đứt! Viết 1 note ngay!',
      action: 'create_note',
      target: 1,
      xpReward: 10,
      coinReward: 3,
      urgency: 'high',
    }
  },
  
  // Insight: Ít dùng AI
  {
    id: 'ai-explorer',
    condition: (profile) => profile.aiUsage < 3,
    quest: {
      title: 'AI Explorer',
      description: 'Bạn chưa thử AI summarize nhiều. Hãy dùng AI tóm tắt 1 note!',
      action: 'ai_summarize',
      target: 1,
      xpReward: 20,
      coinReward: 5,
    }
  },
  
  // Insight: Nhiều note chưa review
  {
    id: 'reviewer',
    condition: (profile, notes) => notes.filter(n => daysOld(n) > 14).length > 5,
    quest: {
      title: 'Knowledge Keeper',
      description: 'Bạn có ${count} note chưa xem lại > 2 tuần. Hãy review 1 note cũ!',
      action: 'review_note',
      target: 1,
      xpReward: 10,
      coinReward: 3,
    }
  },
  
  // Insight: Viết nhiều nhưng không chia sẻ
  {
    id: 'sharer',
    condition: (profile, notes) => notes.filter(n => n.isPublic).length === 0 && profile.notesThisMonth > 5,
    quest: {
      title: 'Knowledge Sharer',
      description: 'Bạn đã viết ${count} note nhưng chưa chia sẻ! Hãy public 1 note!',
      action: 'make_public',
      target: 1,
      xpReward: 15,
      coinReward: 5,
    }
  },
];
```

### 3.2 AI-Generated (Secondary)

```typescript
// Khi rule-based không đủ hoặc user muốn "creative mode"
async function generateAIQuest(profile: UserBehaviorProfile): Promise<Quest> {
  const prompt = `
    Dựa trên hành vi của user:
    - Ngày cuối ghi note: ${profile.daysSinceLastNote} ngày trước
    - Số note tuần này: ${profile.notesThisWeek}
    - Độ dài TB: ${profile.avgNoteLength} từ
    - Task quá hạn: ${profile.overdueTasks}
    - Giờ học hiệu quả: ${profile.mostProductiveHour}h
    - Streak hiện tại: ${profile.streak}
    
    Hãy tạo 1 quest ngắn (title, description, action, target) bằng tiếng Việt.
    Phong cách: Gợi ý thân thiện, không áp lực, khuyến khích.
    Action phải là 1 trong: create_note, review_note, ai_summarize, make_public, complete_task.
    Target: 1 (luôn đơn giản).
  `;
  
  const response = await gemini.generate(prompt);
  return parseQuest(response);
}
```

---

## 4. Database Schema

```prisma
model AIQuest {
  id          String   @id @default(uuid()) @db.Uuid
  userId      String   @db.Uuid
  title       String
  description String
  actionType  String
  target      Int      @default(1)
  xpReward    Int      @default(10)
  coinReward  Int      @default(3)
  
  // Generation
  source      String   @default("rule")     // rule | ai
  ruleId      String?                      // e.g. "warm-up", "summarizer"
  reason      String?                      // Lý do tạo quest (show user)
  
  // Status
  status      String   @default("active")   // active | completed | declined | expired
  completedAt DateTime?
  declinedAt  DateTime?
  expiresAt   DateTime?                    // Auto expire sau 24h hoặc 48h
  
  // Gamification
  rewarded    Boolean  @default(false)
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId, status])
  @@index([status, expiresAt])
  @@index([createdAt])
}

// Thêm vào User model:
// aiQuests AIQuest[]
```

---

## 5. API Routes

```typescript
// src/routes/api/ai-quests/index.ts
GET    /api/ai-quests              // List active AI quests for user
POST   /api/ai-quests/generate     // Generate new AI quests (rule-based)
POST   /api/ai-quests/generate-ai // Generate with Gemini API

// src/routes/api/ai-quests/[id].ts
POST   /api/ai-quests/:id/complete // Complete quest
POST   /api/ai-quests/:id/decline // User decline (không thích quest này)
PUT    /api/ai-quests/:id         // Update (admin)

// src/routes/api/users/behavior.ts
GET    /api/users/behavior-profile // Get user behavior stats (for debugging)
```

---

## 6. Frontend Components

### 6.1 Pages
- `src/routes/(app)/ai-quests.tsx` — AI Quest Dashboard (mới)

### 6.2 Components
- `src/components/ai-quests/AIQuestCard.tsx` — Card hiển thị quest + reason
- `src/components/ai-quests/AIQuestList.tsx` — Danh sách quest
- `src/components/ai-quests/BehaviorInsight.tsx` — Hiển thị "Tại sao bạn nhận quest này"
- `src/components/ai-quests/GenerateButton.tsx` — Button generate quest mới
- `src/components/ai-quests/DeclineModal.tsx` — Hỏi lý do decline

### 6.3 UI Mockup
```
┌─────────────────────────────────────────────────────────┐
│  🎯 AI Quests                              [Generate]  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 🔥 Warm-up Writer                          15 XP │   │
│  │                                                 │   │
│  │ Bạn đã 3 ngày không ghi chú. Viết 1 note ngắn  │   │
│  │ 100 từ để lấy lại nhịp!                         │   │
│  │                                                 │   │
│  │ 💡 Tại sao: Bạn thường viết note mỗi ngày, nhưng│   │
│  │    đã 3 ngày không hoạt động.                   │   │
│  │                                                 │   │
│  │ [Complete]  [Decline]  [Remind me later]        │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 💎 Insight Miner                           20 XP │   │
│  │                                                 │   │
│  │ Bạn có note dài trung bình 1200 từ. Hãy tóm tắt │   │
│  │ 1 note thành 5 bullet!                          │   │
│  │                                                 │   │
│  │ 💡 Tại sao: Note của bạn thường dài, việc tóm   │   │
│  │    tắt giúp ghi nhớ lâu hơn.                    │   │
│  │                                                 │   │
│  │ [Complete]  [Decline]  [Remind me later]        │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 7. Gamification Integration

### 7.1 Actions
```typescript
// Khi complete AI quest:
processAction({
  userId,
  actionType: 'complete_ai_quest',
  metadata: {
    questId,
    questTitle,
    source: 'rule' | 'ai',
    xpReward,
    coinReward,
  }
});

// Khi decline AI quest:
processAction({
  userId,
  actionType: 'decline_ai_quest',
  metadata: {
    questId,
    reason: 'too_hard' | 'not_interested' | 'busy',
  }
});
```

### 7.2 Achievements
- **"AI Listener"**: Complete 10 AI quests → +100 XP
- **"Feedback Provider"**: Decline 5 quests và đưa lý do → +50 XP
- **"Early Adopter"**: Complete 1 AI quest trong ngày đầu → +30 XP

---

## 8. Implementation Order

| Phase | Feature | Effort |
|-------|---------|--------|
| 1 | DB Schema (AIQuest table) | 30 min |
| 2 | Behavior Profile API | 1h |
| 3 | Rule-based Generator | 2h |
| 4 | AI Quest API (CRUD) | 1h |
| 5 | AI Quest Dashboard Page | 2h |
| 6 | Gamification Integration | 1h |
| 7 | Gemini API Integration (optional) | 1.5h |
| 8 | Testing & Polish | 1h |

**Total: ~10 hours**

---

## 9. Questions cho bạn

| # | Câu hỏi | Ý nghĩa |
|---|---------|---------|
| 1 | **Quest expire sau bao lâu?** | 24h? 48h? 7 ngày? Hay không expire? |
| 2 | **Tối đa bao nhiêu AI quest active?** | 1? 3? 5? |
| 3 | **User có thể "decline" quest không?** | Có → lý do gì? Không → buộc phải làm hoặc để expire? |
| 4 | **AI Quest thay thế hay bổ sung static quests?** | A) Thay luôn (không còn quest cố định) / B) Có cả 2 (AI quest ở tab riêng) / C) AI quest chỉ khi static không phù hợp |
| 5 | **Generate tần suất?** | A) Mỗi ngày 1 lần (login) / B) Real-time (phát hiện behavior change) / C) User tự nhấn Generate / D) Tất cả |
| 6 | **Có "Remind me later" không?** | Có → Snooze 2h? 4h? 1 ngày? |
| 7 | **Có Gemini API luôn hay chỉ rule-based?** | A) Chỉ rule-based (nhanh, free) / B) Có Gemini option (creative mode) / C) Gemini primary (rule fallback) |
| 8 | **Có thể tích hợp vào Challenge System không?** | AI phân tích → tạo Challenge tự động (e.g., "AI thấy bạn lười → tạo Challenge 'Viết 3 note' với theme 'Procrastination'") |

---

## 10. Tích hợp với Challenge System

**Ý tưởng:** Khi AI phát hiện behavior pattern đặc biệt (ví dụ: lười 5 ngày), không chỉ tạo AI quest mà còn tạo **Challenge** tự động:

```
AI phân tích:
  "User đã 5 ngày không ghi chú. Streak sắp đứt."

→ Tạo Challenge tự động:
  Title: "Comeback Writer"
  Theme: Growth (cây héo → cây sống lại)
  Target: 3 note trong 3 ngày
  Actions: 
    - Day 1: "Viết 50 từ" (nhẹ nhàng)
    - Day 2: "Viết 100 từ" (tăng dần)
    - Day 3: "Viết 200 từ" (lấy lại nhịp)
  Reward: +50 XP, unlock "Comeback" badge
```
