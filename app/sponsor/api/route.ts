import { NextRequest, NextResponse } from "next/server";
import { getTelegramEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  SPONSOR_MAX_FILE_BYTES,
  SPONSOR_MAX_MESSAGE_LENGTH,
  SPONSOR_SOCIAL_OPTIONS,
  SPONSOR_TURNSTILE_ACTION,
} from "@/lib/sponsor";
import {
  getClientIpForTurnstile,
  getTurnstileExpectedHostname,
  verifyTurnstileToken,
} from "@/lib/turnstile";


const MIN_SUBMIT_TIME_MS = 3000;
const SPONSOR_TURNSTILE_COOKIE = "sponsor_turnstile_verified";
const SPONSOR_TURNSTILE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 12;

const ALLOWED_PROOF_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
]);

const SOCIAL_SET = new Set<string>(SPONSOR_SOCIAL_OPTIONS);

interface SponsorFields {
  anonymous: "true" | "false";
  nickname?: string;
  socialPlatform: string;
  socialHandle: string;
  message: string;
  turnstileToken?: string;
  startedAt: number;
  website?: string;
}

function parseSponsorFields(raw: Record<string, unknown>): { success: true; data: SponsorFields } | { success: false; error: string } {
  const anonymous = raw.anonymous;
  if (anonymous !== "true" && anonymous !== "false") return { success: false, error: "Invalid form values." };
  const message = String(raw.message ?? "");
  if (message.length < 1 || message.length > SPONSOR_MAX_MESSAGE_LENGTH) return { success: false, error: "Invalid form values." };
  const socialHandle = String(raw.socialHandle ?? "");
  if (socialHandle.length > 500) return { success: false, error: "Invalid form values." };
  const startedAt = Number(raw.startedAt);
  if (!Number.isFinite(startedAt) || !Number.isInteger(startedAt) || startedAt <= 0) return { success: false, error: "Invalid form values." };

  const nickname = raw.nickname != null ? String(raw.nickname) : undefined;
  const socialPlatform = String(raw.socialPlatform ?? "");
  const turnstileToken = raw.turnstileToken != null && String(raw.turnstileToken).trim().length > 0
    ? String(raw.turnstileToken) : undefined;
  const website = raw.website != null ? String(raw.website) : undefined;

  if (anonymous === "false") {
    if ((nickname?.trim() ?? "").length === 0) return { success: false, error: "Nickname is required unless anonymous." };
    if (!SOCIAL_SET.has(socialPlatform)) return { success: false, error: "Select a social platform." };
    if (socialHandle.trim().length === 0) return { success: false, error: "URL or username is required." };
  }

  return { success: true, data: { anonymous, nickname, socialPlatform, socialHandle, message, turnstileToken, startedAt, website } };
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

function buildSponsorTelegramText(params: {
  anonymous: boolean;
  nickname: string;
  socialPlatform: string;
  socialHandle: string;
  message: string;
  ip: string;
  userAgent: string;
  fileName: string;
  mimeType: string;
}): string {
  const now = new Date().toISOString();
  const nameLine = params.anonymous
    ? "Name: Anonymous"
    : `Nickname: ${params.nickname.trim()}`;
  const socialLine = params.anonymous
    ? "Social: (not provided — anonymous submission)"
    : `Social: ${params.socialPlatform} — ${params.socialHandle.trim()}`;
  return [
    "New Sponsor Submission",
    `Time: ${now}`,
    nameLine,
    socialLine,
    `IP: ${params.ip}`,
    `User Agent: ${params.userAgent || "unknown"}`,
    `Proof file: ${params.fileName} (${params.mimeType})`,
    "",
    "Message:",
    params.message.trim(),
  ].join("\n");
}

async function sendTelegramMessage(text: string) {
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
    throw new Error(`Telegram sendMessage failed (${response.status}): ${detail.slice(0, 200)}`);
  }
}

async function sendTelegramProof(params: {
  file: File;
  caption: string;
}) {
  const { TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = getTelegramEnv();
  const isImage = params.file.type.startsWith("image/");
  const method = isImage ? "sendPhoto" : "sendDocument";
  const endpoint = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`;

  const form = new FormData();
  form.append("chat_id", TELEGRAM_CHAT_ID);
  const safeCaption =
    params.caption.length > 1000 ? params.caption.slice(0, 997) + "..." : params.caption;
  form.append("caption", safeCaption);

  if (isImage) {
    form.append("photo", params.file, params.file.name || "proof.jpg");
  } else {
    form.append("document", params.file, params.file.name || "proof.pdf");
  }

  const response = await fetch(endpoint, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Telegram ${method} failed (${response.status}): ${detail.slice(0, 200)}`);
  }
}

export async function POST(request: NextRequest) {
  const correlationId = `sponsor-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  let shouldSetVerifiedCookie = false;
  const withVerifiedCookie = (response: NextResponse): NextResponse => {
    if (!shouldSetVerifiedCookie) return response;
    response.cookies.set({
      name: SPONSOR_TURNSTILE_COOKIE,
      value: "1",
      maxAge: SPONSOR_TURNSTILE_COOKIE_MAX_AGE_SECONDS,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      httpOnly: false,
    });
    return response;
  };
  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return jsonError("Content-Type must be multipart/form-data", 415);
    }

    const ip = getClientIp(request);
    const limitResult = await checkRateLimit(ip, request);
    if (limitResult.limited) return jsonError(limitResult.message, 429);

    const formData = await request.formData();

    const proof = formData.get("proof");
    if (!(proof instanceof File)) {
      return jsonError("Proof of payment file is required.", 400);
    }
    if (proof.size > SPONSOR_MAX_FILE_BYTES) {
      return jsonError(`File too large. Maximum size is ${SPONSOR_MAX_FILE_BYTES / (1024 * 1024)} MB.`, 413);
    }
    if (!ALLOWED_PROOF_TYPES.has(proof.type)) {
      return jsonError("Unsupported file type. Please upload an image (JPEG, PNG, GIF, WebP) or PDF.", 400);
    }

    const raw = {
      anonymous: String(formData.get("anonymous") ?? ""),
      nickname: formData.get("nickname") != null ? String(formData.get("nickname")) : undefined,
      socialPlatform: String(formData.get("socialPlatform") ?? ""),
      socialHandle: String(formData.get("socialHandle") ?? ""),
      message: String(formData.get("message") ?? ""),
      turnstileToken: String(formData.get("turnstileToken") ?? ""),
      startedAt: formData.get("startedAt"),
      website: formData.get("website") != null ? String(formData.get("website")) : undefined,
    };

    const parsed = parseSponsorFields(raw);
    if (!parsed.success) {
      return jsonError(parsed.error, 400);
    }

    const data = parsed.data;

    if ((data.website ?? "").trim().length > 0) {
      return NextResponse.json({ message: "Thanks! Your submission was received." });
    }

    if (Date.now() - data.startedAt < MIN_SUBMIT_TIME_MS) {
      return jsonError("Please take a moment before submitting the form.", 429);
    }

    const isTurnstileRequired = process.env.NODE_ENV === "production";
    const hasVerifiedCookie =
      request.cookies.get(SPONSOR_TURNSTILE_COOKIE)?.value === "1";
    if (isTurnstileRequired && !hasVerifiedCookie) {
      const token = (data.turnstileToken ?? "").trim();
      if (!token) {
        return jsonError("Please complete verification first.", 403);
      }
      const hostname = request.headers.get("host") ?? "";
      const turnstileResult = await verifyTurnstileToken({
        token,
        expectedAction: SPONSOR_TURNSTILE_ACTION,
        expectedHostname: getTurnstileExpectedHostname(hostname),
        remoteip: getClientIpForTurnstile(request),
      });
      if (!turnstileResult.success) {
        return jsonError("Access was blocked. Please complete the challenge and try again.", 403);
      }
      shouldSetVerifiedCookie = true;
    }

    const anonymous = data.anonymous === "true";
    const nickname = anonymous ? "" : (data.nickname ?? "").trim();
    const userAgent = request.headers.get("user-agent") ?? "unknown";

    const summary = buildSponsorTelegramText({
      anonymous,
      nickname,
      socialPlatform: data.socialPlatform,
      socialHandle: data.socialHandle,
      message: data.message,
      ip,
      userAgent,
      fileName: proof.name || "proof",
      mimeType: proof.type || "unknown",
    });

    await sendTelegramMessage(summary);
    await sendTelegramProof({
      file: proof,
      caption: `Sponsor proof — ${anonymous ? "Anonymous" : nickname || "—"}`,
    });

    return withVerifiedCookie(NextResponse.json({ message: "Thanks! Your sponsorship details were submitted." }));
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error("Sponsor API error", { correlationId, errMsg });
    return withVerifiedCookie(jsonError("Failed to submit your form. Please try again.", 500));
  }
}
