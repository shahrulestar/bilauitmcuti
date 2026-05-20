/** Matches OpenNext worker template — avoid runtime import of @opennextjs/cloudflare. */
const CLOUDFLARE_CONTEXT_SYMBOL = Symbol.for("__cloudflare-context__");

export interface CloudflareEnvBindings {
  RATE_LIMIT_KV?: {
    get: (key: string) => Promise<string | null>;
    put: (key: string, value: string) => Promise<void>;
  };
  CHAT_API?: {
    fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  };
  GROQ_API_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  CALENDAR_API_BASE?: string;
  [key: string]: unknown;
}

interface CloudflareContext {
  env: CloudflareEnvBindings;
  cf?: unknown;
  ctx?: unknown;
}

export function getCloudflareContextSync(): CloudflareContext | undefined {
  return (globalThis as Record<symbol, CloudflareContext | undefined>)[
    CLOUDFLARE_CONTEXT_SYMBOL
  ];
}

export function applyWorkerEnv(env: CloudflareEnvBindings): void {
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === "string" && value.length > 0) {
      process.env[key] = value;
    }
  }
}
