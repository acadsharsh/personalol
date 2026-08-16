"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DayPayload, SlotView } from "@/lib/types";
import {
  CATEGORY_STYLE,
  addDays,
  durationLabel,
  fmt,
  istDateKey,
  prettyDate,
} from "@/lib/timetable";
import { fmtMinutes, pct } from "@/lib/stats";
import InsightCard from "@/components/insight-card";

const MOODS = [
  { key: "😞", label: "Low" },
  { key: "😐", label: "Meh" },
  { key: "🙂", label: "Okay" },
  { key: "😄", label: "Good" },
  { key: "🔥", label: "On fire" },
];

function Ring({ pct }: { pct: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 120 120" className="h-32 w-32 -rotate-90 ring-glow">
      <defs>
        <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#c084fc" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r={r} stroke="rgba(148,163,184,0.14)" strokeWidth="10" fill="none" />
      <circle
        cx="60"
        cy="60"
        r={r}
        stroke="url(#ringGrad)"
        strokeWidth="10"
        fill="none"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - Math.max(0, Math.min(1, pct)))}
        className="transition-all duration-700 ease-out"
      />
    </svg>
  );
}

function SlotRow({
  slot,
  active,
  past,
  onUpdate,
}: {
  slot: SlotView;
  active: boolean;
  past: boolean;
  onUpdate: (slotId: string, patch: { status?: SlotView["status"]; minutes?: number | null; notes?: string }) => void;
}) {
  const [openNotes, setOpenNotes] = useState(false);
  const [noteText, setNoteText] = useState(slot.notes);
  const [minInput, setMinInput] = useState(slot.loggedMinutes ?? Math.round(slot.duration * 0.6));
  const catStyle = CATEGORY_STYLE[slot.category as keyof typeof CATEGORY_STYLE] ?? CATEGORY_STYLE.Break;

  const statusBtn = (status: SlotView["status"], icon: string, title: string, activeClass: string) => (
    <button
      title={title}
      onClick={() => onUpdate(slot.id, { status: slot.status === status ? "none" : status })}
      className={`grid h-8 w-8 place-items-center rounded-lg border text-sm transition-all ${
        slot.status === status ? activeClass : "border-slate-700/60 bg-slate-800/40 text-slate-500 hover:bg-slate-800 hover:text-slate-300"
      }`}
    >
      {icon}
    </button>
  );

  return (
    <div
      id={`slot-${slot.id}`}
      className={`group relative flex gap-3 rounded-xl border p-3 transition-all ${
        active
          ? "border-indigo-400/50 bg-indigo-500/10"
          : slot.status === "done"
          ? "border-slate-800 bg-slate-900/40"
          : slot.status === "skipped"
          ? "border-rose-500/25 bg-rose-500/[0.04] opacity-70"
          : slot.status === "partial"
          ? "border-amber-500/25 bg-amber-500/[0.05]"
          : "border-slate-800/80 bg-slate-900/30 hover:border-slate-700"
      } ${past && slot.status === "none" ? "opacity-80" : ""}`}
    >
      <div className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${catStyle.dot}`} />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-mono text-[11px] font-semibold tabular-nums text-slate-500">
            {fmt(slot.start)}–{fmt(slot.end)}
          </span>
          {active && (
            <span className="rounded-full bg-indigo-500/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-300 pulse-dot">
              Now
            </span>
          )}
          {slot.lecture === "live" && (
            <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-300">
              Live
            </span>
          )}
          {slot.lecture === "playback" && (
            <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-300">
              Playback
            </span>
          )}
          {slot.priority && (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300">
              Anchor
            </span>
          )}
          {slot.subject && (
            <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
              {slot.subject}
            </span>
          )}
          <span className="ml-auto hidden text-[11px] text-slate-600 sm:inline">{durationLabel(slot.duration)}</span>
        </div>

        <p
          className={`mt-0.5 text-sm font-medium ${
            slot.status === "skipped" ? "text-slate-500 line-through decoration-rose-400/60" : "text-slate-200"
          }`}
        >
          {slot.title}
        </p>
        {slot.detail && <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{slot.detail}</p>}

        {slot.status === "partial" && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <input
              type="number"
              min={1}
              max={slot.duration}
              value={minInput}
              onChange={(e) => {
                const v = Number(e.target.value);
                setMinInput(v);
                onUpdate(slot.id, { status: "partial", minutes: Math.max(1, Math.min(slot.duration, v || 1)) });
              }}
              className="input !w-20 !py-1 text-center text-xs"
            />
            <span className="text-xs text-slate-500">of {slot.duration} min</span>
            {[0.5, 0.75, 1].map((f) => (
              <button
                key={f}
                className="rounded-md border border-slate-700 px-2 py-0.5 text-[11px] text-slate-400 hover:bg-slate-800"
                onClick={() => {
                  const v = Math.round(slot.duration * f);
                  setMinInput(v);
                  onUpdate(slot.id, { status: "partial", minutes: v });
                }}
              >
                {Math.round(f * 100)}%
              </button>
            ))}
          </div>
        )}

        {openNotes && (
          <div className="mt-2">
            <textarea
              value={noteText}
              autoFocus
              onChange={(e) => setNoteText(e.target.value)}
              onBlur={() => {
                setOpenNotes(false);
                if (slot.status !== "none") onUpdate(slot.id, { notes: noteText });
              }}
              rows={2}
              placeholder="What did you actually do? A doubt to review? One line is enough…"
              className="input text-xs"
            />
          </div>
        )}

        {slot.status !== "none" && slot.notes && !openNotes && (
          <p className="mt-1.5 rounded-lg bg-slate-800/50 px-2.5 py-1.5 text-xs italic text-slate-400">“{slot.notes}”</p>
        )}
      </div>

      <div className="flex shrink-0 flex-col items-center justify-center gap-1.5">
        {statusBtn("done", "✓", "Done", "border-emerald-500/60 bg-emerald-500/20 text-emerald-300")}
        {statusBtn("partial", "◐", "Partial", "border-amber-500/60 bg-amber-500/20 text-amber-300")}
        {statusBtn("skipped", "✕", "Skipped", "border-rose-500/60 bg-rose-500/20 text-rose-300")}
        <button
          title="Add note"
          onClick={() => setOpenNotes(!openNotes)}
          className={`grid h-8 w-8 place-items-center rounded-lg border text-sm transition-all ${
            openNotes
              ? "border-indigo-500/60 bg-indigo-500/20 text-indigo-300"
              : "border-slate-700/60 bg-slate-800/40 text-slate-500 hover:bg-slate-800 hover:text-slate-300"
          }`}
        >
          ✎
        </button>
      </div>
    </div>
  );
}

export default function TodayClient() {
  const [date, setDate] = useState<string>("");
  const [data, setData] = useState<DayPayload | null>(null);
  const [saving, setSaving] = useState(false);
  const [fastLogging, setFastLogging] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const scrolledRef = useRef<string | null>(null);

  // check-in state
  const [wake, setWake] = useState("");
  const [sleep, setSleep] = useState("");
  const [energy, setEnergy] = useState<number | null>(null);
  const [mood, setMood] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const initRef = useRef(false);

  const today = istDateKey();
  const isToday = date === today;

  const load = useCallback(async (d: string) => {
    setLoadError(null);
    try {
      const res = await fetch(`/api/day?date=${d}`, { cache: "no-store" });
      if (!res.ok) throw new Error("failed to load");
      const j: DayPayload = await res.json();
      setData(j);
    } catch {
      setLoadError("Couldn't load the day — check your connection and retry.");
    }
  }, []);

  useEffect(() => {
    if (!date) setDate(today);
    else void load(date);
  }, [date, load, today]);

  // sync check-in fields when the loaded day changes
  useEffect(() => {
    initRef.current = false;
    setWake(data?.log?.wakeTime ?? "");
    setSleep(data?.log?.sleepTime ?? "");
    setEnergy(data?.log?.energy ?? null);
    setMood(data?.log?.mood ?? null);
    setNotes(data?.log?.notes ?? "");
    requestAnimationFrame(() => {
      initRef.current = true;
    });
  }, [data?.date]);

  // auto-scroll to the active slot once per day
  useEffect(() => {
    if (!data || !isToday || !data.activeSlotId) return;
    if (scrolledRef.current === data.date) return;
    scrolledRef.current = data.date;
    const el = document.getElementById(`slot-${data.activeSlotId}`);
    if (el) {
      setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "center" }), 250);
    }
  }, [data, isToday]);

  // debounced check-in save
  useEffect(() => {
    if (!initRef.current || !data) return;
    const t = setTimeout(() => {
      void fetch("/api/day", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          fields: {
            wakeTime: wake || null,
            sleepTime: sleep || null,
            energy: energy,
            mood: mood,
            notes: notes || null,
          },
        }),
      }).catch(() => undefined);
    }, 800);
    return () => clearTimeout(t);
  }, [wake, sleep, energy, mood, notes, date, data]);

  const updateSlot = useCallback(
    async (slotId: string, patch: { status?: SlotView["status"]; minutes?: number | null; notes?: string }) => {
      setSaving(true);
      setData((prev) =>
        prev
          ? {
              ...prev,
              slots: prev.slots.map((s) =>
                s.id === slotId
                  ? {
                      ...s,
                      status: patch.status ?? s.status,
                      loggedMinutes: patch.minutes !== undefined ? patch.minutes : s.loggedMinutes,
                      notes: patch.notes !== undefined ? patch.notes : s.notes,
                    }
                  : s
              ),
            }
          : prev
      );
      try {
        const res = await fetch("/api/day", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date,
            slots: [{ slotId, ...patch }],
          }),
        });
        if (res.ok) {
          const j: DayPayload = await res.json();
          setData(j);
        }
      } finally {
        setSaving(false);
      }
    },
    [date]
  );

  const fastLog = async () => {
    if (!data) return;
    setFastLogging(true);
    const now = data.nowMinutes;
    const toMark = data.slots
      .filter((s) => s.status === "none" && s.end <= now && s.end <= 1440)
      .map((s) => ({ slotId: s.id, status: "done" as const }));
    if (toMark.length) {
      try {
        const res = await fetch("/api/day", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date, slots: toMark }),
        });
        if (res.ok) setData(await res.json());
      } catch {
        /* ignore */
      }
    }
    setFastLogging(false);
  };

  const categoryChips = useMemo(() => {
    if (!data) return [];
    const cats: { key: string; total: number; done: number }[] = [];
    for (const slot of data.slots) {
      const isStudy = slot.category === "11th Study" || slot.category === "12th Study";
      if (!isStudy) continue;
      let c = cats.find((x) => x.key === slot.category);
      if (!c) {
        c = { key: slot.category, total: 0, done: 0 };
        cats.push(c);
      }
      c.total += 1;
      if (slot.status === "done") c.done += 1;
    }
    return cats;
  }, [data]);

  if (!data) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8">
        {loadError ? (
          <div className="card p-8 text-center">
            <p className="text-rose-300">{loadError}</p>
            <button className="btn btn-primary mt-4" onClick={() => void load(date)}>
              Retry
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="card h-20 animate-pulse bg-slate-800/30" />
            ))}
          </div>
        )}
      </main>
    );
  }

  const adh = data.stats.adherence;
  const activeId = isToday ? data.activeSlotId : null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 pb-16">
      {/* header */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button className="btn btn-ghost !px-2.5" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day">
            ←
          </button>
          <button className="btn btn-ghost !px-3" onClick={() => setDate(today)} disabled={isToday}>
            Today
          </button>
          <button className="btn btn-ghost !px-2.5" onClick={() => setDate(addDays(date, 1))} aria-label="Next day">
            →
          </button>
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-slate-100 sm:text-2xl">
            {data.weekday}, {prettyDate(date)}
          </h1>
          <p className="truncate text-xs text-slate-500 sm:text-sm">
            <span className="font-semibold text-indigo-300">{data.dayTypeLabel}</span>
            <span className="mx-1.5 text-slate-600">·</span>
            {data.headline}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span
            className="glass-chip flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold text-amber-300"
            title="Consecutive days at ≥75% adherence"
          >
            🔥 {data.streak}
          </span>
          <span
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              saving ? "bg-slate-700/50 text-slate-300" : "bg-emerald-500/10 text-emerald-300"
            }`}
          >
            {saving ? "saving…" : "auto-saved ✓"}
          </span>
        </div>
      </div>

      {data.note && (
        <p className="mb-4 rounded-xl border border-amber-500/25 bg-amber-500/[0.06] px-4 py-2.5 text-xs leading-relaxed text-amber-200/90">
          📌 {data.note}
        </p>
      )}
      {!data.inWindow && (
        <p className="mb-4 rounded-xl border border-slate-700 bg-slate-800/40 px-4 py-2.5 text-xs text-slate-400">
          This date is outside the official window (29 Jun – 29 Nov 2026), but the day-type rotation still applies.
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_330px]">
        {/* left: slot list */}
        <div className="min-w-0 space-y-5">
          <div className="card p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-bold text-slate-200">Today's slots</h2>
              <div className="flex flex-wrap gap-1.5">
                {categoryChips.map((c) => (
                  <span key={c.key} className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${CATEGORY_STYLE[c.key as keyof typeof CATEGORY_STYLE]?.chip}`}>
                    {c.key.replace(" Study", "")} {c.done}/{c.total}
                  </span>
                ))}
              </div>
              {isToday && (
                <button className="btn btn-ghost ml-auto !px-3 !py-1.5 text-xs" onClick={fastLog} disabled={fastLogging}>
                  ⚡ Fast-log past slots
                </button>
              )}
            </div>
            <div className="space-y-2">
              {data.slots.map((s) => (
                <SlotRow
                  key={s.id}
                  slot={s}
                  active={activeId === s.id}
                  past={s.end <= data.nowMinutes && s.end <= 1440}
                  onUpdate={updateSlot}
                />
              ))}
            </div>
          </div>
        </div>

        {/* right column */}
        <div className="space-y-5">
          <section className="card p-5 fade-up">
            <div className="flex items-center gap-4">
              <Ring pct={adh} />
              <div className="min-w-0">
                <p className="text-3xl font-black tabular-nums text-slate-100">{pct(adh)}%</p>
                <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Study adherence</p>
                <p className="mt-1 text-xs text-slate-400">
                  {fmtMinutes(data.stats.studyDone)} of {fmtMinutes(data.stats.studyPlanned)} ·{" "}
                  {data.stats.doneSlots}/{data.stats.totalStudySlots} slots
                </p>
                {data.stats.skipped > 0 && (
                  <p className="text-xs text-rose-300/80">{data.stats.skipped} skipped · {data.stats.partial} partial</p>
                )}
              </div>
            </div>

            {/* grade split */}
            <div className="mt-4 space-y-2">
              {([11, 12] as const).map((g) => {
                const v = data.stats.byGrade[g];
                const p = v.planned > 0 ? v.done / v.planned : 0;
                return (
                  <div key={g}>
                    <div className="mb-1 flex justify-between text-[11px] text-slate-500">
                      <span className="font-semibold">{g}th grade</span>
                      <span>
                        {fmtMinutes(v.done)} / {fmtMinutes(v.planned)}
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${g === 12 ? "bg-indigo-400" : "bg-emerald-400"}`}
                        style={{ width: `${Math.round(p * 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* week mini bars */}
            <div className="mt-4 flex items-end justify-between gap-1.5 border-t border-slate-800 pt-4">
              {data.week.map((w) => {
                const isCurrent = w.date === date;
                return (
                  <button
                    key={w.date}
                    onClick={() => setDate(w.date)}
                    title={`${w.date} — ${w.logged ? `${pct(w.adherence)}%` : "not logged"}`}
                    className="group flex flex-1 flex-col items-center gap-1"
                  >
                    <div className="flex h-14 w-full items-end rounded-md bg-slate-800/50">
                      <div
                        className={`w-full rounded-md transition-all duration-500 ${
                          isCurrent
                            ? "bg-gradient-to-t from-indigo-500 to-violet-400"
                            : w.adherence >= 0.75
                            ? "bg-emerald-500/70"
                            : w.adherence > 0
                            ? "bg-amber-500/60"
                            : "bg-slate-700"
                        }`}
                        style={{ height: `${Math.max(6, Math.round(w.adherence * 100))}%` }}
                      />
                    </div>
                    <span className={`text-[10px] font-semibold ${isCurrent ? "text-indigo-300" : "text-slate-600 group-hover:text-slate-400"}`}>
                      {["S", "M", "T", "W", "T", "F", "S"][new Date(`${w.date}T00:00:00Z`).getUTCDay()]}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-center text-[10px] text-slate-600">last 7 days · tap a bar to jump</p>
          </section>

          {/* check-in */}
          <section className="card p-4">
            <h2 className="mb-3 text-sm font-bold text-slate-200">Daily check-in</h2>
            <div className="space-y-3">
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Energy</p>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      onClick={() => setEnergy(n)}
                      className={`h-8 flex-1 rounded-lg border text-sm font-bold transition-all ${
                        energy === n
                          ? "border-amber-500/60 bg-amber-500/20 text-amber-300"
                          : "border-slate-700/60 bg-slate-800/40 text-slate-500 hover:text-slate-300"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Mood</p>
                <div className="flex gap-1.5">
                  {MOODS.map((m) => (
                    <button
                      key={m.key}
                      title={m.label}
                      onClick={() => setMood(mood === m.key ? null : m.key)}
                      className={`h-9 flex-1 rounded-lg border text-base transition-all ${
                        mood === m.key
                          ? "border-indigo-500/60 bg-indigo-500/20"
                          : "border-slate-700/60 bg-slate-800/40 opacity-60 hover:opacity-100"
                      }`}
                    >
                      {m.key}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Woke up</span>
                  <input type="time" value={wake} onChange={(e) => setWake(e.target.value)} className="input" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Lights out</span>
                  <input type="time" value={sleep} onChange={(e) => setSleep(e.target.value)} className="input" />
                </label>
              </div>
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Day notes</span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="What worked today? What fought back?"
                  className="input text-sm"
                />
              </label>
            </div>
          </section>

          <InsightCard kind="daily" date={date} title="AI Daily Review" emoji="🧠" />
        </div>
      </div>
    </main>
  );
}
