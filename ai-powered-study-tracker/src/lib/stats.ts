import type { SlotLog } from "@/db/schema";
import {
  type DayType,
  type Subject,
  fmt,
  slotMinutes,
  subjectKey,
  type Slot,
} from "@/lib/timetable";

export interface SubjectStat {
  planned: number;
  done: number;
  doneSlots: number;
  totalSlots: number;
}

export interface DayStats {
  studyPlanned: number;
  studyDone: number;
  adherence: number; // 0..1 (0 if no study logged)
  doneSlots: number;
  totalStudySlots: number;
  skipped: number;
  partial: number;
  byGrade: { 11: { done: number; planned: number }; 12: { done: number; planned: number } };
  bySubject: Record<string, SubjectStat>;
}

export function isStudySlot(s: Slot): boolean {
  return s.category === "11th Study" || s.category === "12th Study";
}

/** Minutes credited to a slot log. */
export function creditedMinutes(slot: Slot, log: SlotLog | undefined): number {
  if (!log) return 0;
  if (log.status === "done") return slotMinutes(slot);
  if (log.status === "partial") return Math.max(0, Math.min(log.minutes ?? Math.round(slotMinutes(slot) / 2), slotMinutes(slot)));
  return 0;
}

export function computeDayStats(dayType: DayType, logs: SlotLog[]): DayStats {
  const byId = new Map(logs.map((l) => [l.slotId, l]));
  const stats: DayStats = {
    studyPlanned: 0,
    studyDone: 0,
    adherence: 0,
    doneSlots: 0,
    totalStudySlots: 0,
    skipped: 0,
    partial: 0,
    byGrade: { 11: { done: 0, planned: 0 }, 12: { done: 0, planned: 0 } },
    bySubject: {},
  };
  for (const slot of dayType.slots) {
    if (!isStudySlot(slot)) continue;
    const planned = slotMinutes(slot);
    const log = byId.get(slot.id);
    const done = creditedMinutes(slot, log);
    stats.studyPlanned += planned;
    stats.studyDone += done;
    stats.totalStudySlots += 1;
    if (log?.status === "done") stats.doneSlots += 1;
    if (log?.status === "skipped") stats.skipped += 1;
    if (log?.status === "partial") stats.partial += 1;
    if (slot.grade) stats.byGrade[slot.grade].planned += planned;
    if (slot.grade) stats.byGrade[slot.grade].done += done;
    const key = subjectKey(slot.grade, slot.subject ?? "General");
    if (key) {
      const entry = stats.bySubject[key] ?? { planned: 0, done: 0, doneSlots: 0, totalSlots: 0 };
      entry.planned += planned;
      entry.done += done;
      entry.totalSlots += 1;
      if (log?.status === "done") entry.doneSlots += 1;
      stats.bySubject[key] = entry;
    }
  }
  if (stats.studyPlanned > 0) stats.adherence = stats.studyDone / stats.studyPlanned;
  return stats;
}

export interface DayRow {
  date: string;
  dayType: DayType;
  logged: boolean;
  stats: DayStats;
  energy: number | null;
  mood: string | null;
  wakeTime: string | null;
  sleepTime: string | null;
}

export interface SnapshotMissed {
  time: string;
  title: string;
  category: string;
  subject: Subject | null;
  grade: 11 | 12 | null;
}

export interface DaySnapshot {
  date: string;
  dayTypeKey: string;
  dayTypeLabel: string;
  logged: boolean;
  adherence: number;
  studyDone: number;
  studyPlanned: number;
  doneSlots: number;
  totalStudySlots: number;
  skipped: number;
  partial: number;
  bySubject: Record<string, SubjectStat>;
  missed: SnapshotMissed[];
  energy: number | null;
  mood: string | null;
  wakeTime: string | null;
  sleepTime: string | null;
}

/** Lightweight snapshot (used by the AI coach prompts). */
export function toSnapshot(row: DayRow): DaySnapshot {
  const missed: SnapshotMissed[] = [];
  return {
    date: row.date,
    dayTypeKey: row.dayType.key,
    dayTypeLabel: row.dayType.label,
    logged: row.logged,
    adherence: row.stats.adherence,
    studyDone: row.stats.studyDone,
    studyPlanned: row.stats.studyPlanned,
    doneSlots: row.stats.doneSlots,
    totalStudySlots: row.stats.totalStudySlots,
    skipped: row.stats.skipped,
    partial: row.stats.partial,
    bySubject: row.stats.bySubject,
    missed,
    energy: row.energy,
    mood: row.mood,
    wakeTime: row.wakeTime,
    sleepTime: row.sleepTime,
  };
}

export function fmtMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

export function pct(n: number): number {
  return Math.round(n * 100);
}

/** Consecutive days (ending today) with adherence >= threshold. */
export function computeStreak(rows: { date: string; adherence: number; logged: boolean }[], today: string, threshold = 0.75): number {
  const byDate = new Map(rows.map((r) => [r.date, r]));
  let streak = 0;
  let cursor = today;
  // If today isn't sufficiently completed yet, streak counts from yesterday.
  const t0 = byDate.get(today);
  if (!(t0 && t0.logged && t0.adherence >= threshold)) {
    cursor = addDaysLocal(today, -1);
  }
  for (let i = 0; i < 120; i++) {
    const r = byDate.get(cursor);
    if (!r || !r.logged || r.adherence < threshold) break;
    streak += 1;
    cursor = addDaysLocal(cursor, -1);
  }
  return streak;
}

function addDaysLocal(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function slotTimeRange(s: Slot): string {
  return `${fmt(s.start)} – ${fmt(s.end)}`;
}
