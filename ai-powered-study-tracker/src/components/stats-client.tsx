"use client";

import { useCallback, useEffect, useState } from "react";
import type { StatsPayload } from "@/lib/types";
import { addDays, ALL_SUBJECTS, istDateKey, prettyDate } from "@/lib/timetable";
import { fmtMinutes, pct } from "@/lib/stats";
import InsightCard from "@/components/insight-card";

function AdhBar({ value, logged }: { value: number; logged: boolean }) {
  const p = Math.round(value * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full rounded-full transition-all duration-500 ${logged ? (value >= 0.75 ? "bg-emerald-400" : value > 0 ? "bg-amber-400" : "bg-rose-500") : "bg-slate-700"}`}
          style={{ width: `${logged ? p : 0}%` }}
        />
      </div>
      <span className={`w-9 text-right font-mono text-xs tabular-nums ${logged ? "text-slate-300" : "text-slate-600"}`}>
        {logged ? `${p}%` : "—"}
      </span>
    </div>
  );
}

export default function StatsClient() {
  const [weekEnd, setWeekEnd] = useState<string>("");
  const [data, setData] = useState<StatsPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (to: string) => {
    setLoading(true);
    const from = addDays(to, -6);
    try {
      const res = await fetch(`/api/stats?from=${from}&to=${to}`, { cache: "no-store" });
      if (res.ok) setData(await res.json());
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!weekEnd) setWeekEnd(istDateKey());
    else void load(weekEnd);
  }, [weekEnd, load]);

  if (!data) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8">
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="card h-24 animate-pulse bg-slate-800/30" />
            ))}
          </div>
        ) : (
          <div className="card p-8 text-center text-slate-400">No data yet — log a day first.</div>
        )}
      </main>
    );
  }

  const totals = data.totals;
  const avgAdh = totals.loggedDays ? Math.round(totals.adherence * 100) : 0;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 pb-16">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button className="btn btn-ghost !px-2.5" onClick={() => setWeekEnd(addDays(weekEnd, -7))}>
            ←
          </button>
          <button className="btn btn-ghost !px-3" onClick={() => setWeekEnd(istDateKey())}>
            This week
          </button>
          <button className="btn btn-ghost !px-2.5" onClick={() => setWeekEnd(addDays(weekEnd, 7))}>
            →
          </button>
        </div>
        <h1 className="text-xl font-bold tracking-tight text-slate-100 sm:text-2xl">
          {prettyDate(data.from)} → {prettyDate(data.to)}
        </h1>
        <div className="ml-auto flex flex-wrap gap-2">
          <span className="glass-chip rounded-full px-3 py-1.5 text-xs font-semibold text-slate-300">
            {fmtMinutes(totals.studyDone)} study
          </span>
          <span className="glass-chip rounded-full px-3 py-1.5 text-xs font-semibold text-indigo-300">
            {avgAdh}% avg adherence
          </span>
          <span className="glass-chip rounded-full px-3 py-1.5 text-xs font-semibold text-slate-300">
            {totals.loggedDays}/7 days logged
          </span>
        </div>
      </div>

      {/* day cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {data.rows.map((r) => (
          <div key={r.date} className={`card p-3 transition-opacity ${r.logged ? "" : "opacity-70"}`}>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{r.weekday}</span>
              <span className="text-[10px] text-slate-600">{r.date.slice(8)}</span>
            </div>
            <p className="mb-2 truncate text-xs font-semibold text-indigo-300">{r.dayTypeLabel}</p>
            <AdhBar value={r.adherence} logged={r.logged} />
            <p className="mt-2 text-[11px] text-slate-500">
              {r.logged ? (
                <>
                  {fmtMinutes(r.studyDone)}{" "}
                  <span className="text-slate-600">/ {fmtMinutes(r.studyPlanned)}</span>
                </>
              ) : (
                "not logged"
              )}
            </p>
            <p className="mt-0.5 text-[10px] text-slate-600">
              {r.logged
                ? `${r.doneSlots}/${r.totalStudySlots} slots · ${r.skipped > 0 ? `${r.skipped}✕` : "0✕"}${
                    r.mood ? ` · ${r.mood}` : ""
                  }`
                : "· · ·"}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* subject hours */}
        <section className="card p-5">
          <h2 className="mb-1 text-sm font-bold text-slate-200">Subject hours — planned vs done</h2>
          <p className="mb-4 text-xs text-slate-500">Across the week · bar shows % of planned time actually completed</p>
          <div className="space-y-3">
            {ALL_SUBJECTS.map((s) => {
              const v = data.subjectTotals[s.key];
              const p = v && v.planned > 0 ? v.done / v.planned : 0;
              return (
                <div key={s.key}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="font-semibold" style={{ color: s.color }}>
                      {s.label}
                    </span>
                    <span className="text-slate-500">
                      {v ? `${fmtMinutes(v.done)} / ${fmtMinutes(v.planned)}` : "no plan this week"}
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.round(p * 100)}%`, background: s.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2 border-t border-slate-800 pt-4 text-center">
            <div>
              <p className="text-lg font-black tabular-nums text-slate-100">{pct(totals.adherence)}%</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">avg adherence</p>
            </div>
            <div>
              <p className="text-lg font-black tabular-nums text-slate-100">{fmtMinutes(totals.studyDone)}</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">total study</p>
            </div>
            <div>
              <p className="text-lg font-black tabular-nums text-slate-100">{totals.loggedDays}</p>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">days logged</p>
            </div>
          </div>
        </section>

        <div className="space-y-5">
          <InsightCard kind="weekly" date={weekEnd} title="AI Weekly Review" emoji="📊" />

          <section className="card p-4">
            <h2 className="mb-2 text-sm font-bold text-slate-200">Rotation legend</h2>
            <div className="space-y-1.5 text-xs text-slate-400">
              {[
                ["Mon · Tue", "Physics → Chemistry", "text-indigo-300"],
                ["Wed · Thu", "Chemistry playback → Chemistry → Maths", "text-emerald-300"],
                ["Fri · Sat", "Chemistry → Maths", "text-violet-300"],
                ["Sun", "Physics catch-up + 11th Maths", "text-amber-300"],
              ].map(([d, label, color]) => (
                <div key={d} className="flex items-center gap-2">
                  <span className="w-16 shrink-0 font-semibold text-slate-500">{d}</span>
                  <span className={color}>{label}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
