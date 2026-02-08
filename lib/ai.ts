import { HfInference } from "@huggingface/inference";

if (!process.env.HF_API_KEY) {
  throw new Error(
    "HF_API_KEY environment variable is not set. Please add it to your .env.local file."
  );
}

const hf = new HfInference(process.env.HF_API_KEY);

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function askLlama(
  prompt: string,
  systemPrompt?: string,
  history?: ChatMessage[]
) {
  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [];

  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }

  // Include conversation history for context (limit to last 10 exchanges to stay within token limits)
  if (history && history.length > 0) {
    const recentHistory = history.slice(-20); // last 20 messages (up to 10 exchanges)
    for (const msg of recentHistory) {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  messages.push({ role: "user", content: prompt });

  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await hf.chatCompletion({
        model: "meta-llama/Llama-3.1-8B-Instruct",
        messages,
        max_tokens: 2048,
      });

      const content = response?.choices?.[0]?.message?.content;

      if (!content) {
        return "Sorry, I could not generate a response. Please try again.";
      }

      return content;
    } catch (error: unknown) {
      lastError = error;
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`HF API attempt ${attempt + 1}/${MAX_RETRIES} failed:`, errMsg);

      // Don't retry on auth errors (401/403) — these won't resolve with retries
      if (errMsg.includes("401") || errMsg.includes("403") || errMsg.includes("Unauthorized") || errMsg.includes("Forbidden")) {
        throw error;
      }

      // Wait with exponential backoff before retrying (model loading / 503 / rate limit)
      if (attempt < MAX_RETRIES - 1) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        console.log(`Retrying in ${delay}ms...`);
        await sleep(delay);
      }
    }
  }

  // All retries exhausted
  throw lastError;
}
