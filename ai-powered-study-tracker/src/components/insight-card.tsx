"use client";

import { useCallback, useEffect, useState } from "react";
import type { InsightView } from "@/lib/types";
import { renderMiniMd } from "@/lib/md";

export default function InsightCard({
  kind,
  date,
  title,
  emoji,
}: {
  kind: "daily" | "weekly";
  date: string;
  title: string;
  emoji: string;
}) {
  const [insight, setInsight] = useState<InsightView | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveContent, setLiveContent] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/ai/insight?kind=${kind}&date=${date}`, { cache: "no-store" });
      const j = await res.json();
      setInsight(j.insight ?? null);
    } catch {
      /* offline */
    }
  }, [kind, date]);

  useEffect(() => {
    setInsight(null);
    setLiveContent(null);
    void load();
  }, [load]);

  const generate = async () => {
    setGenerating(true);
    setError(null);
    setLiveContent("");
    try {
      const res = await fetch("/api/ai/insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, date }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "failed");
      setInsight(j.insight);
    } catch (e) {
      setError(e instanceof Error ? e.message : "generation failed");
    } finally {
      setGenerating(false);
      setLiveContent(null);
    }
  };

  return (
    <section className="card p-4 fade-up">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-200">
          <span>{emoji}</span> {title}
        </h2>
        <div className="flex items-center gap-2">
          {insight && (
            <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-300">
              {insight.provider}
            </span>
          )}
          <button
            className="btn btn-ghost !px-2.5 !py-1 text-xs"
            onClick={generate}
            disabled={generating}
          >
            {generating ? "Generating…" : insight ? "↻ Regenerate" : "✨ Generate"}
          </button>
        </div>
      </div>

      {generating && !liveContent && (
        <div className="space-y-2 py-2">
          <div className="h-3 w-3/4 animate-pulse rounded bg-slate-700/50" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-slate-700/40" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-slate-700/30" />
          <p className="text-xs text-slate-500">The coach is reading your log…</p>
        </div>
      )}

      {insight && (
        <div className="mentor-md max-h-96 overflow-y-auto pr-1">{renderMiniMd(insight.content)}</div>
      )}

      {!insight && !generating && (
        <p className="text-sm text-slate-500">
          No review yet for this {kind === "daily" ? "day" : "week"}. Generate one and the AI coach will
          read every slot you logged and turn it into a plan.
        </p>
      )}

      {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
    </section>
  );
}
