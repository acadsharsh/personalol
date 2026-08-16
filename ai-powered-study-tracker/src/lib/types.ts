export type SlotStatus = "done" | "partial" | "skipped" | "none";

export interface SlotView {
  id: string;
  start: number;
  end: number;
  title: string;
  detail?: string;
  category: string;
  subject?: string;
  grade?: 11 | 12;
  lecture?: "live" | "playback";
  priority?: boolean;
  duration: number;
  status: SlotStatus;
  loggedMinutes: number | null;
  notes: string;
}

export interface DayStatsView {
  studyPlanned: number;
  studyDone: number;
  adherence: number;
  doneSlots: number;
  totalStudySlots: number;
  skipped: number;
  partial: number;
  byGrade: { 11: { done: number; planned: number }; 12: { done: number; planned: number } };
  bySubject: Record<string, { planned: number; done: number; doneSlots: number; totalSlots: number }>;
}

export interface DayPayload {
  date: string;
  weekday: string;
  dayTypeKey: string;
  dayTypeLabel: string;
  headline: string;
  note: string | null;
  inWindow: boolean;
  nowMinutes: number;
  activeSlotId: string | null;
  slots: SlotView[];
  log: {
    wakeTime: string | null;
    sleepTime: string | null;
    energy: number | null;
    mood: string | null;
    notes: string;
  } | null;
  stats: DayStatsView;
  streak: number;
  week: { date: string; logged: boolean; adherence: number }[];
}

export interface StatsRow {
  date: string;
  weekday: string;
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
  bySubject: Record<string, { planned: number; done: number; doneSlots: number; totalSlots: number }>;
  byGrade: { 11: { done: number; planned: number }; 12: { done: number; planned: number } };
  energy: number | null;
  mood: string | null;
}

export interface StatsPayload {
  from: string;
  to: string;
  rows: StatsRow[];
  subjectTotals: Record<string, { planned: number; done: number; doneSlots: number; totalSlots: number }>;
  totals: {
    loggedDays: number;
    studyDone: number;
    studyPlanned: number;
    adherence: number;
    bestDay: string | null;
    worstDay: string | null;
  };
}

export interface InsightView {
  kind: "daily" | "weekly";
  date: string;
  content: string;
  provider: string;
}

export interface ChatMessageView {
  id: number;
  role: "user" | "assistant";
  content: string;
  provider: string | null;
  createdAt: string;
}
