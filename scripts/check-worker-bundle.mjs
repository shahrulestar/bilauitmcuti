/**
 * Fail CI/local checks when the OpenNext Worker gzip size is near Cloudflare's 3 MiB limit.
 * Cloudflare counts gzip-compressed upload size (see opennext.js.org/cloudflare).
 */
import { existsSync, readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";

const WORKER_PATH = join(process.cwd(), ".open-next", "worker.js");
/** Cloudflare Workers free plan limit (gzip). */
const CLOUDFLARE_LIMIT_KIB = 3 * 1024;
/** Fail before the limit so deploys keep headroom. */
const CI_FAIL_KIB = Number(process.env.WORKER_GZIP_FAIL_KIB ?? 2850);

function formatKiB(bytes) {
  return (bytes / 1024).toFixed(1);
}

if (!existsSync(WORKER_PATH)) {
  console.error(
    `Missing ${WORKER_PATH}. Run: pnpm build && pnpm run build:cf`
  );
  process.exit(1);
}

const raw = readFileSync(WORKER_PATH);
const gzip = gzipSync(raw);
const rawKiB = raw.length / 1024;
const gzipKiB = gzip.length / 1024;

console.log(`Worker bundle: ${formatKiB(raw.length)} KiB raw, ${formatKiB(gzip.length)} KiB gzip`);
console.log(
  `Limits: CI fails at ${CI_FAIL_KIB} KiB gzip; Cloudflare rejects above ${CLOUDFLARE_LIMIT_KIB} KiB gzip`
);

if (gzipKiB > CI_FAIL_KIB) {
  console.error(
    `\nWorker gzip (${formatKiB(gzip.length)} KiB) exceeds safe limit (${CI_FAIL_KIB} KiB).`
  );
  console.error(
    "Reduce server bundle size before deploy. See .cursor/rules/cloudflare-worker-size.mdc"
  );
  process.exit(1);
}

console.log("Worker bundle size OK.");
