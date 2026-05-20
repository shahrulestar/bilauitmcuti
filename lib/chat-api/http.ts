export function getRequestCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(`${name}=`)) {
      return trimmed.slice(name.length + 1);
    }
  }
  return undefined;
}

export function jsonResponse(
  data: unknown,
  status = 200,
  extraHeaders?: HeadersInit
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...extraHeaders,
    },
  });
}

export function withChatVerifiedCookie(
  response: Response,
  shouldSet: boolean,
  maxAgeSeconds: number,
  cookieName: string
): Response {
  if (!shouldSet) return response;
  const headers = new Headers(response.headers);
  headers.append(
    "Set-Cookie",
    `${cookieName}=1; Max-Age=${maxAgeSeconds}; Path=/; SameSite=Lax; HttpOnly=false${
      process.env.NODE_ENV === "production" ? "; Secure" : ""
    }`
  );
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
