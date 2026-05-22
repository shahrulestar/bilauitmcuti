# Cloud Agent Onboarding

Instructions for AI agents and cloud deployment tooling.

## Setup (minimal, idempotent)

```bash
pnpm install
```

## Required Environment

- **Workers AI binding** — required for chat. In Cloudflare Pages: Settings → Bindings → Add → **Workers AI** → variable name `AI` (production + preview). Local: `pnpm run preview` after `build:pages`. Also declared in [`wrangler.jsonc`](wrangler.jsonc). No API key secret for inference.
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` — required for Turnstile on feedback, sponsor, and chat in production. Set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` in **Pages build environment** (inlined into the client bundle), or `TURNSTILE_SITE_KEY` at runtime (client loads via `GET /api/turnstile/config`).

## Optional Environment

- `CALENDAR_API_BASE` — optional server-only override for the calendar API origin (default `https://api.bilauitmcuti.com`). Do not use `NEXT_PUBLIC_*` for this: the upstream URL must not be embedded in client bundles.

**Browser vs server:** The calendar UI calls **`/api/v1/meta`** and **`/api/v1/calendar`** (same origin); legacy **`/api/calendar-proxy/v1/...`** still works. CSP `connect-src` allows `'self'` only for calendar traffic (not the upstream host). The proxy allowlists those paths and forwards to `CALENDAR_API_BASE`. Chat and other server code call the upstream URL directly.

## Commands

| Command | Purpose |
|---------|---------|
| `pnpm install` | Install dependencies |
| `pnpm lint` | Run ESLint |
| `pnpm typecheck` | Run TypeScript check |
| `pnpm build` | Next.js production build only (`next build`) |
| `pnpm build:pages` | Cloudflare Pages bundle via `@cloudflare/next-on-pages` → `.vercel/output/` |
| `pnpm dev` | Next.js dev server (with Pages bindings via `setupDevPlatform`) |
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

## Known Limitations

- Chat rate limiting uses in-memory storage per isolate (`lib/rate-limit.ts`).
- `@cloudflare/next-on-pages` is deprecated in favor of OpenNext; this project intentionally uses next-on-pages for Cloudflare Pages Git deploys.
- Middleware deprecation warning: Next.js 16 recommends "proxy" over "middleware" — non-blocking.
