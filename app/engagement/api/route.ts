import { NextRequest, NextResponse } from "next/server";
import { getTelegramEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";


const MAX_BODY_SIZE_BYTES = 512;

interface RatingRequest {
  rating: number;
}

function parseRatingRequest(raw: unknown): { success: true; data: RatingRequest } | { success: false } {
  if (!raw || typeof raw !== "object") return { success: false };
  const rating = Number((raw as Record<string, unknown>).rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { success: false };
  return { success: true, data: { rating } };
}

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

function buildTelegramText(rating: number, ip: string, userAgent: string): string {
  const now = new Date().toISOString();
  return [
    "Engagement Prompt Star Rating",
    `Time: ${now}`,
    `Rating: ${rating}/5`,
    `IP: ${ip}`,
    `User Agent: ${userAgent || "unknown"}`,
  ].join("\n");
}

async function sendToTelegram(text: string) {
  const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = getTelegramEnv();
  const endpoint = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text,
      disable_web_page_preview: true,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Telegram API failed (${response.status}): ${detail.slice(0, 200)}`);
  }
}

export async function POST(request: NextRequest) {
  const correlationId = `engagement-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  try {
    const contentType = request.headers.get("content-type");
    if (!contentType?.includes("application/json")) {
      return jsonError("Content-Type must be application/json", 415);
    }

    const contentLength = request.headers.get("content-length");
    if (contentLength && Number.parseInt(contentLength, 10) > MAX_BODY_SIZE_BYTES) {
      return jsonError("Request body too large", 413);
    }

    const ip = getClientIp(request);
    const limitResult = await checkRateLimit(ip, request);
    if (limitResult.limited) return jsonError(limitResult.message, 429);

    const rawBody = await request.json();
    if (JSON.stringify(rawBody).length > MAX_BODY_SIZE_BYTES) {
      return jsonError("Request body too large", 413);
    }

    const parsed = parseRatingRequest(rawBody);
    if (!parsed.success) return jsonError("Invalid rating value.", 400);

    const userAgent = request.headers.get("user-agent") ?? "unknown";
    const text = buildTelegramText(parsed.data.rating, ip, userAgent);
    await sendToTelegram(text);

    return NextResponse.json({ message: "Thanks for your rating!" });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error("Engagement rating API error", { correlationId, errMsg });
    return jsonError("Failed to submit your rating. Please try again.", 500);
  }
}
