export type Provider = "openai" | "gemini" | "anthropic" | "offline";

/** Priority-ordered provider detection from environment variables. */
export function detectProvider(): Provider {
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return "offline";
}

export const PROVIDER_LABEL: Record<Provider, string> = {
  openai: "GPT",
  gemini: "Gemini",
  anthropic: "Claude",
  offline: "Offline Coach",
};
