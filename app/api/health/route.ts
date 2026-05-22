export const runtime = 'edge';
export const dynamic = "force-dynamic";

export async function GET() {
  const { checkEnv } = await import("@/lib/env");
  const { ai } = await checkEnv();
  const checks: Record<string, string> = {
    status: "ok",
    timestamp: new Date().toISOString(),
    ai,
  };

  const healthy = ai !== "missing";
  return Response.json(checks, {
    status: healthy ? 200 : 503,
    headers: { "Cache-Control": "no-cache, no-store, must-revalidate" },
  });
}
