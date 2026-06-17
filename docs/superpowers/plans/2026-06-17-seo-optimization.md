# SEO Optimization — Implementation Plan

> **Date:** 2026-06-17 | **Status:** In Progress | **Effort:** 30min

## Goal

Optimize TavernoteX for search engines and social sharing. Ensure proper meta tags, Open Graph, Twitter Cards, sitemap, and robots.txt.

## Architecture

Static SEO baseline added to `entry-server.tsx` `<head>`. No per-page dynamic meta (future enhancement). `robots.txt` and `sitemap.xml` served from `public/`.

---

## Tasks

### Task 1: Add meta tags to entry-server.tsx

**File:** `src/entry-server.tsx`

- `<title>` — "TavernoteX — Gamified AI Note-Taking App"
- `<meta name="description">` — 1-2 sentence summary
- `<meta name="keywords">` — target keywords
- `<meta name="robots" content="index, follow">`
- `<link rel="canonical" href="...">` — production URL

### Task 2: Add Open Graph tags

**File:** `src/entry-server.tsx`

- `og:title`, `og:description`, `og:type`, `og:url`, `og:image`, `og:image:width`, `og:image:height`, `og:site_name`, `og:locale`
- Makes shared links look good on Facebook, Zalo, Discord, LinkedIn, etc.

### Task 3: Add Twitter Card tags

**File:** `src/entry-server.tsx`

- `twitter:card` (summary), `twitter:title`, `twitter:description`, `twitter:image`
- Makes shared links look good on Twitter/X

### Task 4: Create robots.txt

**File:** `public/robots.txt`

```
User-agent: *
Allow: /
Disallow: /api/
Sitemap: https://gamification-note-production.up.railway.app/sitemap.xml
```

### Task 5: Create sitemap.xml

**File:** `public/sitemap.xml`

- Static sitemap with 3 core URLs: `/`, `/login`, `/register`
- Future: auto-generate from SolidStart routes

---

## Verification

| Check | How |
|-------|-----|
| Meta tags visible | View page source → check `<title>`, `<meta>` |
| OG tags work | Paste URL into https://opengraph.xyz |
| robots.txt | `curl https://.../robots.txt` |
| sitemap.xml | `curl https://.../sitemap.xml` |
| Google index | Submit sitemap to [Google Search Console](https://search.google.com/search-console) |

---

## Future Enhancements

- Dynamic `<title>` per route (e.g., note title)
- Auto-generated sitemap from route manifest
- Structured data (JSON-LD) for rich snippets
- Open Graph image generation (OG image with app logo + text)
- PageSpeed / Core Web Vitals optimization (Lighthouse audit)
