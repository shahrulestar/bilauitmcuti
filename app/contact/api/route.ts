import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { CONTACT_CATEGORY_OPTIONS, CONTACT_WHO_OPTIONS } from "@/lib/contact";
import { getTelegramEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import { verifyTurnstileToken } from "@/lib/turnstile";

export const runtime = "edge";

const MAX_BODY_SIZE_BYTES = 10 * 1024;
const MIN_SUBMIT_TIME_MS = 3000;

const contactRequestSchema = z.object({
  who: z.enum(CONTACT_WHO_OPTIONS),
  category: z.enum(CONTACT_CATEGORY_OPTIONS),
  message: z.string().min(1).max(400),
  startedAt: z.number().int().positive(),
  website: z.string().optional(),
  email: z.string().email().optional(),
  turnstileToken: z.string().min(1),
});

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

function buildTelegramText(
  who: string,
  category: string,
  message: string,
  ip: string,
  userAgent: string,
  email?: string
): string {
  const now = new Date().toISOString();
  const trimmedEmail = email?.trim() ?? "";
  const emailLine = trimmedEmail.length > 0 ? `Email: ${trimmedEmail}` : null;
  return [
    "New Contact Form Submission",
    `Time: ${now}`,
    `Who: ${who}`,
    `Category: ${category}`,
    `IP: ${ip}`,
    `User Agent: ${userAgent || "unknown"}`,
    ...(emailLine ? [emailLine] : []),
    "",
    "Message:",
    message,
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
  const correlationId = `contact-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
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
    const bodyStr = JSON.stringify(rawBody);
    if (bodyStr.length > MAX_BODY_SIZE_BYTES) {
      return jsonError("Request body too large", 413);
    }

    const parsed = contactRequestSchema.safeParse(rawBody);
    if (!parsed.success) return jsonError("Invalid form values.", 400);

    const { who, category, message, startedAt, website, email } = parsed.data;

    if ((website ?? "").trim().length > 0) {
      return NextResponse.json({ message: "Thanks! Your message was sent." });
    }

    if (Date.now() - startedAt < MIN_SUBMIT_TIME_MS) {
      return jsonError("Please take a moment before submitting the form.", 429);
    }

    const hostname = request.headers.get("host") ?? "";
    const expectedHostname = "bilauitmcuti.com";
    const hostNormalized = hostname.replace(/^www\./, "").split(":")[0];
    const expectedAction = "contact_form";
    const turnstileResult = await verifyTurnstileToken({
      token: parsed.data.turnstileToken,
      expectedAction,
      expectedHostname: hostNormalized === expectedHostname ? expectedHostname : undefined,
    });
    if (!turnstileResult.success) {
      return jsonError("Access was blocked. Please complete the challenge and try again.", 403);
    }

    const userAgent = request.headers.get("user-agent") ?? "unknown";
    const text = buildTelegramText(who, category, message.trim(), ip, userAgent, email);
    await sendToTelegram(text);

    return NextResponse.json({ message: "Thanks! Your message has been submitted." });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error("Contact API error", { correlationId, errMsg });
    return jsonError("Failed to submit your message. Please try again.", 500);
  }
}
