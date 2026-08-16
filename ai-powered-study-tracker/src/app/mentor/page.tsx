"use client";

import { useEffect, useRef, useState } from "react";
import { Card, SuggestionItem } from "@/components/ui";

interface Message {
  id?: number;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
}

interface Suggestion {
  severity: "info" | "warning" | "critical";
  text: string;
}

const QUICK_PROMPTS = [
  "How am I doing overall?",
  "How's my Physics?",
  "How's my Chemistry?",
  "What should I focus on today?",
  "Am I sleeping enough?",
  "I feel like giving up",
];

export default function MentorPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/mentor")
      .then((r) => r.json())
      .then((data) => setMessages(data.messages ?? []))
      .finally(() => setLoadingHistory(false));
    fetch("/api/stats")
      .then((r) => r.json())
      .then((data) => setSuggestions(data.suggestions ?? []));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text?: string) {
    const message = (text ?? input).trim();
    if (!message || sending) return;
    setInput("");
    setSending(true);
    setMessages((prev) => [...prev, { role: "user", content: message }]);
    try {
      const res = await fetch("/api/mentor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply?.content ?? "Sorry, something went wrong." }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
      <div className="flex h-[75vh] flex-col rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3">
          <span className="text-lg">🧠</span>
          <div>
            <p className="text-sm font-semibold text-slate-900">AI Mentor</p>
            <p className="text-xs text-slate-500">Coaches you using your own logged data — no guesswork.</p>
          </div>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {loadingHistory && <p className="text-sm text-slate-400">Loading conversation…</p>}
          {!loadingHistory && messages.length === 0 && (
            <div className="rounded-xl bg-indigo-50 p-4 text-sm text-indigo-900">
              👋 Hey, I&apos;m your AI mentor for the Lakshya JEE 2027 plan. Ask me how you&apos;re doing, which subject needs
              attention, whether your sleep/energy is on track, or what to focus on today. I answer using your actual tracker
              data.
            </div>
          )}
          {messages.map((m, i) => (
            <div key={m.id ?? i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  m.role === "user" ? "bg-slate-900 text-white" : "bg-indigo-50 text-indigo-950"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl bg-indigo-50 px-4 py-2.5 text-sm text-indigo-400">Thinking…</div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="border-t border-slate-100 p-3">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {QUICK_PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => send(p)}
                disabled={sending}
                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200 disabled:opacity-50"
              >
                {p}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex gap-2"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask your mentor anything…"
              className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-indigo-400 focus:outline-none"
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              Send
            </button>
          </form>
        </div>
      </div>

      <div className="space-y-4">
        <Card className="p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Adaptive Suggestions</h2>
          <p className="mt-1 text-xs text-slate-500">Generated from patterns in your logged blocks — updates as you log more days.</p>
          <div className="mt-3 space-y-2">
            {suggestions.length === 0 && <p className="text-sm text-slate-400">No suggestions yet.</p>}
            {suggestions.map((s, i) => (
              <SuggestionItem key={i} severity={s.severity} text={s.text} />
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
