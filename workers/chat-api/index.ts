import { handleChatPost } from "../../lib/chat-api/handler";
import { applyWorkerEnv, type CloudflareEnvBindings } from "../../lib/cloudflare-context";

interface Env extends CloudflareEnvBindings {
  GROQ_API_KEY: string;
  TURNSTILE_SECRET_KEY?: string;
  RATE_LIMIT_KV?: CloudflareEnvBindings["RATE_LIMIT_KV"];
}

const chatWorker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    applyWorkerEnv(env);

    const url = new URL(request.url);
    if (request.method === "POST" && (url.pathname === "/chat/api" || url.pathname.endsWith("/chat/api"))) {
      return handleChatPost(request);
    }

    return new Response("Not Found", { status: 404 });
  },
};

export default chatWorker;
