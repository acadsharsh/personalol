"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CategoryBadge, SubjectBadge, ProgressBar } from "@/components/ui";
import { getISTNow, shiftDateKey, timeToMinutes, formatDateHeading, formatTime12 } from "@/lib/ist-time";

interface BlockLog {
  id: number;
  scheduleBlockId: number;
  status: "pending" | "done" | "partial" | "skipped";
  actualMinutes: number | null;
  focus: number | null;
  note: string | null;
  activity: string;
  category: string;
  subject: string | null;
  grade: string | null;
  plannedMinutes: number;
  isLecture: boolean;
  startTime: string;
  endTime: string;
}

interface DayResponse {
  log: {
    id: number;
    date: string;
    weekday: string;
    wakeTime: string | null;
    sleepHours: string | null;
    energy: number | null;
    mood: number | null;
    notes: string | null;
  };
  blocks: BlockLog[];
  weekdayLabel: string;
  dayTypeLabel: string;
}

const STATUS_OPTIONS: { key: BlockLog["status"]; label: string; icon: string }[] = [
  { key: "pending", label: "Pending", icon: "⏳" },
  { key: "done", label: "Done", icon: "✅" },
  { key: "partial", label: "Partial", icon: "🌓" },
  { key: "skipped", label: "Skipped", icon: "✖️" },
];

const STATUS_ROW_STYLE: Record<BlockLog["status"], string> = {
  pending: "border-slate-200",
  done: "border-emerald-300 bg-emerald-50/40",
  partial: "border-amber-300 bg-amber-50/40",
  skipped: "border-rose-300 bg-rose-50/40",
};

function scoreOf(status: BlockLog["status"]) {
  if (status === "done") return 1;
  if (status === "partial") return 0.5;
  return 0;
}

export default function DashboardPage() {
  const [dateKey, setDateKey] = useState<string | null>(null);
  const [todayKey, setTodayKey] = useState<string | null>(null);
  const [nowMinutes, setNowMinutes] = useState<number | null>(null);
  const [day, setDay] = useState<DayResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [insight, setInsight] = useState<{ insights: string[]; focus: string | null } | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [savingField, setSavingField] = useState<string | null>(null);

  useEffect(() => {
    const ist = getISTNow();
    setTodayKey(ist.dateKey);
    setNowMinutes(ist.minutesSinceMidnight);
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const requested = params.get("date");
      if (requested && /^\d{4}-\d{2}-\d{2}$/.test(requested)) {
        setDateKey(requested);
      } else {
        setDateKey(ist.dateKey);
      }
    } else {
      setDateKey(ist.dateKey);
    }
    const interval = setInterval(() => {
      const n = getISTNow();
      setNowMinutes(n.minutesSinceMidnight);
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const loadDay = useCallback(async (key: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/day/${key}`);
      const data = await res.json();
      setDay(data);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadInsight = useCallback(async (key: string) => {
    setInsightLoading(true);
    try {
      const res = await fetch(`/api/insight?date=${key}`);
      const data = await res.json();
      setInsight(data);
    } finally {
      setInsightLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!dateKey) return;
    loadDay(dateKey);
    loadInsight(dateKey);
  }, [dateKey, loadDay, loadInsight]);

  const isToday = dateKey === todayKey;

  const upNextId = useMemo(() => {
    if (!isToday || !day || nowMinutes == null) return null;
    for (const b of day.blocks) {
      const start = timeToMinutes(b.startTime);
      const end = timeToMinutes(b.endTime);
      const spansMidnight = end <= start;
      const active = spansMidnight ? nowMinutes >= start || nowMinutes < end : nowMinutes >= start && nowMinutes < end;
      if (active) return b.id;
    }
    return null;
  }, [day, isToday, nowMinutes]);

  const completion = useMemo(() => {
    if (!day || day.blocks.length === 0) return 0;
    const sum = day.blocks.reduce((acc, b) => acc + scoreOf(b.status), 0);
    return Math.round((sum / day.blocks.length) * 100);
  }, [day]);

  const studyMinutesDone = useMemo(() => {
    if (!day) return { study11: 0, study12: 0 };
    let study11 = 0;
    let study12 = 0;
    for (const b of day.blocks) {
      const factor = scoreOf(b.status);
      if (b.category === "study_11") study11 += b.plannedMinutes * factor;
      if (b.category === "study_12") study12 += b.plannedMinutes * factor;
    }
    return { study11: Math.round(study11), study12: Math.round(study12) };
  }, [day]);

  async function updateBlockStatus(blockLogId: number, status: BlockLog["status"]) {
    if (!dateKey || !day) return;
    setDay({ ...day, blocks: day.blocks.map((b) => (b.id === blockLogId ? { ...b, status } : b)) });
    await fetch(`/api/day/${dateKey}/block/${blockLogId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    loadInsight(dateKey);
  }

  async function updateBlockFocus(blockLogId: number, focus: number) {
    if (!dateKey || !day) return;
    setDay({ ...day, blocks: day.blocks.map((b) => (b.id === blockLogId ? { ...b, focus } : b)) });
    await fetch(`/api/day/${dateKey}/block/${blockLogId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ focus }),
    });
  }

  async function updateDayField(field: string, value: string | number | null) {
    if (!dateKey || !day) return;
    setSavingField(field);
    setDay({ ...day, log: { ...day.log, [field]: value === null ? null : String(value) } });
    await fetch(`/api/day/${dateKey}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    setSavingField(null);
    loadInsight(dateKey);
  }

  if (!dateKey) return null;

  return (
    <div className="space-y-6">
      {/* Date nav */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{day ? formatDateHeading(day.log.date) : "…"}</h1>
          {day && (
            <p className="mt-0.5 text-sm text-slate-500">
              {day.weekdayLabel} · <span className="font-medium text-slate-700">{day.dayTypeLabel}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setDateKey(shiftDateKey(dateKey, -1))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            ← Prev
          </button>
          <input
            type="date"
            value={dateKey}
            onChange={(e) => setDateKey(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
          />
          {!isToday && (
            <button
              onClick={() => todayKey && setDateKey(todayKey)}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-700"
            >
              Today
            </button>
          )}
          <button
            onClick={() => setDateKey(shiftDateKey(dateKey, 1))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Next →
          </button>
        </div>
      </div>

      {/* Progress overview */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex-1 min-w-[220px]">
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-medium text-slate-600">Today&apos;s Completion</p>
              <p className="text-sm font-semibold text-slate-900">{completion}%</p>
            </div>
            <ProgressBar value={completion} className="mt-1.5" />
          </div>
          <div className="flex gap-4 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">11th Study</p>
              <p className="font-semibold text-sky-700">{(studyMinutesDone.study11 / 60).toFixed(1)}h / 3h</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">12th Study</p>
              <p className="font-semibold text-violet-700">{(studyMinutesDone.study12 / 60).toFixed(1)}h / 10h</p>
            </div>
          </div>
        </div>
      </Card>

      {/* AI Daily Insight */}
      <Card className="p-5 bg-gradient-to-br from-indigo-50 to-white">
        <div className="flex items-center gap-2">
          <span className="text-lg">🧠</span>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-indigo-700">AI Daily Insight</h2>
        </div>
        {insightLoading && !insight ? (
          <p className="mt-2 text-sm text-slate-500">Analyzing today&apos;s log…</p>
        ) : (
          <div className="mt-3 space-y-2">
            {insight?.insights.map((s, i) => (
              <p key={i} className="text-sm leading-relaxed text-slate-800">
                {s}
              </p>
            ))}
            {insight?.focus && (
              <p className="mt-2 rounded-lg bg-indigo-100 px-3 py-2 text-sm font-medium text-indigo-900">🎯 {insight.focus}</p>
            )}
          </div>
        )}
      </Card>

      {/* Day-level logging */}
      {day && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Daily Check-in</h2>
          <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs text-slate-500">Wake time</span>
              <input
                type="time"
                defaultValue={day.log.wakeTime ?? ""}
                onBlur={(e) => updateDayField("wakeTime", e.target.value || null)}
                className="rounded-lg border border-slate-300 px-2 py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-xs text-slate-500">Sleep (hrs)</span>
              <input
                type="number"
                step="0.5"
                min={0}
                max={12}
                defaultValue={day.log.sleepHours ?? ""}
                onBlur={(e) => updateDayField("sleepHours", e.target.value === "" ? null : Number(e.target.value))}
                className="rounded-lg border border-slate-300 px-2 py-1.5"
              />
            </label>
            <div className="flex flex-col gap-1 text-sm">
              <span className="text-xs text-slate-500">Energy</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((v) => (
                  <button
                    key={v}
                    onClick={() => updateDayField("energy", v)}
                    className={`h-7 w-7 rounded-full text-xs font-semibold ${
                      day.log.energy === v ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1 text-sm">
              <span className="text-xs text-slate-500">Mood</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((v) => (
                  <button
                    key={v}
                    onClick={() => updateDayField("mood", v)}
                    className={`h-7 w-7 rounded-full text-xs font-semibold ${
                      day.log.mood === v ? "bg-pink-500 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <label className="mt-3 flex flex-col gap-1 text-sm">
            <span className="text-xs text-slate-500">Notes {savingField === "notes" && "(saving…)"}</span>
            <textarea
              defaultValue={day.log.notes ?? ""}
              onBlur={(e) => updateDayField("notes", e.target.value || null)}
              rows={2}
              placeholder="Anything worth remembering about today..."
              className="rounded-lg border border-slate-300 px-2 py-1.5"
            />
          </label>
        </Card>
      )}

      {/* Block list */}
      {loading && <p className="text-sm text-slate-500">Loading schedule…</p>}
      {day && (
        <div className="space-y-2">
          {day.blocks.map((b) => (
            <div
              key={b.id}
              className={`rounded-xl border-2 p-3 transition ${STATUS_ROW_STYLE[b.status]} ${
                upNextId === b.id ? "ring-2 ring-indigo-400" : ""
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-[200px] flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-slate-500">
                      {formatTime12(b.startTime)} – {formatTime12(b.endTime)}
                    </span>
                    <CategoryBadge category={b.category} />
                    <SubjectBadge subject={b.subject} />
                    {b.isLecture && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">📡 Lecture</span>}
                    {upNextId === b.id && (
                      <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-medium text-white">▶ Up Next</span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-slate-800">{b.activity}</p>
                  {(b.status === "done" || b.status === "partial") && b.category !== "break" && b.category !== "meal" && (
                    <div className="mt-1.5 flex items-center gap-1">
                      <span className="text-xs text-slate-500">Focus:</span>
                      {[1, 2, 3, 4, 5].map((v) => (
                        <button
                          key={v}
                          onClick={() => updateBlockFocus(b.id, v)}
                          className={`text-sm ${b.focus && b.focus >= v ? "text-amber-500" : "text-slate-300"}`}
                        >
                          ★
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  {STATUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => updateBlockStatus(b.id, opt.key)}
                      title={opt.label}
                      className={`rounded-lg px-2 py-1.5 text-sm transition ${
                        b.status === opt.key ? "bg-slate-900 text-white" : "bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {opt.icon}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
