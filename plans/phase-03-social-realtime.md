# Phase 3 — Social & Real-time: Guilds + Socket.io + Leaderboard

**Status:** Pending | **Priority:** P1 | **Effort:** 25h | **Blocks:** Phase 4 | **Blocked by:** Phase 2

## Overview

Add social features: guilds (study groups), real-time guild chat via Socket.io,
edit presence on notes, leaderboard, and notification system.

## Key Insights

- Railway.app supports persistent WebSocket connections (verified — not Netlify)
- Collaborative editing: scope to presence + edit lock only. NO CRDT/OT.
- Socket.io auth middleware verifies JWT on handshake, attaches userId
- Guild chat uses room-based broadcasting: `socket.join('guild:${guildId}')`
- Cursor-based pagination for chat history (load older on scroll up)
- Leaderboard: cache in memory (1 min TTL), query top 100 by XP DESC

## Requirements

### Functional
- **Guild Creation**: User creates guild (name, description, public/private)
- **Guild Discovery**: Browse public guilds, search by name
- **Guild Membership**: Join (public or invite code), leave, member list
- **Guild Roles**: Owner, Admin, Member
- **Guild Chat**: Real-time text chat within guild (Socket.io room)
- **Guild Notes**: Share notes with guild (set guildId on note)
- **Note Presence**: "X is viewing this note" (Socket.io room per note)
- **Edit Lock**: When user edits a note, others see "X is editing" with 5-min lock
- **Leaderboard**: Top 100 users by XP (global + guild-specific)
- **Notifications**: Real-time notification push (Socket.io) + stored in DB
- **Notification Types**: Quest completed, level up, guild invite, guild message, achievement unlocked

### Non-functional
- Socket.io connection re-establish on disconnect (exponential backoff)
- Heartbeat/keepalive every 25s
- Chat history: last 100 messages loaded on room join, older via scroll-up pagination
- Max 100 users per Socket.io room

## Architecture

### Socket.io Events

```
Server Events (server → client):
  guild:message           { id, user, content, createdAt }
  guild:user-joined       { userId, username }
  guild:user-left         { userId, username }
  note:user-joined        { userId, username }
  note:user-left          { userId, username }
  note:editing-started    { userId, username }
  note:editing-ended      { userId }
  notification:new        { type, title, body }
  notification:count      { unreadCount }

Client Events (client → server):
  guild:join              { guildId }
  guild:leave             { guildId }
  guild:message           { guildId, content }
  note:join               { noteId }
  note:leave              { noteId }
  note:editing-start      { noteId }
  note:editing-end        { noteId }
  notification:read        { notificationId }
```

### Socket.io Server (`lib/socket/handlers.ts`)

```typescript
import { Server, Socket } from 'socket.io';
import { getIO } from './index';
import { prisma } from '~/lib/db';

export function registerHandlers(socket: Socket) {
  const userId = socket.data.userId;

  // Guild chat
  socket.on('guild:join', (guildId: string) => {
    socket.join(`guild:${guildId}`);
    socket.to(`guild:${guildId}`).emit('guild:user-joined', {
      userId, username: socket.data.username,
    });
  });

  socket.on('guild:leave', (guildId: string) => {
    socket.leave(`guild:${guildId}`);
    socket.to(`guild:${guildId}`).emit('guild:user-left', {
      userId, username: socket.data.username,
    });
  });

  socket.on('guild:message', async ({ guildId, content }) => {
    const message = await prisma.guildMessage.create({
      data: { guildId, userId, content },
      include: { user: { select: { id: true, username: true, avatarUrl: true } } },
    });
    getIO().to(`guild:${guildId}`).emit('guild:message', message);
  });

  // Note presence
  socket.on('note:join', (noteId: string) => {
    socket.join(`note:${noteId}`);
    const viewers = getIO().sockets.adapter.rooms.get(`note:${noteId}`);
    socket.to(`note:${noteId}`).emit('note:user-joined', {
      userId, username: socket.data.username,
    });
    socket.emit('note:viewers', { count: viewers?.size || 1 });
  });

  socket.on('note:leave', (noteId: string) => {
    socket.leave(`note:${noteId}`);
    socket.to(`note:${noteId}`).emit('note:user-left', { userId });
  });

  // Edit lock
  socket.on('note:editing-start', (noteId: string) => {
    socket.to(`note:${noteId}`).emit('note:editing-started', {
      userId, username: socket.data.username,
    });
  });

  socket.on('note:editing-end', (noteId: string) => {
    socket.to(`note:${noteId}`).emit('note:editing-ended', { userId });
  });

  // Disconnect cleanup
  socket.on('disconnect', () => {
    // Leave all rooms (Socket.io auto-handles this)
  });
}
```

### Socket.io Client Hook (`hooks/useSocket.ts`)

```typescript
import { io, Socket } from 'socket.io-client';
import { createSignal, onCleanup } from 'solid-js';
import { useAuth } from '~/stores/auth';

let socket: Socket | null = null;

export function useSocket() {
  const { user } = useAuth();
  const [connected, setConnected] = createSignal(false);

  if (!socket && user()) {
    socket = io(import.meta.env.VITE_SOCKET_URL || '', {
      auth: { token: getAccessToken() },
      reconnectionDelayMax: 10000,
    });

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    onCleanup(() => {
      socket?.disconnect();
      socket = null;
    });
  }

  return { socket, connected };
}
```

### Guild API Endpoints

```
GET    /api/guilds?cursor=x&take=20    → list public guilds
POST   /api/guilds                      → { name, description, isPublic } → create
GET    /api/guilds/[id]                 → guild detail (name, members, isMember)
PUT    /api/guilds/[id]                 → update name/description (owner/admin only)
DELETE /api/guilds/[id]                 → delete guild (owner only)
POST   /api/guilds/[id]/join            → join guild (check public or invite code)
POST   /api/guilds/[id]/leave           → leave guild (reassign ownership if owner)
GET    /api/guilds/[id]/members         → member list with roles
GET    /api/guilds/[id]/messages?cursor=x → chat history (cursor pagination, DESC)
POST   /api/guilds/[id]/invite          → generate/regenerate invite code (owner/admin)
```

### Leaderboard API

```
GET /api/leaderboard?scope=global&take=100
  → [{ id, username, avatarUrl, level, xp, title, rank }]

Cache: 1 min in-memory Map, invalidated on level-up events
```

### Notification API

```
GET  /api/notifications               → list user's notifications (cursor)
PATCH /api/notifications/[id]/read    → mark as read
PATCH /api/notifications/read-all     → mark all as read
```

Notification creation helper:
```typescript
// Triggered by gamification engine, guild events, etc.
export async function createNotification(
  tx: Prisma.TransactionClient,
  userId: string,
  type: string,
  title: string,
  body?: string,
  metadata?: Record<string, unknown>
) {
  await tx.notification.create({ data: { userId, type, title, body, metadata: metadata as any } });

  // Push via Socket.io if user is connected
  const io = getIO();
  const sockets = await io.in(`user:${userId}`).fetchSockets();
  if (sockets.length > 0) {
    io.to(`user:${userId}`).emit('notification:new', { type, title, body });
  }
}
```

## Component Tree (Phase 3 additions)

```
components/
├── guild/
│   ├── GuildCard.tsx         # Thumbnail: name, icon, member count, public badge
│   ├── GuildChat.tsx         # Real-time chat panel with message list + input
│   ├── MemberList.tsx        # Guild members with role badges
│   └── CreateGuild.tsx       # Modal form: name, description, public/private
├── layout/
│   └── Header.tsx            # Add: NotificationBell (live count via Socket.io)
└── shared/
    └── NotificationBell.tsx  # Dropdown with notification list + mark-read
```

## Stores (Phase 3 additions)

```
stores/
├── guild.ts       # { current, members[], messages[], loading }
└── notifications.ts # Extended: real-time push via Socket.io
```

## Implementation Steps

### Step 3.1: Socket.io Server + Auth
- `lib/socket/index.ts`: Server init + JWT auth middleware
- `lib/socket/handlers.ts`: All event handlers (guild chat, note presence, edit lock)
- Wire into SolidStart entry-server or standalone port

### Step 3.2: Socket.io Client
- `hooks/useSocket.ts`: Client singleton with reconnection
- Add `user:${userId}` room on connection for notification push

### Step 3.3: Guild CRUD API
- `api/guilds/index.ts`: GET list + POST create
- `api/guilds/[id].ts`: GET detail + PUT update + DELETE
- `api/guilds/[id]/join.ts`, `api/guilds/[id]/leave.ts`
- `api/guilds/[id]/members.ts`, `api/guilds/[id]/invite.ts`
- `validators/guild.ts`: Zod schemas

### Step 3.4: Guild Chat
- `api/guilds/[id]/messages.ts`: GET chat history (cursor pagination)
- `GuildChat.tsx`: Real-time via Socket.io, load recent + paginate on scroll-up
- Auto-scroll to bottom on new message

### Step 3.5: Guild UI
- `/guilds` page: `GuildCard.tsx` grid, search bar, `CreateGuild.tsx` modal
- `/guilds/[id]` page: guild header + `MemberList.tsx` + `GuildChat.tsx`
- Join/leave buttons with confirmation dialog

### Step 3.6: Note Presence + Edit Lock
- On entering `[id].tsx` view mode: `socket.emit('note:join', noteId)`
- On edit start: `socket.emit('note:editing-start', noteId)`
- On edit end/unmount: `socket.emit('note:editing-end', noteId)`, `socket.emit('note:leave', noteId)`
- Display viewers count + "X is editing" banner

### Step 3.7: Leaderboard
- `api/leaderboard.ts`: GET top 100 with cache
- `/leaderboard` page: ranked list with avatar, username, level, XP
- Highlight current user row

### Step 3.8: Notification System
- `createNotification()` helper (used by gamification engine, guild events)
- `api/notifications/index.ts`: GET list
- `api/notifications/[id]/read.ts`: mark read
- `NotificationBell.tsx`: dropdown with unread count badge, mark-read, view-all
- Real-time push via Socket.io (update bell count instantly)

### Step 3.9: Guild Notes
- When creating/editing note, add optional `guildId` field
- Guild members can view guild notes (set `isPublic=false`, check guild membership)

## Todo List

- [ ] Socket.io server init + JWT auth middleware
- [ ] Socket.io event handlers (guild, note presence, edit lock, notifications)
- [ ] Socket.io client hook with reconnection
- [ ] Guild CRUD API + Zod validation
- [ ] Guild list page (browse + create)
- [ ] Guild detail page (header, members, chat)
- [ ] GuildChat real-time (Socket.io room, cursor pagination)
- [ ] Guild membership (join/leave, roles)
- [ ] Note presence (viewers count)
- [ ] Edit lock (5-min, "X is editing" banner)
- [ ] Leaderboard API + UI (cached, top 100)
- [ ] Notification system (DB + Socket.io push)
- [ ] NotificationBell dropdown UI
- [ ] Guild notes sharing
- [ ] Wheel event: guild:join on page enter, guild:leave on page exit

## Success Criteria

- User can create guild, invite others via invite code
- Real-time chat works with < 500ms latency
- Guild messages persist and load on re-entry
- Note presence shows accurate viewer count
- Edit lock prevents simultaneous editing
- Leaderboard displays top 100 by XP
- Notifications push in real-time via Socket.io
- Notification bell shows unread count, marks as read
- Guild notes visible to all guild members

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Socket.io connection drops on Railway sleep | HIGH | Railway has minimum 1 always-on instance for WebSocket apps. Verify during deploy |
| Chat message loss on disconnect | MEDIUM | Messages persisted to DB before broadcast. Client re-fetches on reconnect |
| Room leaks (users don't leave rooms) | LOW | Socket.io auto-leaves on disconnect. Add heartbeat check for stale connections |
| Large guild chat history (performance) | LOW | Cursor pagination, lazy-load older. Max 100 recent in memory |

## Security Considerations

- Socket.io auth middleware verifies JWT on every connection
- Guild join: check `isPublic` or valid `inviteCode`
- Guild modify/delete: check `ownerId` or role === 'admin'
- Rate limit chat messages: 10 messages/10 seconds per user
- Validate message content length (max 2000 chars)

## Next Steps

Proceed to **Phase 4** (AI & Polish) — OpenAI integration, full tavern theme, testing, deployment.
