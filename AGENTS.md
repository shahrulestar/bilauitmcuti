# Cloud Agent Onboarding

Instructions for AI agents and cloud deployment tooling.

## Setup (minimal, idempotent)

```bash
pnpm install
```

## Required Environment

- `GROQ_API_KEY` — required for chat feature. Add to `.env.local` for local dev; set as secret in Cloudflare for production.

## Optional Environment

- `CALENDAR_API_BASE` — optional server-only override for the calendar API origin (default `https://api.bilauitmcuti.com`). Do not use `NEXT_PUBLIC_*` for this: the upstream URL must not be embedded in client bundles.

**Browser vs server:** The calendar UI calls **`/api/v1/meta`** and **`/api/v1/calendar`** (same origin); legacy **`/api/calendar-proxy/v1/...`** still works. CSP `connect-src` allows `'self'` only for calendar traffic (not the upstream host). The proxy allowlists those paths and forwards to `CALENDAR_API_BASE`. Chat and other server code call the upstream URL directly.

## Commands

| Command | Purpose |
|---------|---------|
| `pnpm install` | Install dependencies |
| `pnpm lint` | Run ESLint |
| `pnpm typecheck` | Run TypeScript check |
| `pnpm build` | Next.js production build (`next build`; used by Cloudflare Next.js preset) |
| `pnpm build:cf` | OpenNext Worker bundle after `pnpm build` (`.open-next/`; runs on `wrangler deploy`) |
| `pnpm dev` | Development server (localhost:3000) |
| `pnpm preview` | Build + local Cloudflare preview |
| `pnpm deploy` | Build + deploy to Cloudflare |

## CI

GitHub Actions workflow (`.github/workflows/ci.yml`) runs on push/PR:

1. `pnpm install --frozen-lockfile`
2. `pnpm lint`
3. `pnpm typecheck`
4. `pnpm build && pnpm run build:cf` (requires `GROQ_API_KEY` secret or placeholder)

## Health & Readiness

- `GET /api/health` — returns `{ status, groq }`. 503 if GROQ is not configured.
- `GET /api/version` — returns build ID.

## Known Limitations

- Chat rate limiting uses in-memory storage when no Worker KV binding `RATE_LIMIT_KV` is configured (current default). For distributed limits across Cloudflare edges, add a KV namespace binding in `wrangler.jsonc` and the existing [`lib/rate-limit.ts`](lib/rate-limit.ts) path will use it automatically.
- Middleware deprecation warning: Next.js 16 recommends "proxy" over "middleware" — non-blocking.
