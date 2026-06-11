# Cloud Agent Onboarding

Instructions for AI agents and cloud deployment tooling.

## Setup (minimal, idempotent)

```bash
pnpm install
```

## Required Environment

- **Workers AI binding** — required for chat. In Cloudflare Pages: Settings → Bindings → Add → **Workers AI** → variable name `AI` (production + preview). Local: `pnpm run preview` after `build:pages`. Also declared in [`wrangler.jsonc`](wrangler.jsonc). No API key secret for inference. **Production** (`bilauitmcuti.com` only): **Gemma 4** (`@cf/google/gemma-4-26b-a4b-it`). **Local + Pages preview** (default): **Llama 3.2 3B** (`@cf/meta/llama-3.2-3b-instruct`). Optional localhost-only Gemma test: `WORKERS_AI_USE_PRODUCTION_MODEL=1`. Overrides: `WORKERS_AI_MODEL`, `WORKERS_AI_USE_DEV_MODEL=1`. See `lib/ai.ts` (`resolveWorkersAiModelTier`, `resolveProductionChatModelChain`).
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` — required for Turnstile on feedback and chat in production. Set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` in **Pages build environment** (inlined into the client bundle), or `TURNSTILE_SITE_KEY` at runtime (client loads via `GET /api/turnstile/config`).

## Optional Environment

- `DISCORD_WEBHOOK_RATE_FEEDBACK` — optional server-only webhook for star rating and feedback form. `DISCORD_WEBHOOK_CHAT_HELPFUL` / `DISCORD_WEBHOOK_CHAT_NOT_HELPFUL` — chat AI thumbs up/down (`POST /chat/feedback/api`). Do not use `NEXT_PUBLIC_*` or commit URLs.
- `CALENDAR_API_BASE` — optional server-only override for the calendar API origin (default `https://api.bilauitmcuti.com`). Do not use `NEXT_PUBLIC_*` for this: the upstream URL must not be embedded in client bundles.
- `CHAT_USE_AGENT` — set to `0` or `false` to disable tool-calling agent globally (legacy full-context path). When enabled (default), production **Gemma** uses the agent loop; dev/preview **Llama** uses compact context fallback. See [`lib/chat/agent/run-agent.ts`](lib/chat/agent/run-agent.ts).
- `AI_GATEWAY_ID` — AI Gateway name for chat inference (default `bilauitmcuti-chat`). Declared in [`wrangler.jsonc`](wrangler.jsonc) `vars` for production + preview (wrangler-managed Pages). Set to `off` to bypass gateway. See [`lib/ai-gateway.ts`](lib/ai-gateway.ts).
- `SKIP_AI_GATEWAY=1` — optional bypass in wrangler `vars` or `.dev.vars`; chat calls Workers AI directly without gateway (useful for `pnpm dev` without a gateway configured).

**Browser vs server:** The calendar UI calls **`/api/v1/meta`** and **`/api/v1/calendar`** (same origin); legacy **`/api/calendar-proxy/v1/...`** still works. CSP `connect-src` allows `'self'` only for calendar traffic (not the upstream host). The proxy allowlists those paths and forwards to `CALENDAR_API_BASE`. Chat and other server code call the upstream URL directly.

**Chat API (`POST /chat/api`):** Hybrid responses — cache hits return JSON `{ reply, correlationId, path }`; LLM calls with `stream: true` (default) return **SSE** (`text/event-stream`) with `token` and `done` events. Thumbs feedback posts to **`POST /chat/feedback/api`** with the assistant `correlationId`. Model is chosen by host: **Gemma** on `bilauitmcuti.com`, **Llama** on localhost / `*.pages.dev`.

**Chat assistant pipeline** ([`lib/chat/handler.ts`](lib/chat/handler.ts)):

- **Topic router** ([`lib/chat/topic-router.ts`](lib/chat/topic-router.ts)) — `academic_calendar` | `lecture_weeks` | `public_holiday` | `uitm_general` (mixed allowed).
- **Activity match** ([`lib/chat/activity-match.ts`](lib/chat/activity-match.ts)) — authoritative rows when the user names an official calendar event.
- **Agent mode** (`CHAT_USE_AGENT=1`, production Gemma) — hybrid tool calling on Workers AI per [Cloudflare function calling](https://developers.cloudflare.com/workers-ai/features/function-calling/). Tools: `search_calendar_activities`, `get_academic_calendar`, `get_lecture_weeks`, `get_public_holidays`, `search_uitm_knowledge`, etc. Topic router narrows exposed tools. Gemma uses OpenAI-style tool JSON; partner `google/*` models use `functionDeclarations` when overridden via `WORKERS_AI_MODEL`.
- **Compact fallback** (dev Llama) — injects compact API-backed context via [`lib/chat/agent/compact-fallback.ts`](lib/chat/agent/compact-fallback.ts) instead of the agent loop.
- **Legacy mode** (`CHAT_USE_AGENT=0`) — preloads `DATA CONTEXT` via [`lib/chat/build-data-context.ts`](lib/chat/build-data-context.ts) and [`lib/chat/chat-prompt.ts`](lib/chat/chat-prompt.ts).
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

**`pnpm dev` lock error:** If startup fails with `Unable to acquire lock at .next/dev/lock`, another `next dev` is running or a stale lock was left behind. Check port 3000, stop the other process, or delete `.next/dev/lock` when nothing is listening on 3000, then rerun `pnpm dev`. Prefer `pnpm dev` over `npm run dev` (this repo uses pnpm).

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

## Cloudflare AI Gateway (chat)

Chat routes all Workers AI calls through **AI Gateway** via the third argument to `env.AI.run()` ([Workers AI binding integration](https://developers.cloudflare.com/ai-gateway/integrations/aig-workers-ai-binding/)). Implementation: [`lib/ai-gateway.ts`](lib/ai-gateway.ts), wired in [`lib/ai.ts`](lib/ai.ts).

**Chat rate limits:** The in-app daily chat limit was removed from [`lib/chat/handler.ts`](lib/chat/handler.ts). Abuse/cost control is delegated to AI Gateway ([rate limiting](https://developers.cloudflare.com/ai-gateway/features/rate-limiting/), [spend limits](https://developers.cloudflare.com/ai-gateway/features/spend-limits/)) and optional zone WAF rules. Contact, engagement, and feedback routes still use [`lib/rate-limit.ts`](lib/rate-limit.ts).

### Dashboard setup (one-time, account-level)

1. **AI → AI Gateway → Create Gateway** — name: `bilauitmcuti-chat` (must match `AI_GATEWAY_ID`).
2. **Settings → Authentication**: **On** (Pages Workers AI binding is authenticated).
3. **Settings → Log collection**: **On** (debug failures, token usage).
4. **Settings → Rate limiting** ([docs](https://developers.cloudflare.com/ai-gateway/features/rate-limiting/)): enable; suggested start **5000 requests / 24 hours**, **sliding window** (replaces old global 5000/day in-app ceiling).
5. **Settings → Spend limits** ([docs](https://developers.cloudflare.com/ai-gateway/features/spend-limits/)): optional monthly USD budget on Workers AI models.
6. **Settings → Caching** ([docs](https://developers.cloudflare.com/ai-gateway/features/caching/)): enable **Cache Responses**, default TTL **120s** (matches in-memory response cache in [`lib/chat/response-cache.ts`](lib/chat/response-cache.ts)).
7. **AI Gateway is not a Pages binding** — it is configured in code (`env.AI.run` third arg) + account dashboard. `AI_GATEWAY_ID` is set in [`wrangler.jsonc`](wrangler.jsonc) (`vars` + `env.preview` / `env.production`); no separate Pages dashboard binding or token required.

**Verify:** send a chat message on production → **AI → AI Gateway → bilauitmcuti-chat → Logs/Analytics**.

**Wrangler-managed Pages:** With `pages_build_output_dir` in `wrangler.jsonc`, Git deploys use this file for bindings and vars. Dashboard bindings UI may be read-only — that is expected.

## Cloudflare WAF (zone, Free plan)

Configure in the dashboard for zone `bilauitmcuti.com`. Docs: [Deploy managed ruleset](https://developers.cloudflare.com/waf/managed-rules/deploy-zone-dashboard/), [Managed rules availability](https://developers.cloudflare.com/waf/managed-rules/).

1. **Security → WAF → Managed rules** — deploy **Cloudflare Free Managed Ruleset**.
2. **Security → WAF → Custom rules** — block Next.js middleware bypass ([CVE-2025-29927](https://developers.cloudflare.com/changelog/product/workers/7/)):
   - Expression: `http.request.headers["x-middleware-subrequest"] exists`
   - Action: **Block**
3. **Optional burst rule** ([rate limiting rules](https://developers.cloudflare.com/waf/rate-limiting-rules/); Free zone max period 10s):
   - Expression: `http.request.uri.path eq "/chat/api" and http.request.method eq "POST"`
   - Characteristics: **IP**
   - Rate: **10 requests / 10 seconds**
   - Action: **Block** (429)
   - Mitigation timeout: 60s

Turnstile + [`middleware.ts`](middleware.ts) bot blocking remain in place for chat.

## Cloudflare Cache Rules (zone)

Docs: [Cache Rules settings](https://developers.cloudflare.com/cache/how-to/cache-rules/settings/). Existing [`public/_headers`](public/_headers) sets `/_next/static/*` to 1 year immutable; zone rules reinforce and extend caching.

Create in **Caching → Cache Rules** (order matters — most specific first):

| # | Name | Expression | Action |
|---|------|------------|--------|
| 1 | `bypass_dynamic` | `(http.request.uri.path starts_with "/api/" or http.request.uri.path starts_with "/chat/")` | **Bypass cache** |
| 2 | `cache_next_static` | `(http.request.uri.path starts_with "/_next/static/")` | Eligible for cache, edge TTL **override 1 year** |
| 3 | `cache_public_assets` | `(http.request.uri.path.extension in {"ico" "png" "webp" "json" "js" "woff" "woff2"})` | Eligible for cache, edge TTL **7 days** |
| 4 | `cache_sw_short` | `(http.request.uri.path eq "/sw.js")` | Eligible for cache, edge TTL **5 minutes** |

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

- In-app rate limiting ([`lib/rate-limit.ts`](lib/rate-limit.ts)) applies to contact, engagement, and feedback routes only; chat uses AI Gateway rate/spend limits at the edge.
- `@cloudflare/next-on-pages` is deprecated in favor of OpenNext; this project intentionally uses next-on-pages for Cloudflare Pages Git deploys.
- Middleware deprecation warning: Next.js 16 recommends "proxy" over "middleware" — non-blocking.
