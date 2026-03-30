export interface TurnstileSiteVerifyResponse {
  success: boolean;
  "error-codes"?: string[];
  hostname?: string;
  action?: string;
  challenge_ts?: string;
  cdata?: Record<string, unknown>;
}

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function verifyTurnstileToken(params: {
  token: string;
  expectedAction?: string;
  expectedHostname?: string;
  secretKey?: string;
}): Promise<TurnstileSiteVerifyResponse> {
  const secretKey = params.secretKey ?? process.env.TURNSTILE_SECRET_KEY;
  if (!secretKey) throw new Error("Missing TURNSTILE_SECRET_KEY env var");

  const form = new URLSearchParams({
    secret: secretKey,
    response: params.token,
  });

  const res = await fetch(TURNSTILE_VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
  });

  const data = (await res.json()) as TurnstileSiteVerifyResponse;
  if (!data.success) return data;

  if (params.expectedAction && data.action && data.action !== params.expectedAction) {
    return { ...data, success: false, "error-codes": ["invalid-action"] };
  }

  if (params.expectedHostname && data.hostname && data.hostname !== params.expectedHostname) {
    return { ...data, success: false, "error-codes": ["invalid-hostname"] };
  }

  return data;
}

