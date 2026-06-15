# TavernoteX Cross-Platform (PWA + Tauri v2) — Design Spec

> **Date:** 2026-06-15 | **Approach:** Cloud backend + Tauri WebView wrapper

## 1. Architecture

```
Railway.app (Production)
├── SolidStart Server (SSR + API + Socket.io)
└── PostgreSQL

          ↕ HTTPS + WebSocket

┌─────────┬─────────┬──────────┐
│  Web    │  Tauri  │  Tauri   │
│ Browser │ Desktop │  Mobile  │
│ (+PWA)  │(WebView)│ (WebView)│
└─────────┴─────────┴──────────┘
```

Nguyên tắc: Code SolidStart giữ nguyên. Tauri chỉ là WebView wrapper trỏ tới Railway URL. Không thay đổi business logic. Không cần refactor. Không cần local server trong Tauri.

## 2. Database Strategy

| Môi trường | Provider | File/Service |
|------------|----------|-------------|
| Development | SQLite | `prisma/dev.db` (đã hoạt động) |
| Production | PostgreSQL | Railway plugin |

Current setup uses `prisma.config.ts` pointing at `DATABASE_URL` env var. Prisma 7 with typed config already handles multi-provider. The `@prisma/adapter-pg` and `pg` packages are already in `package.json` as dependencies.

## 3. Implementation Phases

### P0: Prep Codebase (30 min)
- Create `.env.production` with Railway `DATABASE_URL` placeholder
- Update Socket.io CORS to accept Railway domain: `src/lib/socket/index.ts:11` currently reads `process.env.CLIENT_URL || 'http://localhost:3000'`
- Create `railway.json` build config with `nixpacks.toml`-style config
- Add health check endpoint `src/routes/api/health.ts`
- Add Prisma production migration script

### P1: Railway Deploy (1h)
- Push code to GitHub
- `railway link` connect project
- Provision PostgreSQL plugin
- Set all env vars (`DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `GEMINI_API_KEY`, `NODE_ENV=production`, `CLIENT_URL`)
- `railway up` deploy
- Run migration + seed via `railway run`
- Verify: login, create note, test Socket.io

### P2: PWA (1h)
- Create `public/manifest.json` with tavern theme colors
- Create `public/sw.js` service worker (cache-first assets, network-first API)
- Add `<link rel="manifest">` and `<meta name="theme-color">` to `src/app.tsx` via `<Meta>` from `@solidjs/meta`
- Register service worker in `src/entry-client.tsx`

### P3: Tauri v2 Init (2h)
- Install `@tauri-apps/cli` `@tauri-apps/api` as devDeps
- `npx tauri init` with config: WebView URL = Railway URL, window 1200x800
- Configure Tauri desktop: no Rust server logic needed, just `tauri::open` for the URL
- Create `src-tauri/Cargo.toml` and `src-tauri/src/main.rs` with minimal WebView setup
- Add Tauri mobile plugins (notification, biometric)

### P4: Native Features (2h)
- Push notifications via `@tauri-apps/plugin-notification`
- Deep links: `tavernotex://notes/:id` scheme
- File export via `@tauri-apps/plugin-dialog` (save note as .md)
- Splash screen via `@tauri-apps/plugin-splashscreen`

### P5: Desktop Build (1h)
- Install Rust toolchain: `rustup target add x86_64-pc-windows-msvc`
- `npx tauri build` → .exe
- Test: install .exe, verify WebView loads Railway, auth works
- macOS: cross-compile or build on Mac → .dmg

### P6: Mobile Build (2h)
- Android: `rustup target add aarch64-linux-android` + Android SDK/NDK
- `npx tauri android init` → build .apk
- iOS: requires macOS + Xcode → build .ipa
- Test: install APK, verify WebView, notifications

## 4. Risks

| Risk | Mitigation |
|------|-----------|
| Railway free tier sleeps after inactivity | $5/month hobby plan keeps server online |
| Tauri mobile build complex | Android SDK must be installed correctly; iOS needs Mac. Build desktop first, mobile after |
| WebSocket disconnect on mobile | Tauri WebView handles connections better than mobile browsers |
| Prisma multi-provider conflict | SQLite doesn't support tsvector FTS → ILIKE fallback already in search code |
| Socket.io standalone vs integrated | Current dual setup: integrated in SolidStart server + optional `standalone.ts`. For Railway, the integrated server handles both HTTP and WebSocket. Ensure `standalone.ts` is NOT started in production. |

## 5. Key Decisions

| Decision | Rationale |
|----------|-----------|
| Cloud backend, not local-first | Code không cần sửa, deploy 1 lần dùng mọi nơi |
| WebView trỏ Railway URL | Không cần bundle server, update không cần build lại Tauri |
| SQLite for dev, PostgreSQL for prod | Prisma abstracts the difference; already working |
| Desktop before mobile | Desktop build đơn giản hơn, verify pattern trước |
| Keep existing Vinxi/SolidStart build | No migration needed. `app.config.ts` preset is `node-server`, Railway handles Node.js natively |

## 6. Existing Infrastructure to Leverage

| Component | File | Status |
|-----------|------|--------|
| SolidStart SSR | `app.config.ts` with `node-server` preset | Working |
| Socket.io | `src/lib/socket/index.ts` + `standalone.ts` | Working |
| Prisma v7 | `prisma.config.ts` with typed config | Working |
| PostgreSQL adapter | `@prisma/adapter-pg` in deps | Installed |
| CORS config | Line 11 of `src/lib/socket/index.ts` | Uses `CLIENT_URL` env |
| Auth (JWT) | `src/lib/auth/jwt.ts` + `src/middleware.ts` | Working |
| Vinxi build | `npm run build` → `.output/` | Working |
