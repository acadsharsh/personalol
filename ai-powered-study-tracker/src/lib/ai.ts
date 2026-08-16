import { detectProvider } from "@/lib/ai-providers";
import type { Provider } from "@/lib/ai-providers";

export type { Provider } from "@/lib/ai-providers";
export { detectProvider } from "@/lib/ai-providers";

export interface ChatMsg {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface StreamOptions {
  system: string;
  messages: ChatMsg[];
  onToken: (token: string) => void;
  /** Deterministic reply used when no LLM key is configured (offline coach). */
  fallback: string;
  maxTokens?: number;
}

export interface CompleteOptions {
  system: string;
  messages: ChatMsg[];
  fallback: string;
  maxTokens?: number;
}

function chunkText(text: string): string[] {
  // Emit in small pieces so the UI feels like streaming even offline.
  const size = 48;
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out;
}

async function emitFallback(text: string, onToken: (t: string) => void) {
  for (const c of chunkText(text)) {
    onToken(c);
    await new Promise((r) => setTimeout(r, 12));
  }
}

export async function streamCompletion(opts: StreamOptions): Promise<Provider> {
  const provider = detectProvider();
  try {
    if (provider === "openai") {
      await streamOpenAI(opts);
      return "openai";
    }
    if (provider === "gemini") {
      await streamGemini(opts);
      return "gemini";
    }
    if (provider === "anthropic") {
      await streamAnthropic(opts);
      return "anthropic";
    }
  } catch (err) {
    console.error("[ai] provider stream failed, using offline coach:", err);
  }
  await emitFallback(opts.fallback, opts.onToken);
  return "offline";
}

export async function complete(opts: CompleteOptions): Promise<{ text: string; provider: Provider }> {
  const provider = detectProvider();
  try {
    if (provider === "openai") return { text: await completeOpenAI(opts), provider };
    if (provider === "gemini") return { text: await completeGemini(opts), provider };
    if (provider === "anthropic") return { text: await completeAnthropic(opts), provider };
  } catch (err) {
    console.error("[ai] provider completion failed, using offline coach:", err);
  }
  return { text: opts.fallback, provider: "offline" };
}

// ── OpenAI ──────────────────────────────────────────────────────────────────
function openaiModel(): string {
  return process.env.OPENAI_MODEL || "gpt-4o-mini";
}
function openaiBase(): string {
  return (process.env.OPENAI_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
}

async function streamOpenAI(opts: StreamOptions) {
  const res = await fetch(`${openaiBase()}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: openaiModel(),
      messages: opts.messages,
      stream: true,
      temperature: 0.7,
      max_tokens: opts.maxTokens ?? 800,
    }),
  });
  if (!res.ok || !res.body) throw new Error(`OpenAI HTTP ${res.status}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const s = line.trim();
      if (!s.startsWith("data:")) continue;
      const data = s.slice(5).trim();
      if (data === "[DONE]") continue;
      try {
        const j = JSON.parse(data);
        const delta: string | undefined = j.choices?.[0]?.delta?.content;
        if (delta) opts.onToken(delta);
      } catch {
        /* ignore partial frames */
      }
    }
  }
}

async function completeOpenAI(opts: CompleteOptions): Promise<string> {
  const res = await fetch(`${openaiBase()}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: openaiModel(),
      messages: opts.messages,
      temperature: 0.6,
      max_tokens: opts.maxTokens ?? 900,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`);
  const j = await res.json();
  return j.choices?.[0]?.message?.content ?? "";
}

// ── Google Gemini ───────────────────────────────────────────────────────────
function geminiModel(): string {
  return process.env.GEMINI_MODEL || "gemini-2.0-flash";
}

function toGeminiPayload(opts: { system: string; messages: ChatMsg[]; maxTokens: number }) {
  const system = opts.messages.find((m) => m.role === "system")?.content ?? opts.system;
  const contents = opts.messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
  return {
    systemInstruction: { parts: [{ text: system }] },
    contents,
    generationConfig: { temperature: 0.7, maxOutputTokens: opts.maxTokens },
  };
}

async function streamGemini(opts: StreamOptions) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel()}:streamGenerateContent?alt=sse&key=${process.env.GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toGeminiPayload({ system: opts.system, messages: opts.messages, maxTokens: opts.maxTokens ?? 800 })),
  });
  if (!res.ok || !res.body) throw new Error(`Gemini HTTP ${res.status}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const s = line.trim();
      if (!s.startsWith("data:")) continue;
      try {
        const j = JSON.parse(s.slice(5).trim());
        const parts = j.candidates?.[0]?.content?.parts;
        if (Array.isArray(parts)) {
          for (const p of parts) if (typeof p.text === "string") opts.onToken(p.text);
        }
      } catch {
        /* ignore */
      }
    }
  }
}

async function completeGemini(opts: CompleteOptions): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel()}:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(toGeminiPayload({ system: opts.system, messages: opts.messages, maxTokens: opts.maxTokens ?? 900 })),
  });
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
  const j = await res.json();
  const parts = j.candidates?.[0]?.content?.parts;
  return (Array.isArray(parts) ? parts.map((p: { text?: string }) => p.text ?? "").join("") : "") || "";
}

// ── Anthropic ───────────────────────────────────────────────────────────────
function anthropicModel(): string {
  return process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-latest";
}

function toAnthropicPayload(opts: { system: string; messages: ChatMsg[]; maxTokens: number }) {
  const system = opts.messages.find((m) => m.role === "system")?.content ?? opts.system;
  const messages = opts.messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role, content: m.content }));
  return { model: anthropicModel(), system, messages, max_tokens: opts.maxTokens, temperature: 0.7 };
}

async function streamAnthropic(opts: StreamOptions) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ ...toAnthropicPayload({ system: opts.system, messages: opts.messages, maxTokens: opts.maxTokens ?? 800 }), stream: true }),
  });
  if (!res.ok || !res.body) throw new Error(`Anthropic HTTP ${res.status}`);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let eventName = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      const s = line.trim();
      if (s.startsWith("event:")) {
        eventName = s.slice(6).trim();
        continue;
      }
      if (s.startsWith("data:")) {
        try {
          const j = JSON.parse(s.slice(5).trim());
          if (eventName === "content_block_delta" && j.delta?.type === "text_delta") {
            opts.onToken(j.delta.text as string);
          }
        } catch {
          /* ignore */
        }
      }
    }
  }
}

async function completeAnthropic(opts: CompleteOptions): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(toAnthropicPayload({ system: opts.system, messages: opts.messages, maxTokens: opts.maxTokens ?? 900 })),
  });
  if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}`);
  const j = await res.json();
  return (j.content ?? []).map((b: { text?: string }) => b.text ?? "").join("");
}
