export const dynamic = "force-dynamic";

export async function GET() {
  const { checkEnv } = await import("@/lib/env");
  const { groq } = checkEnv();
  const checks: Record<string, string> = {
    status: "ok",
    timestamp: new Date().toISOString(),
    groq,
  };

  const healthy = groq !== "missing";
  return Response.json(checks, {
    status: healthy ? 200 : 503,
    headers: { "Cache-Control": "no-cache, no-store, must-revalidate" },
  });
}
