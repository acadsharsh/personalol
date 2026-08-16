"use client";

import { useEffect, useState } from "react";
import { Card, CategoryBadge, SubjectBadge } from "@/components/ui";
import { formatTime12 } from "@/lib/ist-time";

interface Block {
  id: number;
  weekday: string;
  orderIndex: number;
  startTime: string;
  endTime: string;
  activity: string;
  category: string;
  subject: string | null;
  grade: string | null;
  plannedMinutes: number;
  isLecture: boolean;
}

const WEEKDAYS: { key: string; label: string }[] = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
];

export default function SchedulePage() {
  const [schedule, setSchedule] = useState<Record<string, Block[]>>({});
  const [active, setActive] = useState("mon");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Partial<Block>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/schedule")
      .then((r) => r.json())
      .then((data) => setSchedule(data.schedule ?? {}))
      .finally(() => setLoading(false));
  }, []);

  function startEdit(b: Block) {
    setEditingId(b.id);
    setDraft({ activity: b.activity, startTime: b.startTime, endTime: b.endTime, plannedMinutes: b.plannedMinutes });
  }

  async function saveEdit(weekday: string) {
    if (editingId == null) return;
    const res = await fetch("/api/schedule", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: editingId, ...draft }),
    });
    const data = await res.json();
    if (data.block) {
      setSchedule((prev) => ({
        ...prev,
        [weekday]: prev[weekday].map((b) => (b.id === editingId ? { ...b, ...data.block } : b)),
      }));
    }
    setEditingId(null);
  }

  const blocks = schedule[active] ?? [];
  const totalMinutes = blocks.reduce((a, b) => a + b.plannedMinutes, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Schedule Editor</h1>
        <p className="mt-1 text-sm text-slate-500">
          This is the master timetable template. Edits here apply to every future day of that weekday — flex durations and
          activities freely without breaking the tracker.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {WEEKDAYS.map((w) => (
          <button
            key={w.key}
            onClick={() => setActive(w.key)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
              active === w.key ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {w.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-slate-500">Loading schedule…</p>}

      {!loading && (
        <Card className="p-5">
          <p className="mb-3 text-sm text-slate-500">
            Total planned: <span className="font-semibold text-slate-800">{(totalMinutes / 60).toFixed(1)}h</span>
          </p>
          <div className="space-y-2">
            {blocks.map((b) => (
              <div key={b.id} className="rounded-xl border border-slate-200 p-3">
                {editingId === b.id ? (
                  <div className="space-y-2">
                    <input
                      value={draft.activity ?? ""}
                      onChange={(e) => setDraft((d) => ({ ...d, activity: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="time"
                        value={draft.startTime ?? ""}
                        onChange={(e) => setDraft((d) => ({ ...d, startTime: e.target.value }))}
                        className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
                      />
                      <span className="text-slate-400">to</span>
                      <input
                        type="time"
                        value={draft.endTime ?? ""}
                        onChange={(e) => setDraft((d) => ({ ...d, endTime: e.target.value }))}
                        className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
                      />
                      <input
                        type="number"
                        value={draft.plannedMinutes ?? 0}
                        onChange={(e) => setDraft((d) => ({ ...d, plannedMinutes: Number(e.target.value) }))}
                        className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-sm"
                        placeholder="minutes"
                      />
                      <button
                        onClick={() => saveEdit(active)}
                        className="rounded-lg bg-slate-900 px-3 py-1 text-sm font-medium text-white"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="rounded-lg bg-slate-100 px-3 py-1 text-sm font-medium text-slate-600"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-slate-500">
                          {formatTime12(b.startTime)} – {formatTime12(b.endTime)}
                        </span>
                        <CategoryBadge category={b.category} />
                        <SubjectBadge subject={b.subject} />
                        {b.isLecture && (
                          <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">📡 Lecture</span>
                        )}
                        <span className="text-xs text-slate-400">{b.plannedMinutes}m</span>
                      </div>
                      <p className="mt-1 text-sm text-slate-800">{b.activity}</p>
                    </div>
                    <button
                      onClick={() => startEdit(b)}
                      className="shrink-0 rounded-lg bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200"
                    >
                      Edit
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
