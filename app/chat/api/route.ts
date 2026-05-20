import { getCloudflareContextSync } from "@/lib/cloudflare-context";

export const runtime = "edge";

export async function POST(request: Request) {
  const chatApi = getCloudflareContextSync()?.env?.CHAT_API;
  if (chatApi?.fetch) {
    return chatApi.fetch(request);
  }

  return Response.json(
    {
      error:
        "Chat API worker is not bound. Run pnpm preview/deploy or configure the CHAT_API service binding.",
    },
    { status: 503 }
  );
}
