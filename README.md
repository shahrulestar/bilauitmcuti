![Bila UiTM Cuti? — academic calendar for UiTM](public/all-cover.png)

# Bila UiTM Cuti?

Academic calendar for **Universiti Teknologi MARA (UiTM)** — check semester dates, breaks, exams, and registration deadlines by program.

**Live:** [bilauitmcuti.com](https://bilauitmcuti.com)

## What you get

| Area | Highlights |
|------|------------|
| **Calendar** | Grid and list views; Foundation through PhD; Group A/B; regional dates (Kedah, Kelantan, Terengganu); filters and countdown |
| **AI chat** | Ask about dates or general UiTM info (English or Malay); Cloudflare Workers AI; rate limits apply |
| **PWA** | Installable, offline-friendly, light/dark theme |
| **Forms** | [Feedback](/feedback) and [Sponsor](/sponsor) with Turnstile; optional Discord webhooks |

Calendar data loads from **same-origin** routes (`/api/v1/meta`, `/api/v1/calendar`) — the upstream API URL stays on the server.

## Tech stack

- Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, shadcn/ui
- **AI:** Cloudflare Workers AI — production: Gemma 4 + Gemini 3.1 Flash Lite backup; local/preview: Llama 3.2 3B
- **Deploy:** Cloudflare Pages (`@cloudflare/next-on-pages`)

## Quick start

**Prerequisites:** Node.js 18+, pnpm, Cloudflare account (Workers AI for chat)

```bash
git clone <your-repo-url>
cd bilauitmcuti
pnpm install
cp .env.example .env.local   # add Turnstile keys if testing forms/chat
npx wrangler login           # once — needed for Workers AI in dev
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

If chat fails with an auth error, run `npx wrangler login` again.

### Useful commands

| Command | Purpose |
|---------|---------|
| `pnpm dev` | Local dev (Workers AI via Wrangler) |
| `pnpm lint` / `pnpm typecheck` | ESLint / TypeScript |
| `pnpm test` | Unit tests (Vitest) |
| `pnpm build:pages` | Build for Cloudflare Pages |
| `pnpm preview` | Build + `wrangler pages dev` (full Pages runtime) |
| `pnpm pages:dev` | Preview last build only (run `build:pages` first) |

## Environment variables

| Variable | Required | Notes |
|----------|----------|--------|
| Workers AI binding `AI` | For chat | Pages → Bindings → Workers AI; local: `pnpm preview` or dev platform |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Production forms/chat | Or `TURNSTILE_SITE_KEY` at runtime (`GET /api/turnstile/config`) |
| `TURNSTILE_SECRET_KEY` | With Turnstile | Server-only |
| `DISCORD_WEBHOOK_*` | Optional | Feedback, sponsor, chat thumbs — server-only, never commit URLs |
| `CALENDAR_API_BASE` | Optional | Default `https://api.bilauitmcuti.com` — server-only, no `NEXT_PUBLIC_*` |
| `CHAT_USE_AGENT` | Optional | Set `1` for tool-calling agent chat instead of full context in prompt |

See [`.env.example`](.env.example) for samples. Sponsor proof uploads: max **10 MB**, images or PDF.

## Deploy to Cloudflare Pages

| Setting | Value |
|---------|--------|
| Build command | `pnpm run build:pages` or `npx @cloudflare/next-on-pages@1` |
| Output directory | `.vercel/output/static` |
| `NODE_VERSION` | `20` (or ≥18) |

After deploy: **Settings → Functions** → enable **`nodejs_compat`** (date ≥ `2022-11-30`). Add binding **Workers AI** named `AI` (production + preview).

- Health: `GET /api/health` (503 if AI binding missing)
- Edge runtime: dynamic routes need `export const runtime = 'edge'` (see `scripts/add-edge-runtime.mjs`)

## Rate limits (24h rolling window)

| Layer | Limit |
|-------|-------|
| Per IP (known) | 120 / day |
| Per IP (unknown) | 60 / day |
| Global | 5000 / day |

Applies to chat, feedback, and sponsor routes.

## CI

On push/PR: install → lint → typecheck → `build:pages` (see [`.github/workflows/ci.yml`](.github/workflows/ci.yml)).

## Project layout (short)

```
app/          # Pages, chat, feedback, sponsor, API routes
components/   # Calendar UI, shadcn components
lib/          # AI, calendar logic, chat pipeline, rate limits
public/       # PWA assets, sponsor-qr.png, all-cover.png
```

For agent/deployment details, see [`AGENTS.md`](AGENTS.md).

## License

All rights reserved.
