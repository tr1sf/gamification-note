---
title: "TavernoteX — Implementation Plan v2"
description: "Gamified note-taking web app with tavern theme: SolidStart + PostgreSQL + Prisma + Socket.io + OpenAI"
status: active
priority: P1
effort: 120h
issue: null
branch: main
tags: [fullstack, gamification, solidstart, postgresql, prisma, socketio, openai]
created: 2026-05-09
updated: 2026-06-13
---

# TavernoteX — Implementation Plan v2

## Overview

Build a gamified note-taking web application with medieval tavern aesthetics.
Users role-play as adventurers on a knowledge journey — taking notes (scrolls),
completing quests, leveling up, joining guilds, and earning rewards.

Tech: **SolidStart** (full-stack SSR/API), **TailwindCSS** + CSS Custom Properties,
**PostgreSQL** + **Prisma**, **Socket.io** (presence + chat + edit lock),
**OpenAI** (GPT-4o-mini summarize + DALL-E image gen).

Deploy target: **Railway.app** (WebSocket + PostgreSQL native support).

## Adjusted from Original Plan (Document Review Findings)

| Issue | Severity | Resolution |
|-------|----------|------------|
| Netlify can't run WebSocket | CRITICAL | Switch to Railway.app |
| Milkdown is React-only | CRITICAL | React island wrapper for MVP; migrate to ProseMirror later |
| Missing DB tables | HIGH | Added: CosmeticItem, UserInventory, NoteAttachment, AuditLog, UserAchievement |
| No FTS architecture | HIGH | PostgreSQL trigger + GIN index, `'simple'` config for Vietnamese |
| Gamification race conditions | HIGH | Event-driven engine with `SELECT ... FOR UPDATE` |
| Full collaborative editing too ambitious | HIGH | Scoped to: presence + edit lock + version conflict. NO CRDT/OT |
| Missing loading/empty/error states | MEDIUM | Skeleton, EmptyState (8 variants), ErrorFallback for all views |
| No API response standards | MEDIUM | `{ success, data, error, meta }` envelope from first endpoint |
| No input validation | MEDIUM | Zod for all API inputs + env vars |
| No rate limiting | MEDIUM | Token bucket: AI 10/min, auth 5/min login |
| No theming strategy | MEDIUM | CSS Custom Properties in Tailwind — gradual Notion→Tavern migration |

## Phases

| # | Phase | Priority | Effort | Status | Link |
|---|-------|----------|--------|--------|------|
| 0 | Prerequisites | P0 | 8h | **Done** | [phase-00](./phase-00-prerequisites.md) |
| 1 | Core MVP | P0 | 40h | **Done** | [phase-01](./phase-01-core-mvp.md) |
| 2 | Gamification | P0 | 30h | **Done** | [phase-02](./phase-02-gamification.md) |
| 3 | Social & Real-time | P1 | 25h | **Done** | [phase-03](./phase-03-social-realtime.md) |
| 4 | AI & Polish | P1 | 17h | **In Progress** | [phase-04](./phase-04-ai-polish.md) |

**Dependencies:** Sequential. Phase N blocks Phase N+1.

## Future Plans (Post Phase 4)

| # | Plan | Effort | Status | Link |
|---|------|--------|--------|------|
| F1 | Gamification v2 (multi-theme, quality actions, personal progress) | ~40h | Planned | [gamification-v2](./gamification-v2.md) |
| F2 | AI Quest System (AI-driven personalized quests) | ~25h | Planned | [ai-quest-system](./ai-quest-system.md) |
| F3 | Challenge System (user-defined goals + actions) | ~30h | Planned | [challenge-system](./challenge-system.md) |
| F4 | Tracking & Analytics (thesis metrics) | ~20h | Planned | [tracking-analytics](./tracking-analytics.md) |

## New Features (In Development)

Features being added beyond the original scope:

- **Habits** — Habit tracker (`src/routes/(app)/habits.tsx`, `src/stores/habits.ts`, `src/validators/habit.ts`)
- **Guild Notes** — Share notes within guild (`src/components/guild/GuildNotes.tsx`, `src/routes/api/guilds/[id]/notes/`)
- **Guild Tasks** — Task management within guild (`src/components/guild/GuildTasks.tsx`, `src/routes/api/guilds/[id]/tasks/`)
- **AI Summarize** — OpenAI note summarization (`src/lib/ai/`, `src/routes/api/notes/[id]/summarize.ts`)

## Architecture Diagram

```
┌──────────────────────────────────────────────────────┐
│  SolidStart App (SSR + SPA)              Railway.app │
│  ┌──────────┐  ┌───────────┐  ┌──────────┐          │
│  │  Routes   │  │Components │  │  Stores   │          │
│  │(pages+API)│  │(Tavern UI)│  │ (signals) │          │
│  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘          │
│        │               │              │                │
│  ┌─────┴───────────────┴──────────────┴──────┐         │
│  │         lib/ (Business Logic)              │         │
│  │  Auth │ Gamification Engine │ Socket │ AI  │         │
│  └──────────────────────┬────────────────────┘         │
└─────────────────────────┼─────────────────────────────┘
                          │
              ┌───────────┴───────────┐
              │     Prisma ORM        │
              └───────────┬───────────┘
                          │
              ┌───────────┴───────────┐
              │  PostgreSQL            │
              │  • FTS (GIN index)     │
              │  • Triggers (search    │
              │    vector maintenance) │
              │  • Row-level locking   │
              └───────────────────────┘
```

## Key Design Decisions

1. **Auth**: httpOnly cookie JWT (access 15min + refresh 7d with rotation). Argon2id password hashing.
2. **Gamification**: Event-driven. Action → calculator (pure) → applier (DB tx with FOR UPDATE) → AuditLog.
3. **FTS**: PostgreSQL tsvector via BEFORE INSERT/UPDATE trigger. `'simple'` config for Vietnamese tokenization.
4. **File Upload**: Signed URL to Supabase Storage. Never touch application server.
5. **Real-time**: Socket.io for presence + guild chat + edit lock only. NO CRDT/OT collaborative editing.
6. **AI**: GPT-4o-mini for cost. Rate limit 10 req/min. Content-hash cache (24h). Minimum 500 chars for summarization.
7. **Theming**: CSS custom properties referenced in Tailwind config. Swap values progressively across phases.

## Directory Structure (Full)

```
tavernoteX/
├── plans/                         # This plan
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── public/
│   └── assets/
├── src/
│   ├── app.tsx
│   ├── app.css                    # Tailwind + CSS variables
│   ├── entry-client.tsx
│   ├── entry-server.tsx
│   ├── middleware.ts              # Auth middleware
│   ├── routes/
│   │   ├── index.tsx
│   │   ├── login.tsx / register.tsx
│   │   ├── (app)/                 # Auth-protected
│   │   │   ├── layout.tsx / error.tsx
│   │   │   ├── tavern.tsx
│   │   │   ├── notes/ (index, new, trash, [id])
│   │   │   ├── quests.tsx / guilds/ / shop.tsx
│   │   │   ├── profile.tsx / leaderboard.tsx / settings.tsx
│   │   └── api/
│   │       ├── auth/ (login, register, refresh, logout, me)
│   │       ├── notes/ (index, search, [id], [id]/attachments, [id]/summarize, [id]/generate-image)
│   │       ├── quests/ (index, active, [id], [id]/claim)
│   │       ├── guilds/ (index, [id], [id]/join, [id]/leave, [id]/members, [id]/messages)
│   │       ├── shop/ (index, [itemId]/purchase)
│   │       ├── users/[id].ts
│   │       ├── leaderboard.ts
│   │       ├── notifications/ (index, [id]/read)
│   │       └── stats/dashboard.ts
│   ├── components/
│   │   ├── ui/                    # Atomic (Button, Card, Modal, Skeleton, etc.)
│   │   ├── layout/ (AppShell, Sidebar, Header, MobileDrawer)
│   │   ├── notes/ (NoteEditor, NoteCard, NoteList, MarkdownRenderer, NoteToolbar, NoteConflictResolver)
│   │   ├── gamification/ (XPBar, LevelBadge, CoinDisplay, QuestBoard, QuestCard, QuestProgress, RewardPopup, LevelUpModal, DailyStreak)
│   │   ├── guild/ (GuildCard, GuildChat, MemberList, CreateGuild)
│   │   ├── profile/ (CharacterSheet, StatsPanel, AchievementList, InventoryPanel)
│   │   ├── auth/ (LoginForm, RegisterForm, AuthGuard)
│   │   ├── ai/ (SummarizeButton, ImageGenPanel)
│   │   ├── onboarding/ (OnboardingWizard, TooltipGuide, QuestIntro)
│   │   ├── shared/ (NotificationBell, EmptyState, ErrorFallback, SearchBar, ThemeToggle)
│   │   └── editor/ (MilkdownWrapper)
│   ├── lib/
│   │   ├── db.ts                 # Prisma client singleton
│   │   ├── auth/ (jwt.ts, middleware.ts)
│   │   ├── gamification/ (engine.ts, calculators/, quests/, achievements/, constants.ts)
│   │   ├── socket/ (index.ts, handlers.ts)
│   │   ├── ai/ (client.ts, summarize.ts, image.ts)
│   │   ├── search.ts             # FTS query builder
│   │   ├── rate-limit.ts
│   │   ├── api-response.ts       # Standard envelope
│   │   └── utils/ (cn.ts, constants.ts, logger.ts)
│   ├── stores/                   # SolidJS signals
│   │   ├── auth.ts, user.ts, notes.ts, quests.ts, guild.ts, ui.ts, notifications.ts
│   ├── hooks/                    # Custom primitives
│   │   ├── useAuth.ts, useSocket.ts, useDebounce.ts
│   ├── validators/               # Zod schemas
│   │   ├── auth.ts, note.ts, quest.ts, guild.ts
│   └── types/                    # TypeScript interfaces
│       ├── note.ts, user.ts, quest.ts, guild.ts, gamification.ts
└── tests/
```

## Dependencies

- **PostgreSQL 16** via Docker (local dev) / Railway.app (production)
- **Node.js 20+** + pnpm
- **OpenAI API key** (GPT-4o-mini, budget ~$5/month for thesis)
- **Supabase account** (free tier for file storage) — or Cloudflare R2
- **Railway.app account** (free tier $5 credit)

## Naming Conventions

- Files: `kebab-case.tsx` (routes, components), `kebab-case.ts` (lib, utils)
- Components: `PascalCase` export default
- Database tables: `PascalCase` (Prisma convention)
- API routes: RESTful, nouns plural (`/api/notes`, `/api/quests`)
- CSS classes: Tailwind utilities + `tavern-*` custom component classes
