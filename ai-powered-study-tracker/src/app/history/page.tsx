"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, StatCard, ProgressBar } from "@/components/ui";
import { formatDateHeading } from "@/lib/ist-time";

interface Overview {
  totalDaysLogged: number;
  currentStreak: number;
  bestStreak: number;
  overallCompletionRate: number;
  categoryCompletion: Record<string, number>;
  subjectCompletion: Record<string, number>;
  avgEnergy: number | null;
  avgMood: number | null;
  avgSleep: number | null;
  trend: string;
  lectureAdherence: number;
}

interface DaySummary {
  date: string;
  weekday: string;
  energy: number | null;
  mood: number | null;
  sleepHours: string | null;
  completion: number;
}

const TREND_ICON: Record<string, string> = {
  improving: "📈 Improving",
  declining: "📉 Declining",
  steady: "➖ Steady",
  "insufficient-data": "🔍 Gathering data",
};

const SUBJECT_LABEL: Record<string, string> = { physics: "Physics", chemistry: "Chemistry", maths: "Maths", mixed: "Mixed" };
const CATEGORY_LABEL: Record<string, string> = { health: "Health", study_11: "11th Study", study_12: "12th Study" };

export default function HistoryPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [days, setDays] = useState<DaySummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((data) => {
        setOverview(data.overview);
        setDays([...data.days].reverse());
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-slate-500">Loading history…</p>;
  if (!overview || overview.totalDaysLogged === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-lg font-semibold text-slate-800">No days logged yet</p>
        <p className="mt-1 text-sm text-slate-500">Head to the Tracker tab and start marking blocks done or skipped.</p>
        <Link href="/" className="mt-4 inline-block rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white">
          Go to Tracker
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">History &amp; Stats</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Overall Completion" value={`${overview.overallCompletionRate}%`} sub={`${overview.totalDaysLogged} days logged`} />
        <StatCard label="Current Streak" value={`${overview.currentStreak} 🔥`} sub={`Best: ${overview.bestStreak}`} />
        <StatCard label="Lecture Adherence" value={`${overview.lectureAdherence}%`} sub="Live + playback" />
        <StatCard label="Trend" value={TREND_ICON[overview.trend] ?? overview.trend} />
        <StatCard label="Avg Energy" value={overview.avgEnergy != null ? `${overview.avgEnergy}/5` : "—"} />
        <StatCard label="Avg Mood" value={overview.avgMood != null ? `${overview.avgMood}/5` : "—"} />
        <StatCard label="Avg Sleep" value={overview.avgSleep != null ? `${overview.avgSleep}h` : "—"} sub="Target: 7h" />
        <StatCard label="Days Logged" value={overview.totalDaysLogged} />
      </div>

      <Card className="p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Subject Completion</h2>
        <div className="mt-3 space-y-3">
          {Object.entries(overview.subjectCompletion).map(([subject, rate]) => (
            <div key={subject}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">{SUBJECT_LABEL[subject] ?? subject}</span>
                <span className="text-slate-500">{rate}%</span>
              </div>
              <ProgressBar value={rate} className="mt-1" />
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Category Completion</h2>
        <div className="mt-3 space-y-3">
          {Object.entries(overview.categoryCompletion).map(([category, rate]) => (
            <div key={category}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">{CATEGORY_LABEL[category] ?? category}</span>
                <span className="text-slate-500">{rate}%</span>
              </div>
              <ProgressBar value={rate} className="mt-1" />
            </div>
          ))}
        </div>
      </Card>

      <Card className="overflow-hidden p-0">
        <h2 className="border-b border-slate-100 px-5 py-3 text-sm font-semibold uppercase tracking-wide text-slate-600">Daily Log</h2>
        <div className="max-h-[480px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Completion</th>
                <th className="px-4 py-2">Energy</th>
                <th className="px-4 py-2">Mood</th>
                <th className="px-4 py-2">Sleep</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => (
                <tr key={d.date} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <Link href={`/?date=${d.date}`} className="font-medium text-indigo-700 hover:underline">
                      {formatDateHeading(d.date)}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-24">
                        <ProgressBar value={d.completion} />
                      </div>
                      <span className="text-xs text-slate-500">{d.completion}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-2">{d.energy ?? "—"}</td>
                  <td className="px-4 py-2">{d.mood ?? "—"}</td>
                  <td className="px-4 py-2">{d.sleepHours ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
