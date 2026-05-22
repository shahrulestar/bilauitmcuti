export interface TelegramEnv {
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_CHAT_ID: string;
}

export async function checkEnv(): Promise<{ ok: boolean; ai: "configured" | "missing" }> {
  try {
    const { getOptionalRequestContext } = await import("@cloudflare/next-on-pages");
    const ctx = getOptionalRequestContext();
    const ai = (ctx?.env as CloudflareEnv | undefined)?.AI;
    if (ai) return { ok: true, ai: "configured" };
  } catch {
    // No Cloudflare context (next dev without platform, etc.)
  }
  return { ok: false, ai: "missing" };
}

let _telegramEnv: TelegramEnv | null = null;

export function getTelegramEnv(): TelegramEnv {
  if (_telegramEnv) return _telegramEnv;
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (!token) throw new Error("Telegram env validation failed: TELEGRAM_BOT_TOKEN is required");
  if (!chatId) throw new Error("Telegram env validation failed: TELEGRAM_CHAT_ID is required");
  _telegramEnv = { TELEGRAM_BOT_TOKEN: token, TELEGRAM_CHAT_ID: chatId };
  return _telegramEnv;
}
