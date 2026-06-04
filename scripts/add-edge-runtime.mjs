/**
 * Add edge runtime to routes required by @cloudflare/next-on-pages (Cloudflare Pages).
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const EDGE = "export const runtime = 'edge';\n";
const EDGE_PATTERN = /^export const runtime = ['"]edge['"];?\r?\n/m;

const ROUTE_FILES = [
  "app/page.tsx",
  "app/list/page.tsx",
  "app/[program]/page.tsx",
  "app/[program]/list/page.tsx",
  "app/api/calendar-proxy/[...path]/route.ts",
  "app/api/health/route.ts",
  "app/api/v1/calendar/route.ts",
  "app/api/v1/lecture-weeks/route.ts",
  "app/api/v1/meta/route.ts",
  "app/api/version/route.ts",
  "app/chat/api/route.ts",
  "app/contact/api/route.ts",
  "app/engagement/api/route.ts",
  "app/feedback/api/route.ts",
];

for (const rel of ROUTE_FILES) {
  const path = join(process.cwd(), rel);
  let source = readFileSync(path, "utf8");
  if (EDGE_PATTERN.test(source)) {
    console.log("already has edge:", rel);
    continue;
  }
  source = EDGE + source;
  writeFileSync(path, source);
  console.log("added edge runtime:", rel);
}
