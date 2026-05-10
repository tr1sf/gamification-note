# Phase 4 — AI Integration & Final Polish

**Status:** Pending | **Priority:** P1 | **Effort:** 17h | **Blocks:** None | **Blocked by:** Phase 3

## Overview

Integrate OpenAI for AI-powered note summarization and image generation.
Complete the full tavern theme migration. Add statistics dashboard.
Run testing suite. Prepare for deployment and thesis demonstration.

## Key Insights

- Use **GPT-4o-mini** for summarization (10x cheaper than GPT-4o, sufficient quality)
- Cache AI responses: content-hash → cached summary (24h TTL)
- Rate limit: 10 AI requests/min, minimum 500 chars for summarization
- Image generation: DALL-E 3, cache URL in note (no re-generation)
- Tavern theme: CSS variable swap — no component rewrites needed
- Testing: Vitest (unit) + Playwright (E2E for critical flows)

## Requirements

### Functional
- **AI Summarize**: Click button → GPT-4o-mini summarizes note content → save to note.aiSummary
- **AI Image Generation**: Click button → DALL-E generates image from note content → save URL to note.aiImageUrl
- **Statistics Dashboard**: Personal analytics (notes created, words written, XP history, streak, quests completed)
- **Tavern Theme**: Full medieval aesthetic (fonts, colors, textures, ornaments)
- **Accessibility Audit**: ARIA labels, keyboard navigation, screen reader testing
- **Testing**: Unit tests (gamification engine, calculators), E2E (auth, note CRUD, quest flow)

### Non-functional
- AI cache hits skip API call (cost saving)
- GPT-4o-mini token limit: 4096 input, 1024 output
- Image gen: 1024x1024, natural style, $0.04/image (DALL-E 3 standard)
- Lighthouse: Performance > 90, Accessibility > 95
- Bundle size: < 150KB first load (SolidJS + TailwindCSS + router)

## Architecture

### AI Integration (`lib/ai/`)

```
lib/ai/
├── client.ts       # OpenAI client config (GPT-4o-mini)
├── summarize.ts    # Prompt template + response parser + cache
└── image.ts        # DALL-E prompt builder
```

#### Summarize (`lib/ai/summarize.ts`)
```typescript
import OpenAI from 'openai';
import { env } from '~/lib/env';

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

const cache = new Map<string, { summary: string; hash: string; createdAt: number }>();

export async function summarizeNote(content: string): Promise<string> {
  // Minimum length check
  if (content.length < 500) return content;

  // Cache check
  const contentHash = await hashContent(content);
  const cached = cache.get(contentHash);
  if (cached && Date.now() - cached.createdAt < 24 * 60 * 60 * 1000) {
    return cached.summary;
  }

  // Truncate to token limit
  const truncated = content.slice(0, 12000); // ~3000 tokens

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You are a helpful note summarizer. Summarize the following note in 3-5 bullet points. Keep it concise. Respond in the same language as the input.' },
      { role: 'user', content: truncated },
    ],
    max_tokens: 500,
    temperature: 0.3,
  });

  const summary = response.choices[0]?.message?.content || '';
  cache.set(contentHash, { summary, hash: contentHash, createdAt: Date.now() });

  return summary;
}

async function hashContent(content: string): Promise<string> {
  // Simple hash for cache key (use Web Crypto or crypto module)
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}
```

#### Image Generation (`lib/ai/image.ts`)
```typescript
export async function generateNoteImage(content: string): Promise<string> {
  // Extract key concepts from first 500 chars for prompt
  const promptBase = content.slice(0, 1500);

  const response = await openai.images.generate({
    model: 'dall-e-3',
    prompt: `Create a fantasy illustration inspired by this text, in a style fitting a medieval scholar's journal: ${promptBase}`,
    n: 1,
    size: '1024x1024',
    style: 'natural',
  });

  return response.data[0]?.url || '';
}
```

### API Endpoints (Phase 4 additions)

```
POST /api/notes/[id]/summarize        → { id, aiSummary } — rate limited 10/min
POST /api/notes/[id]/generate-image   → { id, aiImageUrl } — rate limited 5/min
GET  /api/stats/dashboard             → { totalNotes, totalWords, streak, xpHistory, questCompleted, weeklyActivity }
```

### Statistics Dashboard (`api/stats/dashboard.ts`)

```typescript
export async function GET({ locals }) {
  const userId = locals.user.userId;

  const [totalNotes, totalWords, user, questCompleted, weeklyActivity] = await Promise.all([
    prisma.note.count({ where: { userId, isDeleted: false } }),
    prisma.note.aggregate({ where: { userId, isDeleted: false }, _sum: { wordCount: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { xp: true, level: true, coins: true, createdAt: true } }),
    prisma.userQuest.count({ where: { userId, status: 'completed' } }),
    // Weekly activity: notes per day for last 7 days
    prisma.$queryRaw`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM "Note"
      WHERE user_id = ${userId}::uuid
        AND created_at >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(created_at)
      ORDER BY date
    `,
  ]);

  return success({
    totalNotes, totalWords: totalWords._sum.wordCount || 0,
    xp: user.xp, level: user.level, coins: user.coins,
    questCompleted, weeklyActivity,
    memberSince: user.createdAt,
  });
}
```

### Tavern Theme Migration

Swap CSS custom properties in `src/app.css`:

```css
/* Phase 4: Full Tavern Theme */
:root {
  /* Surfaces — parchment tones */
  --color-bg: 250 245 235;              /* warm parchment */
  --color-bg-elevated: 240 230 210;     /* aged scroll */
  --color-bg-overlay: 20 15 5;          /* dark oak modal */

  /* Text — dark brown ink */
  --color-text-primary: 45 30 15;       /* near-black ink */
  --color-text-secondary: 120 90 60;    /* faded ink */

  /* Accent — amber/gold */
  --color-accent: 180 130 30;           /* gold trim */
  --color-accent-hover: 200 150 40;     /* bright gold hover */

  /* Gamification */
  --color-xp: 80 160 80;                /* forest emerald */
  --color-coin: 212 175 55;             /* gold coin */

  /* Typography — medieval fonts */
  --font-display: 'Cinzel', serif;      /* headings */
  --font-body: 'Crimson Text', serif;   /* body text */
  --font-mono: 'JetBrains Mono', monospace;

  /* Borders — sharper, like parchment cuts */
  --radius-sm: 0.125rem;
  --radius-md: 0.25rem;

  /* Background texture */
  --bg-texture: url('/assets/parchment-texture.png');
}

/* Add Google Fonts in app.tsx head or via @import */
/* @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Crimson+Text:ital,wght@0,400;0,600;1,400&display=swap'); */
```

**Progressive migration** (swap one group per day):
1. Fonts (Cinzel + Crimson Text)
2. Colors (parchment surfaces + brown ink)
3. Accent (gold trim for buttons, badges)
4. Borders & radius (sharp, aged feel)
5. Add parchment texture background
6. Ornamental dividers, decorative borders via CSS pseudo-elements

## Component Tree (Phase 4 additions)

```
components/ai/
├── SummarizeButton.tsx    # Button in note toolbar. Shows loading spinner + cached result
└── ImageGenPanel.tsx      # "Generate illustration" with preview + save to note
```

Components upgraded with final styles:
- `Sidebar.tsx`: oak wood texture, gold trim, parchment nav items
- `Header.tsx`: medieval banner, XP bar with emerald glow
- `LoginForm.tsx`, `RegisterForm.tsx`: aged scroll styling, wax seal feel
- `NoteCard.tsx`: scroll appearance with curled edges (CSS)

## Testing Plan

### Unit Tests (Vitest)
```
tests/unit/
├── gamification/
│   ├── xp-calculator.test.ts   # Verify XP for each action type
│   ├── coin-calculator.test.ts  # Coin earning rules
│   └── level-calculator.test.ts # Level formula accuracy
├── auth/
│   └── jwt.test.ts              # Token sign/verify, expiration
├── validators/
│   └── note.test.ts             # Zod schema validation (min/max, required fields)
```

### E2E Tests (Playwright)
```
tests/e2e/
├── auth.spec.ts     # Register → login → session persists → logout
├── notes.spec.ts    # Create → view → edit → search → delete → restore
├── quests.spec.ts   # Quest appears → progresses on note create → claim → XP awarded
└── guilds.spec.ts   # Create guild → join guild → send message → leave
```

## Implementation Steps

### Step 4.1: AI Summarize Feature
- `lib/ai/client.ts`: OpenAI config
- `lib/ai/summarize.ts`: prompt + cache
- `api/notes/[id]/summarize.ts`: POST endpoint with rate limit
- `SummarizeButton.tsx` in note toolbar: trigger, loading state, display result

### Step 4.2: AI Image Generation
- `lib/ai/image.ts`: DALL-E prompt builder
- `api/notes/[id]/generate-image.ts`: POST endpoint with rate limit
- `ImageGenPanel.tsx`: button, loading state, preview + save

### Step 4.3: Statistics Dashboard
- `api/stats/dashboard.ts`: aggregate queries
- `/settings` or dedicated stats section: display charts/numbers
- Simple bar chart for weekly activity (HTML canvas or lightweight chart lib)

### Step 4.4: Full Tavern Theme
- Swap CSS variables (fonts → colors → accents → borders → textures)
- Add Google Fonts (Cinzel, Crimson Text)
- Add parchment texture SVG/CSS background
- Ornamental dividers: `::after` pseudo-elements with SVG
- Wax seal effect on buttons (CSS box-shadow + border-radius tricks)

### Step 4.5: Accessibility Audit
- ARIA labels on all gamification elements (XP bar → progressbar, level → status, coins → aria-live)
- Keyboard navigation: Tab through all interactive elements, Enter/Space to activate
- Focus indicators visible (Tailwind `focus:ring-2`)
- Command palette (Cmd+K) for power users — keyboard-driven navigation
- Screen reader testing (NVDA or VoiceOver)

### Step 4.6: Unit Tests
- Write Vitest tests for gamification engine, calculators
- Write Zod validation tests
- Run: `pnpm test`

### Step 4.7: E2E Tests
- Write Playwright tests for critical user flows
- Run: `pnpm test:e2e`

### Step 4.8: Production Readiness
- Railway.app deploy (`railway up`)
- Environment variables configured
- Database backups enabled
- Logging set up
- Error tracking (console-based for thesis)

## Todo List

- [ ] OpenAI client config (gpt-4o-mini)
- [ ] Summarize prompt + response parser + cache
- [ ] DALL-E image generation prompt
- [ ] API: POST /notes/:id/summarize (rate limited)
- [ ] API: POST /notes/:id/generate-image (rate limited)
- [ ] SummarizeButton UI (loading spinner, result display)
- [ ] ImageGenPanel UI (preview, save)
- [ ] Stats dashboard API
- [ ] Stats dashboard UI (charts + numbers)
- [ ] CSS variable swap → full tavern theme
- [ ] Google Fonts integration
- [ ] Parchment texture + ornaments
- [ ] ARIA audit pass (20+ elements)
- [ ] Keyboard navigation pass
- [ ] Command palette (Cmd+K)
- [ ] Vitest unit tests (gamification, validation)
- [ ] Playwright E2E tests (auth, notes, quests, guilds)
- [ ] Railway.app production deploy
- [ ] Database backup configured
- [ ] Final build check (Lighthouse audit)

## Success Criteria

- AI summarizes notes correctly (3-5 bullet points, same language as input)
- AI generates relevant fantasy-style illustrations
- Cache prevents redundant API calls
- Rate limits return 429
- Statistics dashboard shows accurate personal metrics
- Full tavern theme renders without visual bugs
- All interactive elements are keyboard-accessible
- Screen reader announces XP changes, level-ups, quest completions
- Unit tests pass (≥ 80% coverage on gamification engine)
- E2E tests pass (critical flows: auth, note CRUD, quests)
- Production deploy on Railway.app is live
- Lighthouse: Performance > 90, Accessibility > 95

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| OpenAI API costs spike | HIGH | Set hard limit in OpenAI dashboard ($10/month). Cache. Rate limiting. |
| GPT-4o-mini summarizes poorly in Vietnamese | MEDIUM | Add language detection. Accept lower quality for thesis — note it as limitation |
| DALL-E generates inappropriate images | LOW | Prompt engineering: "fantasy illustration, medieval style". Content filter on by default |
| Tavern fonts hurt readability | MEDIUM | Keep body font size ≥ 16px. High contrast colors. Offer "Simple mode" toggle? |
| Railway free tier limits (512MB RAM) | LOW | SolidStart + PostgreSQL fits within limits. Monitor with `railway logs` |

## Security Considerations

- OpenAI API key server-side only (never exposed to client)
- AI endpoints require auth + rate limiting
- Content validation before sending to OpenAI (max 12K chars, strip HTML)
- DALL-E prompt sanitization (no injection via note content)

## Deployment Checklist

- [ ] Railway.app project linked
- [ ] All env vars set in Railway dashboard
- [ ] PostgreSQL plugin provisioned
- [ `railway up` deploys successfully
- [ ] Custom domain? (optional for thesis)
- [ ] Database backups automated (Railway built-in)
- [ ] Health check endpoint working
- [ ] Socket.io connecting on production

## Next Steps

Project complete. Prepare thesis defense presentation + demo video.
Archive this plan for reference.
