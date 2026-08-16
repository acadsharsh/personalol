"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { renderMiniMd } from "@/lib/md";
import { detectProviderLabel } from "@/lib/client-utils";

interface ChatItem {
  role: "user" | "assistant";
  content: string;
  provider?: string;
}

const SUGGESTIONS = [
  "How's my week going?",
  "I keep skipping the 21:00 HW slot",
  "What should I do right now?",
  "I'm exhausted — help me recover",
  "Why is the 11th grade block kept in the morning?",
  "Make a plan to clear my backlog",
];

export default function ChatClient() {
  const [items, setItems] = useState<ChatItem[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [model, setModel] = useState<string>(detectProviderLabel());
  const [loaded, setLoaded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/ai/mentor", { cache: "no-store" });
        if (!res.ok) return;
        const j = await res.json();
        setItems(
          j.messages.map((m: { role: string; content: string; provider: string | null }) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
            provider: m.provider ?? undefined,
          }))
        );
      } catch {
        /* ignore */
      }
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [items, busy]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy) return;
      setInput("");
      setBusy(true);

      const next: ChatItem[] = [...items, { role: "user", content: trimmed }];
      setItems([...next, { role: "assistant", content: "" }]);

      try {
        const res = await fetch("/api/ai/mentor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: next.slice(-12).map((m) => ({ role: m.role, content: m.content })),
          }),
        });
        if (!res.ok || !res.body) throw new Error("no stream");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let acc = "";
        let doneProvider: string | undefined;

        const apply = () => {
          setItems((prev) => {
            const copy = [...prev];
            copy[copy.length - 1] = { role: "assistant", content: acc, provider: doneProvider };
            return copy;
          });
        };

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            const s = line.trim();
            if (!s) continue;
            try {
              const j = JSON.parse(s);
              if (typeof j.d === "string") {
                acc += j.d;
                apply();
              }
              if (j.done) {
                doneProvider = j.provider;
                if (j.provider) setModel(j.provider);
                apply();
              }
            } catch {
              /* partial line */
            }
          }
        }
      } catch {
        setItems((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = {
            role: "assistant",
            content: copy[copy.length - 1]?.content || "I couldn't reach my brain just now — try again in a moment.",
            provider: "offline",
          };
          return copy;
        });
      } finally {
        setBusy(false);
        inputRef.current?.focus();
      }
    },
    [items, busy]
  );

  return (
    <main className="mx-auto flex h-[calc(100vh-64px)] max-w-4xl flex-col px-4 py-4">
      <div className="mb-3 flex items-center gap-3">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-slate-100">🧠 Lakshya Mentor</h1>
          <p className="text-xs text-slate-500">
            Reads your actual tracker data — every reply is grounded in your last 7 days.
          </p>
        </div>
        <span className="ml-auto rounded-full border border-violet-500/30 bg-violet-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-violet-300">
          {model}
        </span>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto pr-1 pb-4">
        {!loaded && (
          <div className="card p-6">
            <div className="h-3 w-2/3 animate-pulse rounded bg-slate-700/50" />
          </div>
        )}

        {loaded && items.length === 0 && (
          <div className="card p-6 text-center">
            <p className="text-3xl">🎯</p>
            <p className="mt-2 text-sm font-semibold text-slate-200">
              I've read your timetable — now tell me how the day actually went.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Log a few slots in the tracker first, then ask me anything: progress, leaks, concepts, or morale.
            </p>
          </div>
        )}

        {items.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-gradient-to-br from-indigo-600 to-violet-600 text-white"
                  : "card mentor-md"
              }`}
            >
              {m.role === "assistant" ? (
                <>
                  {m.content ? (
                    renderMiniMd(m.content)
                  ) : (
                    <span className="flex items-center gap-1.5 py-1">
                      <span className="typing-dot h-2 w-2 rounded-full bg-indigo-400" />
                      <span className="typing-dot h-2 w-2 rounded-full bg-indigo-400" />
                      <span className="typing-dot h-2 w-2 rounded-full bg-indigo-400" />
                    </span>
                  )}
                  {busy && i === items.length - 1 && <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-indigo-300/80 align-middle" />}
                </>
              ) : (
                <p className="whitespace-pre-wrap">{m.content}</p>
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* suggestions */}
      <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => void send(s)}
            disabled={busy}
            className="shrink-0 rounded-full border border-slate-700 bg-slate-800/50 px-3 py-1.5 text-xs text-slate-400 transition-colors hover:border-indigo-500/50 hover:text-indigo-300 disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(input);
            }
          }}
          rows={1}
          placeholder="Ask your mentor anything… (Enter to send, Shift+Enter for newline)"
          className="input flex-1 resize-none"
        />
        <button type="submit" className="btn btn-primary" disabled={busy || !input.trim()}>
          Send
        </button>
      </form>
    </main>
  );
}
