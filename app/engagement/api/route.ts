export const runtime = 'edge';
import { NextRequest, NextResponse } from "next/server";
import { buildEngagementNotificationEmbed, sendDiscordWebhook } from "@/lib/discord-webhook";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { jsonError, getClientIp, formatNotificationTime } from "@/lib/api-response";


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
    const limitResult = checkRateLimit(ip, request);
    if (limitResult.limited) return jsonError(limitResult.message, 429);

    const rawBody = await request.json();
    if (JSON.stringify(rawBody).length > MAX_BODY_SIZE_BYTES) {
      return jsonError("Request body too large", 413);
    }

    const parsed = parseRatingRequest(rawBody);
    if (!parsed.success) return jsonError("Invalid rating value.", 400);

    const embed = buildEngagementNotificationEmbed({
      rating: parsed.data.rating,
      time: formatNotificationTime(new Date()),
    });
    await sendDiscordWebhook({ kind: "rate_feedback", embeds: [embed] });

    return NextResponse.json({ message: "Thanks for your rating!" });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error("Engagement rating API error", { correlationId, errMsg });
    return jsonError("Failed to submit your rating. Please try again.", 500);
  }
}
