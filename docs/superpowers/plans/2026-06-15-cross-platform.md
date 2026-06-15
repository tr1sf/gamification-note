# TavernoteX Cross-Platform — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy TavernoteX to Railway (web), add PWA support, and wrap in Tauri v2 for desktop + mobile distribution.

**Architecture:** Cloud backend on Railway (SolidStart + PostgreSQL + Socket.io). Tauri apps are thin WebView wrappers pointing to the Railway URL. No code changes to SolidStart — just configuration and native shell.

**Tech Stack:** SolidStart, Prisma 7, PostgreSQL (prod) / SQLite (dev), Socket.io, Tauri v2, Rust, Railway.app

---

## Phase 0: Prep Codebase

### Task 0.1: Create `.env.production`

**File:** `.env.production` (new, gitignore'd)

```
DATABASE_URL=${RAILWAY_POSTGRESQL_URL}
JWT_ACCESS_SECRET=${JWT_ACCESS_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
GEMINI_API_KEY=${GEMINI_API_KEY}
NODE_ENV=production
CLIENT_URL=https://tavernotex-production.up.railway.app
```

- [ ] Create `.env.production` with placeholders referencing Railway environment variables
- [ ] Add `.env.production` to `.gitignore` if not already covered by `.env*` pattern

### Task 0.2: Update Socket.io CORS for Production

**File:** `src/lib/socket/index.ts`

The CORS origin at line 11 currently reads `process.env.CLIENT_URL || 'http://localhost:3000'`. Update to accept multiple origins (Railway URL + Tauri custom protocol + PWA scope):

- [ ] Edit `src/lib/socket/index.ts` line 10-13 — change the `cors.origin` from a single string to a function that validates multiple allowed origins:

```typescript
// src/lib/socket/index.ts (lines 8-16, replace cors block)
import { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { verifyAccessToken } from '~/lib/auth/jwt';
import { registerHandlers } from './handlers';

let io: Server | null = null;

const ALLOWED_ORIGINS = [
  process.env.CLIENT_URL || 'http://localhost:3000',
  'https://tavernotex-production.up.railway.app',
  'tauri://localhost',
  'https://tauri.localhost',
];

export function initSocket(server: HttpServer): Server {
  io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || ALLOWED_ORIGINS.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });
  // ... rest unchanged
```

- [ ] Verify the rest of the file (JWT auth middleware, handler registration) remains unchanged

### Task 0.3: Create Railway Build Config

**File:** `railway.json` (new)

Railway auto-detects Node.js via `package.json`. This config explicitly sets the start command and build steps:

- [ ] Create `railway.json`:

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm run build && npx prisma generate"
  },
  "deploy": {
    "startCommand": "node .output/server/index.mjs",
    "healthcheckPath": "/api/health",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### Task 0.4: Add Health Check Endpoint

**File:** `src/routes/api/health.ts` (new)

- [ ] Create `src/routes/api/health.ts`:

```typescript
import { json } from '@solidjs/router';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return json({ status: 'ok', db: 'connected', timestamp: Date.now() });
  } catch (e) {
    return json(
      { status: 'error', db: 'disconnected', error: String(e) },
      { status: 503 }
    );
  }
}
```

- [ ] Test locally: `curl http://localhost:3000/api/health` should return `{"status":"ok","db":"connected",...}`

### Task 0.5: Add Prisma Production Migrate Script

**File:** `package.json` (update scripts)

- [ ] Add to `package.json` `"scripts"`:

```json
"db:migrate:prod": "prisma migrate deploy"
```

- [ ] Verify Prisma migration files exist in `prisma/migrations/`

---

## Phase 1: Railway Deploy

### Task 1.1: Push to GitHub

- [ ] Ensure all changes are committed:
```bash
git add -A
git commit -m "feat(ops): add Railway deployment config and health endpoint"
git push origin main
```

### Task 1.2: Railway Project Setup

- [ ] Install Railway CLI if not present:
```bash
npm i -g @railway/cli
```

- [ ] Login and link:
```bash
railway login
railway link
```

- [ ] Create new project if needed:
```bash
railway init
```

### Task 1.3: Provision PostgreSQL

- [ ] Add PostgreSQL plugin:
```bash
railway add -d postgresql
```

Railway auto-generates `DATABASE_URL` as `${{RAILWAY_POSTGRESQL_URL}}` — this matches the placeholder in `.env.production`.

### Task 1.4: Set Environment Variables

- [ ] Set all required env vars via Railway dashboard or CLI:
```bash
railway variables set JWT_ACCESS_SECRET=$(openssl rand -hex 32)
railway variables set JWT_REFRESH_SECRET=$(openssl rand -hex 32)
railway variables set GEMINI_API_KEY=your-gemini-key
railway variables set NODE_ENV=production
railway variables set CLIENT_URL=https://tavernotex-production.up.railway.app
```

- [ ] Verify variables: `railway variables`

### Task 1.5: Deploy

- [ ] Deploy the application:
```bash
railway up
```

- [ ] Wait for build to complete. Expected output: `Deployment successful`

### Task 1.6: Run Migrations and Seed

- [ ] Run migrations on production:
```bash
railway run npx prisma migrate deploy
```

Expected output: list of applied migrations.

- [ ] Seed the database (optional, for initial data):
```bash
railway run npx prisma db seed
```

### Task 1.7: Verify Deployment

- [ ] Check health endpoint:
```bash
curl https://tavernotex-production.up.railway.app/api/health
```
Expected: `{"status":"ok","db":"connected","timestamp":...}`

- [ ] Open in browser, test:
  - [ ] Register new account
  - [ ] Login
  - [ ] Create a note
  - [ ] Verify Socket.io connects (check Network tab for WebSocket to `/socket.io/`)

---

## Phase 2: PWA

### Task 2.1: Create Web App Manifest

**File:** `public/manifest.json` (new)

- [ ] Create `public/manifest.json`:

```json
{
  "name": "TavernoteX",
  "short_name": "Tavernote",
  "description": "Gamified note-taking with a medieval tavern theme",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#1a0a00",
  "theme_color": "#d4a030",
  "orientation": "any",
  "categories": ["productivity", "notes", "education"],
  "icons": [
    {
      "src": "/assets/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/assets/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

### Task 2.2: Create Service Worker

**File:** `public/sw.js` (new)

- [ ] Create `public/sw.js`:

```javascript
const CACHE_NAME = 'tavernotex-v1';
const ASSET_CACHE = [
  '/',
  '/manifest.json',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSET_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (url.pathname.startsWith('/api/')) {
    // Network-first for API
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) =>
            cache.put(event.request, clone)
          );
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request).then((response) => {
        caches.open(CACHE_NAME).then((cache) =>
          cache.put(event.request, response.clone())
        );
        return response;
      });
      return cached || fetchPromise;
    })
  );
});
```

### Task 2.3: Add Manifest and Meta Tags

**File:** `src/app.tsx`

- [ ] Edit `src/app.tsx` to add `<Meta>` tags from `@solidjs/meta`:

```tsx
import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { Suspense } from "solid-js";
import { MetaProvider, Meta, Link } from "@solidjs/meta";
import "./app.css";

export default function App() {
  return (
    <MetaProvider>
      <Meta name="theme-color" content="#d4a030" />
      <Meta name="description" content="Gamified note-taking with a medieval tavern theme" />
      <Link rel="manifest" href="/manifest.json" />
      <Meta name="mobile-web-app-capable" content="yes" />
      <Meta name="apple-mobile-web-app-capable" content="yes" />
      <Meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      <Meta name="apple-mobile-web-app-title" content="TavernoteX" />
      <Router
        root={(props) => (
          <Suspense>{props.children}</Suspense>
        )}
      >
        <FileRoutes />
      </Router>
    </MetaProvider>
  );
}
```

### Task 2.4: Register Service Worker

**File:** `src/entry-client.tsx`

- [ ] Edit `src/entry-client.tsx` to register the service worker:

```tsx
/// <reference types="vinxi/types/client" />
import { mount, StartClient } from "@solidjs/start/client";

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
    // SW registration failed — app works without offline support
  });
}

mount(() => <StartClient />, document.getElementById("app")!);
```

- [ ] Verify: Run `npm run dev`, open browser, check DevTools > Application > Service Workers — should show registered SW.

---

## Phase 3: Tauri v2 Init

### Task 3.1: Install Tauri Dependencies

- [ ] Install Tauri CLI and API as dev dependencies:
```bash
npm install --save-dev @tauri-apps/cli @tauri-apps/api
```

### Task 3.2: Initialize Tauri Project

- [ ] Run Tauri init:
```bash
npx tauri init
```

When prompted:
- App name: `TavernoteX`
- Window title: `TavernoteX`
- Web assets relative path: `../dist` (or use URL mode — see next step)
- Dev URL: `http://localhost:3000`
- Frontend dev command: `npm run dev`
- Frontend build command: `npm run build`

### Task 3.3: Configure Tauri for WebView-Only (No Server)

**File:** `src-tauri/tauri.conf.json`

- [ ] Edit `src-tauri/tauri.conf.json` — configure to open Railway URL in webview, no local server:

```json
{
  "$schema": "https://raw.githubusercontent.com/taur-apps/tauri/dev/crates/tauri-cli/schema.json",
  "productName": "TavernoteX",
  "version": "0.1.0",
  "identifier": "com.tavernotex.app",
  "build": {
    "frontendDist": "../.output/public",
    "devUrl": "http://localhost:3000",
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build"
  },
  "app": {
    "withGlobalTauri": true,
    "windows": [
      {
        "title": "TavernoteX",
        "width": 1200,
        "height": 800,
        "minWidth": 800,
        "minHeight": 600,
        "center": true
      }
    ],
    "security": {
      "csp": null
    }
  }
}
```

> **Note:** The `frontendDist` still points to local build output for offline fallback. In URL mode (production), `main.rs` redirects to Railway. See Task 3.4.

### Task 3.4: Create Minimal Rust Entry Point

**File:** `src-tauri/src/main.rs`

- [ ] Replace `src-tauri/src/main.rs` — the app opens Railway URL in its webview with local build as fallback:

```rust
// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            // In production, open Railway URL. In dev, vite URL is used.
            #[cfg(not(debug_assertions))]
            {
                let _ = window.eval(
                    "window.location.replace('https://tavernotex-production.up.railway.app')"
                );
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Task 3.5: Configure Cargo.toml

**File:** `src-tauri/Cargo.toml`

- [ ] Edit `src-tauri/Cargo.toml` — ensure minimal dependencies:

```toml
[package]
name = "tavernotex"
version = "0.1.0"
description = "Gamified note-taking with a medieval tavern theme"
edition = "2021"
rust-version = "1.70"

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }

[features]
default = ["custom-protocol"]
custom-protocol = ["tauri/custom-protocol"]
```

### Task 3.6: Add Tauri Scripts to package.json

- [ ] Add Tauri scripts to `package.json` `"scripts"`:

```json
"tauri": "tauri",
"tauri:dev": "tauri dev",
"tauri:build": "tauri build"
```

---

## Phase 4: Native Features

### Task 4.1: Install Tauri Plugins

- [ ] Install notification and dialog plugins:
```bash
npm install --save-dev @tauri-apps/plugin-notification @tauri-apps/plugin-dialog @tauri-apps/plugin-shell
```

- [ ] Add Rust crate dependencies to `src-tauri/Cargo.toml`:

```toml
[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-notification = "2"
tauri-plugin-dialog = "2"
tauri-plugin-shell = "2"
```

### Task 4.2: Register Plugins in Rust

**File:** `src-tauri/src/lib.rs`

- [ ] Edit `src-tauri/src/lib.rs` to register plugins:

```rust
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            #[cfg(not(debug_assertions))]
            {
                let _ = window.eval(
                    "window.location.replace('https://tavernotex-production.up.railway.app')"
                );
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

Update `src-tauri/src/main.rs` to delegate to `lib.rs`:

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tavernotex::run();
}
```

### Task 4.3: Configure Deep Links

**File:** `src-tauri/tauri.conf.json` — add deep link config:

```json
"app": {
  "withGlobalTauri": true,
  "windows": [
    {
      "title": "TavernoteX",
      "width": 1200,
      "height": 800,
      "minWidth": 800,
      "minHeight": 600,
      "center": true
    }
  ],
  "security": {
    "csp": null
  }
}
```

Add to `tauri.conf.json` top-level:

```json
"plugins": {
  "deep-link": {
    "desktop": {
      "schemes": ["tavernotex"]
    }
  }
}
```

Install the deep-link plugin:
```bash
npm install --save-dev @tauri-apps/plugin-deep-link
```

Add to `Cargo.toml`:
```toml
tauri-plugin-deep-link = "2"
```

Register in `lib.rs`:
```rust
.plugin(tauri_plugin_deep_link::init())
```

### Task 4.4: File Export (Save Note as .md)

Create a frontend utility for exporting notes via Tauri dialog:

**File:** `src/lib/tauri-export.ts` (new)

```typescript
import { save } from '@tauri-apps/plugin-dialog';
import { writeTextFile } from '@tauri-apps/plugin-fs';
import { isTauri } from '@tauri-apps/api/core';

export async function exportNote(filename: string, content: string) {
  if (!isTauri()) {
    console.warn('Export only available in Tauri desktop');
    return;
  }

  const filePath = await save({
    defaultPath: `${filename}.md`,
    filters: [{ name: 'Markdown', extensions: ['md'] }],
  });

  if (filePath) {
    await writeTextFile(filePath, content);
  }
}
```

### Task 4.5: Notification Helper

**File:** `src/lib/tauri-notification.ts` (new)

```typescript
import { isTauri } from '@tauri-apps/api/core';
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';

export async function notify(title: string, body: string) {
  if (!isTauri()) {
    // Fallback to browser Notification API
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body });
    }
    return;
  }

  let granted = await isPermissionGranted();
  if (!granted) {
    const permission = await requestPermission();
    granted = permission === 'granted';
  }
  if (granted) {
    sendNotification({ title, body });
  }
}
```

---

## Phase 5: Desktop Build

### Task 5.1: Install Rust Targets

- [ ] Add Windows target:
```bash
rustup target add x86_64-pc-windows-msvc
```

- [ ] For macOS (run on Mac or use GitHub Actions):
```bash
rustup target add aarch64-apple-darwin
rustup target add x86_64-apple-darwin
```

- [ ] For Linux (AppImage):
```bash
rustup target add x86_64-unknown-linux-gnu
```

### Task 5.2: Build Desktop App

- [ ] Run Tauri build:
```bash
npx tauri build
```

Expected output:
- `src-tauri/target/release/bundle/msi/tavernotex_0.1.0_x64_en-US.msi` (Windows)
- `src-tauri/target/release/bundle/dmg/tavernotex_0.1.0_x64.dmg` (macOS)

### Task 5.3: Test Desktop Build

- [ ] Install the `.msi` or `.exe` on Windows
- [ ] Launch — verify:
  - [ ] WebView opens and loads Railway URL
  - [ ] Login works
  - [ ] Note creation works
  - [ ] Socket.io connects (real-time presence)
  - [ ] Window resizing works

---

## Phase 6: Mobile Build

### Task 6.1: Install Android Toolchain

- [ ] Install Android targets:
```bash
rustup target add aarch64-linux-android
rustup target add armv7-linux-androideabi
rustup target add i686-linux-android
rustup target add x86_64-linux-android
```

- [ ] Install Android SDK and NDK (via Android Studio or command line)
- [ ] Set environment variables:
```
ANDROID_HOME=[path-to-sdk]
NDK_HOME=[path-to-ndk]
```

### Task 6.2: Init and Build Android

- [ ] Initialize Android project:
```bash
npx tauri android init
```

- [ ] Build Android APK:
```bash
npx tauri android build
```

Expected output: `src-tauri/gen/android/app/build/outputs/apk/release/app-release.apk`

### Task 6.3: iOS (macOS Required)

- [ ] Initialize iOS project (on Mac with Xcode):
```bash
npx tauri ios init
```

- [ ] Open in Xcode:
```bash
npx tauri ios open
```

- [ ] Configure signing team in Xcode
- [ ] Build IPA via Xcode or:
```bash
npx tauri ios build
```

Expected output: `.ipa` file in `src-tauri/gen/apple/`

### Task 6.4: Test Mobile

- [ ] Install APK on Android device
- [ ] Verify:
  - [ ] App launches with splash screen
  - [ ] WebView loads Railway URL
  - [ ] Login/register works
  - [ ] Notifications work (if enabled)
  - [ ] Deep links work (test from browser: `tavernotex://`)

---

## Verification Checklist

After all phases complete, verify:

- [ ] `https://tavernotex-production.up.railway.app` loads and works in browser
- [ ] `/api/health` returns `{"status":"ok","db":"connected"}`
- [ ] PWA: Install prompt appears on Chrome Android, app works offline for cached assets
- [ ] Service worker registered and caching assets
- [ ] `npx tauri dev` launches desktop window connected to local dev server
- [ ] `npx tauri build` produces working `.msi`/`.exe`
- [ ] Desktop app opens Railway production URL in release mode
- [ ] Mobile APK installs and runs on Android

---

## Rollback Plan

| Scenario | Action |
|----------|--------|
| Railway deploy fails | `railway down` → fix → `railway up` |
| DB migration fails | `railway run npx prisma migrate resolve --rolled-back` or restore from Railway backup |
| Tauri build fails | Check Rust toolchain: `rustup update`, verify `Cargo.toml` versions |
| Mobile build fails | Verify Android SDK/NDK paths in `$ANDROID_HOME` |
