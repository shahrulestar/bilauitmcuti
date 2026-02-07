import { HfInference } from "@huggingface/inference";

if (!process.env.HF_API_KEY) {
  throw new Error(
    "HF_API_KEY environment variable is not set. Please add it to your .env.local file."
  );
}

const hf = new HfInference(process.env.HF_API_KEY);

export async function askLlama(prompt: string, systemPrompt?: string) {
  const messages: { role: "system" | "user"; content: string }[] = [];

  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
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
