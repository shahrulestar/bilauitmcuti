import type { NextRequest } from "next/server";
import { getCloudflareContextSync } from "@/lib/cloudflare-context";

const RATE_LIMIT_DAILY_MS = 24 * 60 * 60 * 1000;
const RATE_LIMIT_MAX_PER_DAY = 120;
const RATE_LIMIT_MAX_UNKNOWN_PER_DAY = 60;
/** All users combined, per rolling 24h (abuse / cost ceiling). */
const RATE_LIMIT_GLOBAL_MAX_PER_DAY = 5000;
const KV_PREFIX = "rl:";
const KV_GLOBAL_KEY = "rl:global";

type RequestLike = Pick<NextRequest, "headers"> | Request;

export interface RateLimitResult {
  limited: boolean;
  message: string;
}

export function getRateLimitKey(ip: string, request: RequestLike): string {
  if (ip !== "unknown") return ip;
  const ua = request.headers.get("user-agent") ?? "";
  const lang = request.headers.get("accept-language") ?? "";
  const raw = (ua + lang).replace(/\s/g, "").slice(0, 48);
  try {
    return `unknown:${btoa(encodeURIComponent(raw)).slice(0, 32)}`;
  } catch {
    return `unknown:${raw.slice(0, 32)}`;
  }
}

/** In-memory fallback when KV is unavailable (next dev, etc.) */
const rateLimitMap = new Map<string, number[]>();
let globalDailyTimestamps: number[] = [];
const CLEANUP_THRESHOLD = 500;

function cleanupStaleEntries(): void {
  const now = Date.now();
  for (const [key, timestamps] of rateLimitMap.entries()) {
    const valid = timestamps.filter((t) => now - t < RATE_LIMIT_DAILY_MS);
    if (valid.length === 0) rateLimitMap.delete(key);
    else rateLimitMap.set(key, valid);
  }
  globalDailyTimestamps = globalDailyTimestamps.filter((t) => now - t < RATE_LIMIT_DAILY_MS);
}

export function checkRateLimitMemory(ip: string, request: RequestLike): RateLimitResult {
  const now = Date.now();
  if (rateLimitMap.size > CLEANUP_THRESHOLD) cleanupStaleEntries();

  const globalValid = globalDailyTimestamps.filter((t) => now - t < RATE_LIMIT_DAILY_MS);
  if (globalValid.length >= RATE_LIMIT_GLOBAL_MAX_PER_DAY) {
    return { limited: true, message: "Service is at capacity for today. Please try again tomorrow." };
  }

  const key = getRateLimitKey(ip, request);
  const isUnknown = ip === "unknown";
  const timestamps = rateLimitMap.get(key) || [];
  const dailyValid = timestamps.filter((t) => now - t < RATE_LIMIT_DAILY_MS);
  const maxDaily = isUnknown ? RATE_LIMIT_MAX_UNKNOWN_PER_DAY : RATE_LIMIT_MAX_PER_DAY;
  if (dailyValid.length >= maxDaily) {
    return { limited: true, message: "Daily limit reached. Please try again tomorrow." };
  }

  dailyValid.push(now);
  rateLimitMap.set(key, dailyValid);
  globalDailyTimestamps = [...globalValid, now];
  return { limited: false, message: "" };
}

type KVNamespace = { get: (k: string) => Promise<string | null>; put: (k: string, v: string) => Promise<void> };

export async function checkRateLimitKV(
  ip: string,
  request: RequestLike,
  kv: KVNamespace
): Promise<RateLimitResult> {
  const now = Date.now();
  const key = getRateLimitKey(ip, request);
  const isUnknown = ip === "unknown";

  const [ipRaw, globalRaw] = await Promise.all([
    kv.get(`${KV_PREFIX}${key}`),
    kv.get(KV_GLOBAL_KEY),
  ]);

  const parse = (s: string | null): number[] => {
    if (!s) return [];
    try {
      const arr = JSON.parse(s) as unknown;
      return Array.isArray(arr) ? arr.filter((n): n is number => typeof n === "number") : [];
    } catch {
      return [];
    }
  };

  const globalTimestamps = parse(globalRaw);
  const globalValid = globalTimestamps.filter((t) => now - t < RATE_LIMIT_DAILY_MS);
  if (globalValid.length >= RATE_LIMIT_GLOBAL_MAX_PER_DAY) {
    return { limited: true, message: "Service is at capacity for today. Please try again tomorrow." };
  }

  const timestamps = parse(ipRaw);
  const dailyValid = timestamps.filter((t) => now - t < RATE_LIMIT_DAILY_MS);
  const maxDaily = isUnknown ? RATE_LIMIT_MAX_UNKNOWN_PER_DAY : RATE_LIMIT_MAX_PER_DAY;
  if (dailyValid.length >= maxDaily) {
    return { limited: true, message: "Daily limit reached. Please try again tomorrow." };
  }

  const updated = [...dailyValid, now];
  const globalUpdated = [...globalValid, now];
  await Promise.all([
    kv.put(`${KV_PREFIX}${key}`, JSON.stringify(updated)),
    kv.put(KV_GLOBAL_KEY, JSON.stringify(globalUpdated)),
  ]);
  return { limited: false, message: "" };
}

/** Uses KV when available (Cloudflare), otherwise in-memory. */
export async function checkRateLimit(ip: string, request: RequestLike): Promise<RateLimitResult> {
  const ctx = getCloudflareContextSync();
  const kv = ctx?.env?.RATE_LIMIT_KV;
  if (kv) return await checkRateLimitKV(ip, request, kv);
  return checkRateLimitMemory(ip, request);
}
