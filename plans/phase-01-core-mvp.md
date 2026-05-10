# Phase 1 — Core MVP: Auth + Notes + Search + Layout

**Status:** Pending | **Priority:** P0 | **Effort:** 40h | **Blocks:** Phase 2 | **Blocked by:** Phase 0

## Overview

Build the minimum viable note-taking app. Users can register, log in, create/edit/delete
notes with markdown, search them, and navigate a responsive tavern-themed shell.
No gamification yet — just solid CRUD + auth.

## Key Insights

- Milkdown is React-only → wrap as React island (`clientOnly`). Document as tech debt.
- Auth must use httpOnly cookies (JWT access + refresh), NOT localStorage (XSS risk).
- `[id].tsx` defaults to view mode; editor lazy-loads on "Edit" click (`?mode=edit`).
- Cursor-based pagination from day 1 (NOT offset-based).
- Every data view needs: loading (Skeleton), empty (EmptyState), error (ErrorFallback).
- API response envelope `{ success, data, error, meta }` enforced from first endpoint.

## Requirements

### Functional
- User registration (email + username + password)
- User login (JWT httpOnly cookie, 15min access + 7d refresh with rotation)
- User logout (clear refresh token)
- Auto-refresh expired access tokens
- Create note (title, markdown content, category, tags, public/private)
- Edit note (Milkdown React island editor, lazy-loaded)
- Delete note (soft delete, move to trash)
- Restore note from trash
- Permanently delete note from trash
- List user's notes (cursor pagination, sort by updatedAt)
- View single note (server-rendered MarkdownRenderer)
- Full-text search across notes (PostgreSQL FTS)
- Auth-protected route group `(app)/` with layout shell
- Responsive layout: sidebar (desktop) / drawer (mobile)
- Dark mode toggle (persisted in localStorage + cookie)

### Non-functional
- All API input validated via Zod
- Standardized API response envelope
- Rate limiting on auth endpoints (5 login/min, 3 register/hour)
- Loading states < 200ms perceived (Skeleton + Suspense)
- Lighthouse Performance > 90
- Keyboard navigable

## Architecture

### Auth Flow
```
POST /api/auth/register     → Argon2id hash → create User → return 201
POST /api/auth/login        → verify password → sign access(15m) + refresh(7d) → Set-Cookie → return user
POST /api/auth/refresh      → verify refresh → rotate token (delete old, create new) → Set-Cookie → return
POST /api/auth/logout       → clear refreshTokenHash in DB → Clear-Cookie
GET  /api/auth/me           → verify access token → return user profile
```

### Auth Middleware (`src/middleware.ts`)
```typescript
import { createMiddleware } from "@solidjs/start/middleware";
import { verifyAccessToken } from "~/lib/auth/jwt";

export default createMiddleware({
  onRequest: [
    async (event) => {
      const publicPaths = ['/api/auth/login','/api/auth/register','/api/auth/refresh','/api/auth/logout','/login','/register','/'];
      if (publicPaths.some(p => event.request.url.includes(p))) return;

      const token = event.request.headers.get('cookie')
        ?.split('; ').find(c => c.startsWith('access_token='))?.split('=')[1];

      if (!token) return new Response(JSON.stringify({ success: false, error: { code: 'UNAUTHORIZED', message: 'No token' } }), { status: 401 });

      try {
        event.locals.user = await verifyAccessToken(token);
      } catch {
        return new Response(JSON.stringify({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid token' } }), { status: 401 });
      }
    },
  ],
});
```

### Note CRUD API
```
GET    /api/notes?cursor=xxx&take=20     → list user's active notes (cursor pagination)
POST   /api/notes                        → { title, content, category, tags, isPublic } → create
GET    /api/notes/search?q=keyword      → FTS query, ranked results
GET    /api/notes/[id]                   → single note (includes author if public)
PUT    /api/notes/[id]                   → update title/content/category/tags/isPublic (version check)
DELETE /api/notes/[id]                   → soft delete (set isDeleted=true)
```

### FTS Search Query (in `lib/search.ts`)
```typescript
import { prisma } from './db';

export async function searchNotes(userId: string, q: string, take = 20) {
  return prisma.$queryRaw`
    SELECT n.*, ts_rank(n.search_vector, query) AS rank
    FROM "Note" n, plainto_tsquery('simple', ${q}) query
    WHERE n.search_vector @@ query
      AND n.is_deleted = false
      AND (n.is_public = true OR n.user_id = ${userId}::uuid)
    ORDER BY rank DESC
    LIMIT ${take}
  `;
}
```

### Markdown Editor Strategy (Milkdown React Island)

`src/components/editor/MilkdownWrapper.tsx`:
```tsx
import { onMount, onCleanup, createSignal } from 'solid-js';

// This file wraps a React Milkdown editor inside a SolidJS component
// Tech debt: React runtime overhead (~40KB). Replace with ProseMirror native post-MVP.

export function MilkdownWrapper(props: {
  initialContent: string;
  onSave: (content: string) => Promise<void>;
}) {
  const [saving, setSaving] = createSignal(false);
  let container: HTMLDivElement;

  onMount(async () => {
    // Dynamically import React + Milkdown only when editor mounts
    const React = await import('react');
    const { createRoot } = await import('react-dom/client');
    const { Editor, rootCtx, defaultValueCtx } = await import('@milkdown/core');
    const { commonmark } = await import('@milkdown/preset-commonmark');
    const { gfm } = await import('@milkdown/preset-gfm');
    const { history } = await import('@milkdown/plugin-history');
    const { clipboard } = await import('@milkdown/plugin-clipboard');
    const { emoji } = await import('@milkdown/plugin-emoji');
    const { prism } = await import('@milkdown/plugin-prism');
    // ... more plugins

    const root = createRoot(container);
    // ... editor initialization
    // ... debounced auto-save (2s) via onSave prop
  });

  return (
    <div class="relative">
      <div ref={container!} class="prose max-w-none" />
      {saving() && <span class="text-xs text-ink-secondary">Saving...</span>}
    </div>
  );
}
```

### Route: `(app)/notes/[id].tsx` — View/Edit Toggle

```tsx
import { useParams, useSearchParams } from '@solidjs/router';
import { createResource, Show, Suspense, lazy } from 'solid-js';
import { MarkdownRenderer } from '~/components/notes/MarkdownRenderer';
import { Skeleton } from '~/components/ui/Skeleton';
import { ErrorFallback } from '~/components/shared/ErrorFallback';
import { EmptyState } from '~/components/shared/EmptyState';

const MilkdownWrapper = lazy(() => import('~/components/editor/MilkdownWrapper'));

export default function NotePage() {
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const isEditing = () => searchParams.mode === 'edit';

  const [note, { refetch }] = createResource(() => params.id, fetchNote);

  return (
    <Suspense fallback={<Skeleton variant="note-detail" />}>
      <Show when={!note.error} fallback={<ErrorFallback onRetry={refetch} />}>
        <Show when={note()} fallback={<EmptyState message="Note not found" />}>
          <Show when={isEditing()} fallback={
            <article>
              <MarkdownRenderer content={note()!.content} />
              <button onClick={() => setSearchParams({ mode: 'edit' })}>
                Edit
              </button>
            </article>
          }>
            <MilkdownWrapper
              initialContent={note()!.content}
              onSave={async (content) => {
                await updateNote(params.id, { content });
                setSearchParams({ mode: undefined }); // Back to view
              }}
            />
          </Show>
        </Show>
      </Show>
    </Suspense>
  );
}
```

### API Response Envelope (`src/lib/api-response.ts`)
```typescript
export function success<T>(data: T, meta?: Record<string, unknown>) {
  return new Response(JSON.stringify({
    success: true, data, meta: meta || {}, timestamp: new Date().toISOString(),
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

export function error(code: string, message: string, status: number, details?: unknown) {
  return new Response(JSON.stringify({
    success: false, error: { code, message, details }, timestamp: new Date().toISOString(),
  }), { status, headers: { 'Content-Type': 'application/json' } });
}
```

### Rate Limiting (`src/lib/rate-limit.ts`)
```typescript
const buckets = new Map<string, { tokens: number; lastRefill: number }>();

export function rateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key) || { tokens: maxRequests, lastRefill: now };
  const elapsed = now - bucket.lastRefill;
  bucket.tokens = Math.min(maxRequests, bucket.tokens + (elapsed / windowMs) * maxRequests);
  bucket.lastRefill = now;
  if (bucket.tokens < 1) return false;
  bucket.tokens -= 1;
  buckets.set(key, bucket);
  return true;
}
```

### Check: `(app)/layout.tsx` — Auth Guard + Shell

```tsx
import { useNavigate } from '@solidjs/router';
import { Show } from 'solid-js';
import { AppShell } from '~/components/layout/AppShell';
import { FullPageSpinner } from '~/components/ui/Skeleton';
import { useAuth } from '~/stores/auth';

export default function AppLayout(props: { children: any }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  // Redirect if not authenticated
  createEffect(() => {
    if (!loading() && !user()) navigate('/login');
  });

  return (
    <Show when={!loading() && user()} fallback={<FullPageSpinner />}>
      <AppShell>
        {props.children}
      </AppShell>
    </Show>
  );
}
```

### Mobile Responsive: AppShell + MobileDrawer

```
Desktop (lg+):    Sidebar (w-64, persistent) | Main content
Tablet (md-lg):   Sidebar (w-16, icons only, expand on hover) | Main content
Mobile (<md):     Header with hamburger → full-screen <MobileDrawer> overlay | Main content
```

## Component Tree for Phase 1
```
components/
├── ui/Button, Input, Card, Modal, Skeleton, Toast, Tooltip
├── layout/AppShell, Sidebar, Header, MobileDrawer
├── notes/MarkdownRenderer, NoteCard, NoteList, NoteEditor (placeholder)
├── editor/MilkdownWrapper (React island)
├── auth/LoginForm, RegisterForm, AuthGuard
├── shared/ErrorFallback, EmptyState, SearchBar, ThemeToggle
└── onboarding/OnboardingWizard (3-step modal for new users)
```

## Stores (Phase 1)
```
stores/
├── auth.ts   # { user, token, loading } — hydrate from /api/auth/me
├── notes.ts  # { items[], loading, error } — optimistic update helper
├── ui.ts     # { theme, sidebarOpen, toasts[] }
└── notifications.ts # { items[], unreadCount }
```

## Implementation Steps

### Step 1.1: Auth API + JWT Utilities
- `lib/auth/jwt.ts`: signAccessToken, verifyAccessToken, signRefreshToken, verifyRefreshToken, hashPassword (bcryptjs), verifyPassword
- API routes: `api/auth/register.ts`, `api/auth/login.ts`, `api/auth/refresh.ts`, `api/auth/logout.ts`, `api/auth/me.ts`
- Zod schemas: `validators/auth.ts`

### Step 1.2: Auth Middleware
- `middleware.ts`: cookie extraction, token verification, `event.locals.user`

### Step 1.3: Auth UI
- `LoginForm.tsx`, `RegisterForm.tsx` (tavern-themed with CSS vars)
- `AuthGuard.tsx`
- `stores/auth.ts` (auto-hydrate from `/api/auth/me`)

### Step 1.4: Note CRUD API
- `lib/api-response.ts`: success/error envelope
- `lib/search.ts`: FTS query
- API routes: `api/notes/index.ts` (GET + POST), `api/notes/[id].ts` (GET + PUT + DELETE), `api/notes/search.ts` (GET)
- `validators/note.ts`: CreateNoteSchema, UpdateNoteSchema

### Step 1.5: Note UI
- `NoteList.tsx` (with cursor pagination, SearchBar, EmptyState)
- `NoteCard.tsx` (thumbnail: title, excerpt, tags, date, word count)
- `MarkdownRenderer.tsx` (server-rendered, no JS needed for view mode)
- `NoteEditor.tsx` (placeholder → replaced by Milkdown in Phase 1.6)

### Step 1.6: Milkdown Editor Integration
- `editor/MilkdownWrapper.tsx` (React island with auto-save, debounce 2s)
- Plugins: commonmark, gfm, history, clipboard, emoji, prism
- View/edit toggle in `[id].tsx`
- `NoteConflictResolver.tsx` (409 handling when version mismatch)

### Step 1.7: Layout Shell
- `AppShell.tsx`: responsive grid with sidebar + main
- `Sidebar.tsx`: nav links (Tavern, Notes, Quests, Guilds, Profile, Leaderboard, Settings)
- `MobileDrawer.tsx`: slide-out overlay on mobile
- `Header.tsx`: search bar, theme toggle, notification bell, user avatar dropdown

### Step 1.8: Onboarding
- `OnboardingWizard.tsx`: 3-step modal (set username/avatar → explain basics → first note prompt)
- Show on first login only (check `user.lastLoginAt === null`)

### Step 1.9: Dark Mode
- `ThemeToggle.tsx` in Header
- Persist to localStorage + set `data-theme` attribute on `<html>`
- `stores/ui.ts`: theme signal with localStorage sync

### Step 1.10: Toast System
- `lib/toast.ts`: event-based toast queue
- `components/ui/Toast.tsx`: animated notification (success/error/info)

## Todo List

- [ ] Auth API + JWT utilities + Zod schemas
- [ ] Auth middleware (cookie extraction, token verify)
- [ ] Login/Register pages with forms
- [ ] Auth store with auto-hydrate
- [ ] API response envelope utility
- [ ] Rate limiting (auth endpoints)
- [ ] Note CRUD API + FTS search endpoint
- [ ] Note list page with cursor pagination + search
- [ ] Note detail page (view mode)
- [ ] Milkdown React island wrapper (view/edit toggle)
- [ ] NoteConflictResolver (409 handling)
- [ ] Trash page (restore/permanently delete)
- [ ] AppShell + Sidebar + Header + MobileDrawer
- [ ] ThemeToggle + dark mode persistence
- [ ] Toast notification system
- [ ] OnboardingWizard (3-step)
- [ ] Loading/empty/error states for all 5 views (list, detail, search, trash, create)
- [ ] Auth-protected route group `(app)/` with layout guard

## Success Criteria

- User can register, log in, log out
- User can create note with markdown, view rendered output
- User can edit note with WYSIWYG editor, auto-save works
- User can search notes by keyword (FTS)
- User can delete/restore notes (trash)
- App is responsive (desktop sidebar → mobile drawer)
- Dark mode toggle works and persists
- New user sees onboarding wizard
- All API calls use standardized envelope
- No localStorage for auth tokens (httpOnly cookies only)
- Rate limiting returns 429 on auth endpoints

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Milkdown React island adds 40KB | MEDIUM | Accept for MVP. Plan ProseMirror migration in Phase 4 |
| Auto-save conflicts with concurrent edits | MEDIUM | Version check (PUT requires `version` field match, returns 409) |
| SSR hydration mismatch with dark mode | LOW | Inject `data-theme` via cookie before render |
| Cursor pagination complexity | LOW | Use note `id` as cursor (UUID, sortable), `take` param |

## Security Considerations

- Argon2id for password hashing (bcryptjs as fallback)
- httpOnly, Secure, SameSite=Lax cookies for JWT
- Refresh token rotation (invalidate old on use)
- Rate limit login (5/min), register (3/hour)
- Input validation via Zod (XSS prevention, max lengths)
- No password in API responses (select fields explicitly)

## Next Steps

Proceed to **Phase 2** (Gamification) — engine, quests, XP/coins, leveling.
