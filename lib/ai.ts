import { HfInference } from "@huggingface/inference";

if (!process.env.HF_API_KEY) {
  throw new Error(
    "HF_API_KEY environment variable is not set. Please add it to your .env.local file."
  );
}

const hf = new HfInference(process.env.HF_API_KEY);

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
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

  const response = await hf.chatCompletion({
    model: "meta-llama/Llama-3.1-8B-Instruct",
    messages,
    max_tokens: 500,
  });

  const content = response?.choices?.[0]?.message?.content;

  if (!content) {
    return "Sorry, I could not generate a response. Please try again.";
  }

  return content;
}
