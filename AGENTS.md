# Cloud Agent Onboarding

Instructions for AI agents and cloud deployment tooling.

## Setup (minimal, idempotent)

```bash
pnpm install
```

## Required Environment

- **Workers AI binding** — required for chat. In Cloudflare Pages: Settings → Bindings → Add → **Workers AI** → variable name `AI` (production + preview). Local: `pnpm run preview` after `build:pages`. Also declared in [`wrangler.jsonc`](wrangler.jsonc). No API key secret for inference. **Production** (`bilauitmcuti.com` only): **Gemma 4** (`@cf/google/gemma-4-26b-a4b-it`) + backup **Gemini 3.1 Flash Lite** (`google/gemini-3.1-flash-lite`). **Local + Pages preview** (default): **Llama 3.2 3B** (`@cf/meta/llama-3.2-3b-instruct`). Optional localhost-only Gemma test: `WORKERS_AI_USE_PRODUCTION_MODEL=1`. Overrides: `WORKERS_AI_MODEL`, `WORKERS_AI_BACKUP_MODEL`, `WORKERS_AI_USE_DEV_MODEL=1`. See `lib/ai.ts` (`resolveWorkersAiModelTier`, `resolveProductionChatModelChain`).
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` — required for Turnstile on feedback, sponsor, and chat in production. Set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` in **Pages build environment** (inlined into the client bundle), or `TURNSTILE_SITE_KEY` at runtime (client loads via `GET /api/turnstile/config`).

## Optional Environment

- `DISCORD_WEBHOOK_RATE_FEEDBACK` — optional server-only webhook for star rating, feedback form, and sponsor form. `DISCORD_WEBHOOK_CHAT_HELPFUL` / `DISCORD_WEBHOOK_CHAT_NOT_HELPFUL` — chat AI thumbs up/down (`POST /chat/feedback/api`). Do not use `NEXT_PUBLIC_*` or commit URLs.
- `CALENDAR_API_BASE` — optional server-only override for the calendar API origin (default `https://api.bilauitmcuti.com`). Do not use `NEXT_PUBLIC_*` for this: the upstream URL must not be embedded in client bundles.
- `CHAT_USE_AGENT` — set to `1` or `true` to enable tool-calling agent chat (see [`lib/chat/agent/run-agent.ts`](lib/chat/agent/run-agent.ts)).

**Browser vs server:** The calendar UI calls **`/api/v1/meta`** and **`/api/v1/calendar`** (same origin); legacy **`/api/calendar-proxy/v1/...`** still works. CSP `connect-src` allows `'self'` only for calendar traffic (not the upstream host). The proxy allowlists those paths and forwards to `CALENDAR_API_BASE`. Chat and other server code call the upstream URL directly.

**Chat API (`POST /chat/api`):** Hybrid responses — cache hits return JSON `{ reply, correlationId, path }`; LLM calls with `stream: true` (default) return **SSE** (`text/event-stream`) with `token` and `done` events. Thumbs feedback posts to **`POST /chat/feedback/api`** with the assistant `correlationId`.

**Chat assistant pipeline** ([`lib/chat/handler.ts`](lib/chat/handler.ts)):

- **Topic router** ([`lib/chat/topic-router.ts`](lib/chat/topic-router.ts)) — `academic_calendar` | `lecture_weeks` | `public_holiday` | `uitm_general` (mixed allowed).
- **Activity match** ([`lib/chat/activity-match.ts`](lib/chat/activity-match.ts)) — authoritative rows when the user names an official calendar event.
- **Agent mode** (`CHAT_USE_AGENT=1`, [`lib/chat/agent/`](lib/chat/agent/)) — hybrid tool calling on Workers AI (Gemma 4 / Gemini backup). The model calls tools (`search_calendar_activities`, `get_academic_calendar`, `get_lecture_weeks`, `get_public_holidays`, `search_uitm_knowledge`, etc.) instead of receiving full calendar dumps in the system prompt. Topic router narrows which tools are exposed per turn. Dev Llama 3.2 uses **compact context fallback** (same APIs, smaller prompt) when agent is enabled.
- **Legacy mode** (default) — preloads `DATA CONTEXT` via [`lib/chat/build-data-context.ts`](lib/chat/build-data-context.ts) and [`lib/chat/chat-prompt.ts`](lib/chat/chat-prompt.ts).
- Reply validation / completion retry: [`lib/chat/reply-validation.ts`](lib/chat/reply-validation.ts), [`lib/chat/reply-completion.ts`](lib/chat/reply-completion.ts).

## Commands

| Command | Purpose |
|---------|---------|
| `pnpm install` | Install dependencies |
| `pnpm lint` | Run ESLint |
| `pnpm typecheck` | Run TypeScript check |
| `pnpm build` | Next.js production build only (`next build`) |
| `pnpm build:pages` | Cloudflare Pages bundle via `@cloudflare/next-on-pages` → `.vercel/output/` |
| `pnpm dev` | Next.js dev server (Workers AI via `setupDevPlatform`; run `npx wrangler login` if edge-preview auth fails) |
| `pnpm preview` | Build for Pages + `wrangler pages dev` locally |
| `pnpm pages:dev` | Preview last Pages build locally (requires `build:pages` first) |

## CI

GitHub Actions workflow (`.github/workflows/ci.yml`) runs on push/PR:

1. `pnpm install --frozen-lockfile`
2. `pnpm lint`
3. `pnpm typecheck`
4. `pnpm run build:pages`

## Health & Readiness

- `GET /api/health` — returns `{ status, ai }`. 503 if Workers AI binding is not available at runtime.
- `GET /api/version` — returns build ID.

## Cloudflare Pages deployment

Dashboard settings (must match):

| Setting | Value |
|---------|--------|
| Build command | `npx @cloudflare/next-on-pages@1` or `pnpm run build:pages` |
| Build output directory | `.vercel/output/static` |
| `NODE_VERSION` | `20` (or ≥18) |

**Functions compatibility:** In Pages project **Settings → Functions**, enable **`nodejs_compat`** for production and preview; compatibility date ≥ `2022-11-30`.

All dynamic routes must export `export const runtime = 'edge'`. Restore with `node scripts/add-edge-runtime.mjs` if missing.

`wrangler.jsonc` sets `pages_build_output_dir` for Pages + local `wrangler pages dev`. See `.cursor/rules/cloudflare-pages-deploy.mdc`.

**Do not add `account_id` to `wrangler.jsonc`.** Pages rejects it at deploy (`Configuration file for Pages projects does not support "account_id"`). The Pages project already belongs to one Cloudflare account. Local Workers AI (`pnpm dev`, `ai.remote: true`) needs `npx wrangler login` when OAuth is stale (`Authentication error [code: 10000]`) — re-login fixes that; hardcoding `account_id` does not and must not be committed.

## Cloudflare Zaraz + Google Analytics 4

Analytics uses **GA4** (`G-D94Q17TQ22`) delivered through **Cloudflare Zaraz** on the edge — no `gtag.js` in the app bundle. Zaraz auto-injects on proxied `bilauitmcuti.com` traffic.

```
Browser → Zaraz (Cloudflare edge) → Google Analytics 4
```

### Dashboard setup (one-time)

1. Cloudflare dashboard → **Tag setup** (Zaraz) for zone `bilauitmcuti.com`.
2. **Third-party tools** → Add **Google Analytics 4** → Measurement ID `G-D94Q17TQ22` (see `GA_MEASUREMENT_ID` in [`lib/zaraz.ts`](lib/zaraz.ts)).
3. On the GA4 tool, enable automatic actions:
   - **Pageviews** — first page load (and `Pageview` events from [`components/zaraz-page-view.tsx`](components/zaraz-page-view.tsx) on Next.js client navigations).
   - **Events** — forwards all `zaraz.track()` calls (including custom events below) to GA4.
4. **Settings** → leave **Single Page Application support** **off** (the app sends virtual pageviews via `ZarazPageView` instead, to avoid double-counting).
5. Publish Zaraz config. Verify with [Debug mode](https://developers.cloudflare.com/zaraz/web-api/debug-mode/) on production.

### Custom events (app → Zaraz → GA4)

Client code uses [`lib/zaraz.ts`](lib/zaraz.ts) (`trackZarazEvent`, `ZARAZ_EVENTS`). Events are no-ops when Zaraz is absent (local `pnpm dev` without Cloudflare proxy).

| `ZARAZ_EVENTS` key | GA4 event name | When |
|---------------------|----------------|------|
| `pageview` | `Pageview` | Next.js client route change |
| `chatMessageSent` | `chat_message_sent` | Chat reply received |
| `chatFeedback` | `chat_feedback` | Thumbs up/down on assistant reply |
| `engagementPromptShown` | `engagement_prompt_shown` | Engagement prompt opens |
| `engagementRating` | `engagement_rating` | Star rating submitted |
| `engagementShare` | `engagement_share` | Share/copy link from prompt |
| `engagementFeedbackClick` | `engagement_feedback_click` | User taps “Send feedback” in prompt |

With **Events** automatic action enabled on the GA4 tool, these appear in GA4 without extra trigger configuration.

## Known Limitations

- Chat rate limiting uses in-memory storage per isolate (`lib/rate-limit.ts`).
- `@cloudflare/next-on-pages` is deprecated in favor of OpenNext; this project intentionally uses next-on-pages for Cloudflare Pages Git deploys.
- Middleware deprecation warning: Next.js 16 recommends "proxy" over "middleware" — non-blocking.
