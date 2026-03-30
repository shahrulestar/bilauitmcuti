# Bila UiTM Cuti?

Academic calendar web app for Universiti Teknologi MARA (UiTM) — Malaysia's largest public university. Built to help students quickly check semester dates, breaks, exams, and registration deadlines.

**Live:** [bilauitmcuti.com](https://bilauitmcuti.com)

## Features

### Academic Calendar
- Grid and list views for the 2026 academic calendar
- Program-specific schedules: Foundation, Pre-Diploma, Diploma, Bachelor's, Master's, PhD
- Group A (Dec 2025 – May 2026) and Group B (Mar – Aug 2026)
- Regional date variations for Kedah, Kelantan, and Terengganu (Friday–Saturday weekend states)
- Filter by event type: registration, lectures, exams, breaks
- Countdown to next activity
- Calendar catalogue and session data load via **same-origin** API routes (see below); the upstream origin is not exposed to the browser bundle

### AI Chat Assistant
- Ask about academic dates, breaks, and exams in English or Malay
- General UiTM info: campuses, faculties, programs, admission
- Context-aware answers based on selected program
- Powered by Groq (Llama 3.1 8B)
- Rate limited: 10/min, 30/day per IP, 500/day global

### Progressive Web App
- Installable on mobile and desktop
- Offline-capable via service worker
- Dark and light theme with system detection

### Contact & sponsor
- **Contact** (`/contact`): feedback form; optional email; submissions are sent to Telegram when `TELEGRAM_*` is configured; protected by Cloudflare Turnstile
- **Sponsor** (`/sponsor`): sponsorship form with optional nickname or anonymous mode, social platform + handle/URL, message, proof-of-payment upload (image or PDF), and Turnstile; a **Show payment QR** control reveals the static QR image at `public/sponsor-qr.png` (replace this file with your real QR). Submissions use the **same** Telegram bot token and chat ID as the contact form (`sendMessage` summary + `sendPhoto` or `sendDocument` for the proof file)

## Tech Stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript
- **Styling:** Tailwind CSS 4, shadcn/ui, Radix UI
- **Scrolling:** Lenis (smooth wheel / touch sync on calendar routes; chat route uses native scroll)
- **AI:** Groq SDK (llama-3.1-8b-instant)
- **Calendar UI:** react-day-picker, date-fns
- **Validation:** Zod
- **Deployment:** Cloudflare Workers (OpenNext)

## Getting Started

### Prerequisites

- Node.js 18+
- Groq API key ([console.groq.com](https://console.groq.com))

### Installation

```bash
git clone <your-fork-or-repo-url>
cd bilauitmcuti
pnpm install
```

### Environment Variables

Copy the example file and add your keys:

```bash
cp .env.example .env.local
```

| Variable | Required | Purpose |
|----------|----------|---------|
| `GROQ_API_KEY` | Yes (for chat) | Groq API access; never expose to the client |
| `TELEGRAM_BOT_TOKEN` | Optional | Contact and sponsor form notifications (same bot) |
| `TELEGRAM_CHAT_ID` | Optional | Contact and sponsor form notifications (same chat) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Yes (contact, chat, sponsor in production) | Cloudflare Turnstile site key (public) |
| `TURNSTILE_SECRET_KEY` | Yes (for server verification) | Cloudflare Turnstile secret; never expose to the client |
| `CALENDAR_API_BASE` | Optional | Server-only override for the calendar HTTP API origin (default `https://api.bilauitmcuti.com`). Do **not** use `NEXT_PUBLIC_*` — the browser calls same-origin `/api/v1/...` only. |

Sponsor uploads: max proof file size **10 MB** (see `SPONSOR_MAX_FILE_BYTES` in `lib/sponsor.ts`); allowed types: common image formats and PDF.

Example:

```env
GROQ_API_KEY=your_groq_api_key_here
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
TELEGRAM_CHAT_ID=your_telegram_chat_id_here
NEXT_PUBLIC_TURNSTILE_SITE_KEY=your_turnstile_site_key_here
TURNSTILE_SECRET_KEY=your_turnstile_secret_key_here
# CALENDAR_API_BASE=https://api.bilauitmcuti.com
```

### Development

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### Checks

```bash
pnpm lint        # ESLint
pnpm typecheck   # TypeScript (tsc --noEmit)
```

### Production Build

```bash
pnpm build
pnpm start
```

### Cloudflare Deployment

**Local preview:**

```bash
pnpm preview   # build + local preview
pnpm deploy    # build + deploy (requires wrangler login)
```

**Cloudflare Dashboard (Pages/Workers):** Connect your repo, then set:
- **Build command:** `pnpm run deploy`
- **Environment variables:** `GROQ_API_KEY`, optional Telegram, Turnstile keys (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`), and `CALENDAR_API_BASE` as secrets
- `CLOUDFLARE_API_TOKEN` is auto-injected when connected via Git

**Troubleshooting:**
- If chat fails: ensure `GROQ_API_KEY` is set as a secret in Cloudflare
- Health check: `GET /api/health` returns readiness (503 if GROQ is missing)
- For distributed rate limiting: run `wrangler kv namespace create RATE_LIMIT_KV`, add the binding to `wrangler.jsonc`

## Calendar API (same origin)

The UI requests **`/api/v1/meta`** and **`/api/v1/calendar`** (and the legacy **`/api/calendar-proxy/v1/...`** path). Server routes forward to `CALENDAR_API_BASE` so Content-Security-Policy can keep calendar traffic on `'self'`.

## Project Structure

```
app/
  page.tsx                 # Homepage (grid view)
  layout.tsx               # Root layout, metadata, theme, Lenis (non-chat)
  [program]/               # Dynamic program-specific routes
  chat/
    page.tsx               # AI chat interface
    api/route.ts           # Chat API (rate limiting, validation, AI)
  contact/
    page.tsx               # Contact form (Telegram + Turnstile)
    api/route.ts           # Contact POST handler
  sponsor/
    page.tsx               # Sponsor form (QR, proof upload, Telegram + Turnstile)
    api/route.ts           # Sponsor multipart POST handler
  list/                    # List view page
  api/
    health/route.ts        # Health/readiness
    version/route.ts       # Build info
    v1/meta/route.ts       # Calendar meta (proxied)
    v1/calendar/route.ts   # Calendar sessions (proxied)
    calendar-proxy/[...path]/route.ts  # Legacy proxy path
components/
  ui/                      # shadcn/ui components
  shared-calendar-layout.tsx
  calendar-wrapper.tsx
  calendar-header.tsx
  grid-view.tsx            # Grid calendar (scroll-aware hover/tooltips)
  list-view.tsx
  theme-toggle.tsx
lib/
  ai.ts                    # Groq AI integration
  data.ts                  # Academic calendar logic (activities, dates)
  calendar-api.ts          # Client fetch helpers (same-origin)
  calendar-store.ts        # Client calendar session store
  env.ts                   # Centralized env validation
  rate-limit.ts            # Rate limiting (KV or in-memory fallback)
  logger.ts
  uitm-info.ts
  cookie-utils.ts          # Filter persistence
  system-rules.json        # AI system prompts
public/
  manifest.json            # PWA manifest
  sw.js                    # Service worker
  sponsor-qr.png           # Placeholder payment QR for /sponsor (replace with your asset)
```

## CI

GitHub Actions (`.github/workflows/ci.yml`) on push/PR: `pnpm install --frozen-lockfile` → `pnpm lint` → `pnpm typecheck` → `pnpm build` (needs `GROQ_API_KEY` in CI or a placeholder).

## Rate Limits

The AI chat feature has three layers of protection:

| Layer | Limit | Reset |
|---|---|---|
| Per IP / minute | 10 requests | Rolling 60-second window |
| Per IP / day | 30 requests | Rolling 24-hour window |
| Global / day | 500 requests | Rolling 24-hour window |

## License

All rights reserved.
