export const runtime = 'edge';
import { NextRequest, NextResponse } from "next/server";
import { CONTACT_CATEGORY_OPTIONS, CONTACT_WHO_OPTIONS } from "@/lib/contact";
import { buildContactNotificationEmbed, sendDiscordWebhook } from "@/lib/discord-webhook";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  getClientIpForTurnstile,
  getTurnstileExpectedHostname,
  verifyTurnstileToken,
} from "@/lib/turnstile";
import { isTurnstileVerificationRequired } from "@/lib/turnstile-config";
import { jsonError, getClientIp, formatNotificationTime } from "@/lib/api-response";


const MAX_BODY_SIZE_BYTES = 10 * 1024;
const MIN_SUBMIT_TIME_MS = 3000;
const CONTACT_TURNSTILE_COOKIE = "contact_turnstile_verified";
const CONTACT_TURNSTILE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 12;

interface ContactRequest {
  who: string;
  category: string;
  message: string;
  startedAt: number;
  website?: string;
  email?: string;
  turnstileToken?: string;
  rating: number;
}

const WHO_SET = new Set<string>(CONTACT_WHO_OPTIONS);
const CATEGORY_SET = new Set<string>(CONTACT_CATEGORY_OPTIONS);

function parseContactRequest(raw: unknown): { success: true; data: ContactRequest } | { success: false } {
  if (!raw || typeof raw !== "object") return { success: false };
  const o = raw as Record<string, unknown>;
  const who = String(o.who ?? "");
  const category = String(o.category ?? "");
  const message = String(o.message ?? "");
  const startedAt = Number(o.startedAt);
  if (!WHO_SET.has(who)) return { success: false };
  if (!CATEGORY_SET.has(category)) return { success: false };
  if (message.length < 1 || message.length > 400) return { success: false };
  if (!Number.isFinite(startedAt) || startedAt <= 0) return { success: false };
  const website = o.website != null ? String(o.website) : undefined;
  const email = o.email != null ? String(o.email) : undefined;
  const turnstileToken = o.turnstileToken != null && String(o.turnstileToken).trim().length > 0
    ? String(o.turnstileToken) : undefined;
  const parsedRating = Number(o.rating);
  if (!Number.isInteger(parsedRating) || parsedRating < 1 || parsedRating > 5) {
    return { success: false };
  }
  return {
    success: true,
    data: { who, category, message, startedAt, website, email, turnstileToken, rating: parsedRating },
  };
}

export async function POST(request: NextRequest) {
  const correlationId = `contact-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  let shouldSetVerifiedCookie = false;
  const withVerifiedCookie = (response: NextResponse): NextResponse => {
    if (!shouldSetVerifiedCookie) return response;
    response.cookies.set({
      name: CONTACT_TURNSTILE_COOKIE,
      value: "1",
      maxAge: CONTACT_TURNSTILE_COOKIE_MAX_AGE_SECONDS,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      httpOnly: false,
    });
    return response;
  };
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
    const bodyStr = JSON.stringify(rawBody);
    if (bodyStr.length > MAX_BODY_SIZE_BYTES) {
      return jsonError("Request body too large", 413);
    }

    const parsed = parseContactRequest(rawBody);
    if (!parsed.success) return jsonError("Invalid form values.", 400);

    const { who, category, message, startedAt, website, email, rating } = parsed.data;

    if ((website ?? "").trim().length > 0) {
      return NextResponse.json({ message: "Thanks! Your message was sent." });
    }

    if (Date.now() - startedAt < MIN_SUBMIT_TIME_MS) {
      return jsonError("Please take a moment before submitting the form.", 429);
    }

    const isTurnstileRequired = isTurnstileVerificationRequired();
    const hasVerifiedCookie =
      request.cookies.get(CONTACT_TURNSTILE_COOKIE)?.value === "1";
    if (isTurnstileRequired && !hasVerifiedCookie) {
      const token = parsed.data.turnstileToken?.trim() ?? "";
      if (!token) {
        return jsonError("Please complete verification first.", 403);
      }
      const hostname = request.headers.get("host") ?? "";
      const expectedAction = "contact_form";
      const turnstileResult = await verifyTurnstileToken({
        token,
        expectedAction,
        expectedHostname: getTurnstileExpectedHostname(hostname),
        remoteip: getClientIpForTurnstile(request),
      });
      if (!turnstileResult.success) {
        return jsonError("Access was blocked. Please complete the challenge and try again.", 403);
      }
      shouldSetVerifiedCookie = true;
    }

    const embed = buildContactNotificationEmbed({
      who,
      category,
      message: message.trim(),
      rating,
      email,
      time: formatNotificationTime(new Date()),
    });
    await sendDiscordWebhook({ kind: "rate_feedback", embeds: [embed] });

    return withVerifiedCookie(NextResponse.json({ message: "Thanks! Your message has been submitted." }));
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error("Contact API error", { correlationId, errMsg });
    return withVerifiedCookie(jsonError("Failed to submit your message. Please try again.", 500));
  }
}
