"use client";

import { useState } from "react";
import { CATEGORY_STYLE, DAY_TYPES, durationLabel, fmt, SCHEDULE_END, SCHEDULE_START, type DayType } from "@/lib/timetable";

const TABS: { key: DayType["key"]; label: string; emoji: string }[] = [
  { key: "mon_tue", label: "Mon · Tue", emoji: "📘" },
  { key: "wed_thu", label: "Wed · Thu", emoji: "🧪" },
  { key: "fri_sat", label: "Fri · Sat", emoji: "📐" },
  { key: "sun", label: "Sunday", emoji: "🛟" },
];

export default function TimetableClient() {
  const [tab, setTab] = useState<DayType["key"]>("mon_tue");
  const dayType = DAY_TYPES[tab];

  return (
    <main className="mx-auto max-w-5xl px-4 py-6 pb-16">
      <h1 className="text-xl font-bold tracking-tight text-slate-100 sm:text-2xl">The Framework</h1>
      <p className="mt-1 text-sm text-slate-500">
        Lakshya JEE 2027 · {SCHEDULE_START} → {SCHEDULE_END} · 13h/day on four rotating day-types ·{" "}
        <span className="text-emerald-300">3h 11th</span> + <span className="text-indigo-300">10h 12th</span> · all times IST
      </p>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`shrink-0 rounded-xl border px-4 py-2 text-sm font-semibold transition-all ${
              tab === t.key
                ? "border-indigo-500/60 bg-indigo-500/15 text-indigo-200"
                : "border-slate-700 bg-slate-800/40 text-slate-400 hover:text-slate-200"
            }`}
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      <div className="card mt-4 overflow-hidden">
        <div className="border-b border-slate-800 px-5 py-4">
          <h2 className="text-sm font-bold text-slate-200">{dayType.headline}</h2>
          {dayType.note && <p className="mt-1 text-xs text-amber-200/80">📌 {dayType.note}</p>}
          <p className="mt-2 text-xs text-slate-500">
            11th Grade: <span className="font-semibold text-emerald-300">3h 00m</span> · 12th Grade:{" "}
            <span className="font-semibold text-indigo-300">10h 00m</span> · Total Study:{" "}
            <span className="font-semibold text-slate-200">13h 00m</span> ✓
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-500">
                <th className="px-5 py-2.5 font-semibold">IST Time</th>
                <th className="px-3 py-2.5 font-semibold">Activity</th>
                <th className="hidden px-3 py-2.5 font-semibold sm:table-cell">Duration</th>
                <th className="px-5 py-2.5 text-right font-semibold">Category</th>
              </tr>
            </thead>
            <tbody>
              {dayType.slots.map((s, i) => {
                const style = CATEGORY_STYLE[s.category];
                return (
                  <tr key={s.id} className={`border-b border-slate-800/50 last:border-0 ${i % 2 ? "bg-slate-900/30" : ""}`}>
                    <td className="whitespace-nowrap px-5 py-2 font-mono text-xs font-semibold tabular-nums text-slate-400">
                      {fmt(s.start)} – {fmt(s.end)}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`font-medium ${s.category === "Health" ? "text-amber-200" : s.category === "Meal" ? "text-rose-200" : "text-slate-200"}`}>
                        {s.title}
                      </span>
                      {s.detail && <span className="ml-2 hidden text-xs text-slate-500 md:inline">— {s.detail}</span>}
                      <span className="mt-0.5 flex flex-wrap gap-1">
                        {s.lecture && (
                          <span className="rounded-full bg-rose-500/15 px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-rose-300">
                            {s.lecture}
                          </span>
                        )}
                        {s.priority && (
                          <span className="rounded-full bg-amber-500/15 px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-amber-300">
                            anchor
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="hidden whitespace-nowrap px-3 py-2 text-xs text-slate-500 sm:table-cell">
                      {durationLabel(s.end - s.start)}
                    </td>
                    <td className="whitespace-nowrap px-5 py-2 text-right">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${style.chip}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                        {s.category}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* rotation legend */}
      <section className="card mt-5 p-5">
        <h2 className="text-sm font-bold text-slate-200">Subject-rotation legend</h2>
        <p className="mt-1 text-xs text-slate-500">
          “Previous-Day HW” always targets the prior day's <em>second</em> live lecture — the 24-hour interleaving rule.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500">
                <th className="py-2 pr-4 font-semibold">Day</th>
                <th className="py-2 pr-4 font-semibold">Today's Live Order (A → B)</th>
                <th className="py-2 pr-4 font-semibold">21:00 Immediate HW (= A)</th>
                <th className="py-2 font-semibold">Previous-Day HW (= yesterday's B)</th>
              </tr>
            </thead>
            <tbody className="text-slate-300">
              {[
                ["Mon", "Physics → Chemistry", "Physics", "Physics (Sunday catch-up)"],
                ["Tue", "Physics → Chemistry", "Physics", "Chemistry (Mon)"],
                ["Wed", "Chemistry → Maths", "Chemistry", "Chemistry (Tue)"],
                ["Thu", "Chemistry → Maths", "Chemistry", "Maths (Wed)"],
                ["Fri", "Chemistry → Maths", "Chemistry", "Maths (Thu)"],
                ["Sat", "Chemistry → Maths", "Chemistry", "Maths (Fri)"],
                ["Sun", "Physics catch-up AM / 11th Maths PM", "—", "Maths (Sat)"],
              ].map((r) => (
                <tr key={r[0]} className="border-b border-slate-800/50 last:border-0">
                  {r.map((cell, i) => (
                    <td key={i} className={`py-2 pr-4 ${i === 0 ? "font-bold text-indigo-300" : ""}`}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* design notes */}
      <section className="card mt-5 p-5">
        <h2 className="text-sm font-bold text-slate-200">Why the machine looks like this</h2>
        <div className="mt-3 grid gap-3 text-xs leading-relaxed text-slate-400 sm:grid-cols-2">
          <p>
            <strong className="text-slate-200">Morning 11th block first.</strong> 11th-grade work has no external deadline
            pulling it into place — it's “important but not urgent”, so it loses to urgent work every time it's left
            unscheduled. Sitting first in the waking hours, it catches the genuine post-waking alertness peak before
            decision fatigue sets in.
          </p>
          <p>
            <strong className="text-slate-200">Theory → HW → Revision, no breaks.</strong> Chaining active retrieval within
            minutes of passive input catches the forgetting curve at its steepest point instead of letting material go cold.
          </p>
          <p>
            <strong className="text-slate-200">Post-lunch window = review only.</strong> The 13:00–15:00 circadian dip lowers
            the brain's capacity to encode new material. Retrieving yesterday's homework needs far less top-down control, so
            the dip barely costs anything.
          </p>
          <p>
            <strong className="text-slate-200">Wed/Thu trade breadth for depth.</strong> Chemistry (a repetition-based
            subject) gets triple exposure; Physics is paused and consolidated in one 3.5h Sunday block. The 15:30 power nap
            is non-negotiable — 15 minutes restores prefrontal alertness without sleep inertia.
          </p>
          <p>
            <strong className="text-slate-200">Sunday is not a rest day — it's the safety net.</strong> Same wake-up time
            protects the circadian rhythm; the Physics catch-up and 11th Maths slots exist so weekday overflows have a home.
          </p>
          <p>
            <strong className="text-slate-200">The split is sacred.</strong> Every day-type holds exactly 3h (11th) and 10h
            (12th) = 13h. The rhythm never changes even as the subjects rotating through it do — a 91-hour study week.
          </p>
        </div>
      </section>
    </main>
  );
}
