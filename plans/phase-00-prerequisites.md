# Phase 0 — Prerequisites: Environment & Foundation

**Status:** Pending | **Priority:** P0 | **Effort:** 8h | **Blocks:** Phase 1

## Overview

Set up development environment, database, and project scaffold.
Nothing user-facing yet. Everything needed before writing feature code.

## Key Insights (from Reviews)

- Railway.app replaces Netlify — WebSocket support, PostgreSQL included
- PostgreSQL FTS needs trigger + GIN index in initial migration, NOT in app code
- Prisma schema must include ALL tables from the start (CosmeticItem, AuditLog, UserInventory, NoteAttachment, UserAchievement)
- Use `'simple'` text search config for Vietnamese compatibility
- Socket.io needs explicit CORS + auth middleware from the start

## Requirements

### Functional
- PostgreSQL 16 running locally (Docker)
- SolidStart project scaffolded with TypeScript + TailwindCSS
- Prisma configured, schema defined, initial migration run
- FTS trigger + GIN index for Note.search_vector
- Seed data for development (sample quests, levels, cosmetic items)
- Railway.app project created (deploy later)

### Non-functional
- `.env` validated via Zod at startup
- `@kobalte/core` installed for accessible UI primitives
- Socket.io server skeleton (not connected to routes yet)
- Environment parity: local Docker PostgreSQL ↔ Railway PostgreSQL

## Architecture

```
Docker Container: postgres:16-alpine
  Port: 5432
  Database: tavernotex
  User: tavernote
  Extensions: uuid-ossp

SolidStart (pnpm create solid@latest)
  Template: basic (TypeScript)
  + tailwindcss, postcss, autoprefixer
```

## Database Schema (Prisma)

Full schema in `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id               String    @id @default(uuid()) @db.Uuid
  email            String    @unique
  username         String    @unique
  passwordHash     String
  avatarUrl        String?
  level            Int       @default(1)
  xp               Int       @default(0)
  coins            Int       @default(0)
  title            String    @default("Novice Scribe")
  role             String    @default("user")
  refreshTokenHash String?
  lastLoginAt      DateTime?
  emailVerifiedAt  DateTime?
  isBanned         Boolean   @default(false)
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  notes           Note[]
  userQuests      UserQuest[]
  guildMemberships GuildMember[]
  guildMessages   GuildMessage[]
  notifications   Notification[]
  auditLogs       AuditLog[]
  inventory       UserInventory[]
  achievements    UserAchievement[]
  sentMessages    GuildMessage[]
}

model Note {
  id           String    @id @default(uuid()) @db.Uuid
  title        String
  content      String
  category     String?
  tags         String[]
  isPublic     Boolean   @default(false)
  isDeleted    Boolean   @default(false)
  deletedAt    DateTime?
  version      Int       @default(1)
  wordCount    Int       @default(0)
  aiSummary    String?
  aiImageUrl   String?
  searchVector String?   @db.TsVector  // Managed by trigger
  userId       String    @db.Uuid
  guildId      String?   @db.Uuid
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  user        User         @relation(fields: [userId], references: [id])
  guild       Guild?       @relation(fields: [guildId], references: [id])
  attachments NoteAttachment[]

  @@index([userId, createdAt(sort: Desc)])
  @@index([category])
  @@index([isPublic, createdAt(sort: Desc)])
}

model NoteAttachment {
  id             String   @id @default(uuid()) @db.Uuid
  noteId         String   @db.Uuid
  userId         String   @db.Uuid
  fileUrl        String
  fileName       String
  fileSize       Int
  mimeType       String
  storageProvider String  @default("supabase")
  createdAt      DateTime @default(now())

  note Note @relation(fields: [noteId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Quest {
  id          String   @id @default(uuid()) @db.Uuid
  title       String
  description String
  questType   String   @default("daily")
  icon        String   @default("scroll")
  criteria    Json     @default("{}")
  xpReward    Int      @default(0)
  coinReward  Int      @default(0)
  resetCron   String?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())

  userQuests UserQuest[]

  @@index([questType])
}

model UserQuest {
  id          String    @id @default(uuid()) @db.Uuid
  userId      String    @db.Uuid
  questId     String    @db.Uuid
  progress    Json      @default("{}")
  status      String    @default("active")
  completedAt DateTime?
  createdAt   DateTime  @default(now())

  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)
  quest Quest @relation(fields: [questId], references: [id], onDelete: Cascade)

  @@unique([userId, questId])
  @@index([userId, status])
  @@index([questId, userId])
}

model Guild {
  id          String   @id @default(uuid()) @db.Uuid
  name        String
  description String?
  iconUrl     String?
  inviteCode  String   @unique
  maxMembers  Int      @default(50)
  isPublic    Boolean  @default(true)
  ownerId     String   @db.Uuid
  createdAt   DateTime @default(now())

  owner   User           @relation(fields: [ownerId], references: [id])
  members GuildMember[]
  notes   Note[]
  messages GuildMessage[]

  @@index([name])
}

model GuildMember {
  id       String   @id @default(uuid()) @db.Uuid
  guildId  String   @db.Uuid
  userId   String   @db.Uuid
  role     String   @default("member")
  joinedAt DateTime @default(now())

  guild Guild @relation(fields: [guildId], references: [id], onDelete: Cascade)
  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([guildId, userId])
  @@index([guildId])
  @@index([userId])
}

model GuildMessage {
  id        String   @id @default(uuid()) @db.Uuid
  guildId   String   @db.Uuid
  userId    String   @db.Uuid
  content   String
  createdAt DateTime @default(now())

  guild Guild @relation(fields: [guildId], references: [id], onDelete: Cascade)
  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([guildId, createdAt(sort: Desc)])
}

model CosmeticItem {
  id          String  @id @default(uuid()) @db.Uuid
  name        String
  description String?
  type        String
  imageUrl    String?
  coinCost    Int
  rarity      String  @default("common")
  isActive    Boolean @default(true)
  createdAt   DateTime @default(now())

  inventory UserInventory[]
}

model UserInventory {
  id             String   @id @default(uuid()) @db.Uuid
  userId         String   @db.Uuid
  cosmeticItemId String   @db.Uuid
  isEquipped     Boolean  @default(false)
  purchasedAt    DateTime @default(now())

  user User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  item CosmeticItem @relation(fields: [cosmeticItemId], references: [id], onDelete: Cascade)

  @@unique([userId, cosmeticItemId])
}

model Achievement {
  id          String   @id @default(uuid()) @db.Uuid
  title       String
  description String?
  icon        String   @default("trophy")
  criteria    Json     @default("{}")
  xpReward    Int      @default(0)
  createdAt   DateTime @default(now())

  userAchievements UserAchievement[]
}

model UserAchievement {
  id            String    @id @default(uuid()) @db.Uuid
  userId        String    @db.Uuid
  achievementId String    @db.Uuid
  progress      Json      @default("{}")
  unlockedAt    DateTime?
  createdAt     DateTime  @default(now())

  user        User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  achievement Achievement @relation(fields: [achievementId], references: [id], onDelete: Cascade)

  @@unique([userId, achievementId])
}

model Notification {
  id        String   @id @default(uuid()) @db.Uuid
  userId    String   @db.Uuid
  type      String
  title     String
  body      String?
  isRead    Boolean  @default(false)
  metadata  Json     @default("{}")
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt(sort: Desc)])
}

model AuditLog {
  id         String   @id @default(uuid()) @db.Uuid
  userId     String   @db.Uuid
  actionType String
  xpChange   Int      @default(0)
  coinChange Int      @default(0)
  metadata   Json     @default("{}")
  createdAt  DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt(sort: Desc)])
  @@index([actionType, createdAt(sort: Desc)])
}
```

## Migration: FTS Trigger + Index

Run as raw SQL in the first migration:

```sql
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- FTS trigger function
CREATE OR REPLACE FUNCTION note_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('simple', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('simple', COALESCE(NEW.content, '')), 'B') ||
    setweight(to_tsvector('simple', COALESCE(NEW.category, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger
CREATE TRIGGER trg_note_search_vector
  BEFORE INSERT OR UPDATE ON "Note"
  FOR EACH ROW EXECUTE FUNCTION note_search_vector_update();

-- GIN index for FTS
CREATE INDEX idx_note_search_vector ON "Note" USING GIN(search_vector);

-- Additional performance indexes
CREATE INDEX idx_note_user_created ON "Note"(user_id, created_at DESC) WHERE is_deleted = false;
CREATE INDEX idx_note_public_created ON "Note"(is_public, created_at DESC) WHERE is_deleted = false;
CREATE INDEX idx_auditlog_user_time ON "AuditLog"(user_id, created_at DESC);
CREATE INDEX idx_auditlog_action ON "AuditLog"(action_type, created_at DESC);
CREATE INDEX idx_user_level ON "User"(level DESC);
CREATE INDEX idx_user_email ON "User"(email) WHERE is_banned = false;
CREATE INDEX idx_notification_user_unread ON "Notification"(user_id, created_at DESC) WHERE is_read = false;
CREATE INDEX idx_guildmessage_guild_time ON "GuildMessage"(guild_id, created_at DESC);
CREATE INDEX idx_guildmember_guild ON "GuildMember"(guild_id, joined_at);
CREATE INDEX idx_guildmember_user ON "GuildMember"(user_id);
```

## Seed Data

`prisma/seed.ts` — minimal data for development:

```typescript
// Daily quests
{ title: "Daily Scribe", description: "Write at least 1 note today", questType: "daily", criteria: { action: "create_note", count: 1 }, xpReward: 20, coinReward: 5 }
{ title: "Word Weaver", description: "Write 500 words total today", questType: "daily", criteria: { action: "write_words", count: 500 }, xpReward: 30, coinReward: 10 }
{ title: "Knowledge Sharer", description: "Make 1 note public", questType: "daily", criteria: { action: "make_public", count: 1 }, xpReward: 15, coinReward: 5 }

// Weekly quests
{ title: "Prolific Author", description: "Create 10 notes this week", questType: "weekly", criteria: { action: "create_note", count: 10 }, xpReward: 100, coinReward: 50 }
{ title: "Guild Founder", description: "Create or join a guild", questType: "weekly", criteria: { action: "join_guild", count: 1 }, xpReward: 150, coinReward: 30 }

// Cosmetic items
{ name: "Golden Frame", type: "avatar_frame", coinCost: 100, rarity: "rare" }
{ name: "Obsidian Theme", type: "theme", coinCost: 200, rarity: "epic" }
{ name: "Scholar's Quill", type: "badge", coinCost: 50, rarity: "common" }

// Achievements
{ title: "First Scroll", description: "Create your first note", criteria: { action: "create_note", count: 1 }, xpReward: 50 }
{ title: "Scribe Apprentice", description: "Create 50 notes", criteria: { action: "create_note", count: 50 }, xpReward: 200 }
{ title: "Streak Master", description: "7-day login streak", criteria: { action: "daily_login", count: 7 }, xpReward: 100 }
```

## Implementation Steps

### Step 0.1: Install PostgreSQL via Docker
```powershell
docker run --name tavernotex-db -e POSTGRES_USER=tavernote -e POSTGRES_PASSWORD=tavernote_dev -e POSTGRES_DB=tavernotex -p 5432:5432 -d postgres:16-alpine
```
Verify: `docker ps`, connect with `psql` or Prisma Studio.

### Step 0.2: Scaffold SolidStart project
```powershell
pnpm create solid@latest tavernoteX --template basic-ts
cd tavernoteX
pnpm add tailwindcss @tailwindcss/vite postcss autoprefixer
pnpm add prisma @prisma/client
pnpm add -D prisma
pnpm add zod @kobalte/core
pnpm add socket.io socket.io-client
pnpm add openai
pnpm add bcryptjs jsonwebtoken
pnpm add -D @types/bcryptjs @types/jsonwebtoken
```

### Step 0.3: Configure TailwindCSS + CSS Variables
Set up `src/app.css` with design tokens (Notion-like initial values):
```css
@import "tailwindcss";

@layer base {
  :root {
    --color-bg: 255 255 255;
    --color-bg-elevated: 248 250 252;
    --color-text-primary: 15 23 42;
    --color-text-secondary: 100 116 139;
    --color-accent: 59 130 246;
    --color-xp: 34 197 94;
    --color-coin: 234 179 8;
    --font-display: 'Inter', sans-serif;
    --font-body: 'Inter', sans-serif;
    --radius-sm: 0.25rem;
    --radius-md: 0.5rem;
  }
  [data-theme="dark"] {
    --color-bg: 15 23 42;
    --color-bg-elevated: 30 41 59;
    --color-text-primary: 226 232 240;
    --color-text-secondary: 148 163 184;
  }
}
```

`tailwind.config.ts`:
```typescript
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: 'rgb(var(--color-bg) / <alpha-value>)',
          elevated: 'rgb(var(--color-bg-elevated) / <alpha-value>)',
        },
        ink: {
          primary: 'rgb(var(--color-text-primary) / <alpha-value>)',
          secondary: 'rgb(var(--color-text-secondary) / <alpha-value>)',
        },
        brand: 'rgb(var(--color-accent) / <alpha-value>)',
        xp: 'rgb(var(--color-xp) / <alpha-value>)',
        coin: 'rgb(var(--color-coin) / <alpha-value>)',
      },
      fontFamily: {
        display: 'var(--font-display)',
        body: 'var(--font-body)',
      },
    },
  },
};
```

### Step 0.4: Initialize Prisma + Run Migration
```powershell
npx prisma init --datasource-provider postgresql
# Edit .env: DATABASE_URL=postgresql://tavernote:tavernote_dev@localhost:5432/tavernotex
# Edit prisma/schema.prisma with full schema above
npx prisma migrate dev --name init
npx prisma db seed
```

### Step 0.5: Environment Validation at Startup
`src/lib/env.ts`:
```typescript
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  OPENAI_API_KEY: z.string().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  SOCKET_PORT: z.coerce.number().optional().default(3001),
});

export const env = envSchema.parse(process.env);
```

### Step 0.6: Prisma Client Singleton
`src/lib/db.ts`:
```typescript
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
```

### Step 0.7: Socket.io Skeleton
`src/lib/socket/index.ts`:
```typescript
import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { verifyAccessToken } from '~/lib/auth/jwt';

let io: Server | null = null;

export function initSocket(server: HttpServer) {
  io = new Server(server, {
    cors: { origin: process.env.CLIENT_URL || 'http://localhost:3000', credentials: true },
  });

  // Auth middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) return next(new Error('Unauthorized'));
      const payload = await verifyAccessToken(token);
      socket.data.userId = payload.userId;
      socket.data.username = payload.username;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.data.userId}`);
    socket.on('disconnect', () => console.log(`User disconnected: ${socket.data.userId}`));
  });

  return io;
}

export function getIO(): Server {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
}
```

### Step 0.8: Railway.app Project Setup
```powershell
# Install Railway CLI
npm i -g @railway/cli
railway login
railway init
# Link to project, add env vars, set up PostgreSQL plugin
```

## Todo List

- [ ] PostgreSQL Docker container running
- [ ] SolidStart project scaffolded with all dependencies
- [ ] TailwindCSS + CSS variables configured
- [ ] Prisma schema defined (all 13 models)
- [ ] Initial migration executed with FTS trigger + indexes
- [ ] Seed data populated
- [ ] Environment validation at startup
- [ ] Prisma client singleton
- [ ] Socket.io server skeleton with auth middleware
- [ ] Railway.app project created

## Success Criteria

- `pnpm dev` starts without errors
- `npx prisma studio` shows all tables
- FTS query works: `SELECT * FROM "Note" WHERE search_vector @@ plainto_tsquery('simple', 'keyword')`
- Docker PostgreSQL responds on port 5432
- `.env` validation catches missing vars

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Docker not available on Windows | HIGH | Fallback: install PostgreSQL directly via installer |
| Prisma + SolidStart build conflicts | MEDIUM | Use `@prisma/client` edge-compatible if needed |
| Socket.io + SolidStart server integration | MEDIUM | Socket.io may need separate port or custom server adapter |

## Security Considerations

- `.env` in `.gitignore` — NEVER commit secrets
- PostgreSQL password not exposed in connection string outside `.env`
- JWT secrets 32+ characters, generated via `openssl rand -base64 48`

## Next Steps

Proceed to **Phase 1** (Core MVP) — auth + note CRUD + search + layout.
