export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export type Category = "health" | "meal" | "break" | "study_11" | "study_12";
export type Subject = "physics" | "chemistry" | "maths" | "mixed" | null;
export type Grade = "11" | "12" | null;

export interface BlockTemplateInput {
  start: string;
  end: string;
  activity: string;
  category: Category;
  subject: Subject;
  grade: Grade;
  minutes: number;
  isLecture?: boolean;
}

export const WEEKDAYS: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export const WEEKDAY_LABEL: Record<Weekday, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

export const DAY_TYPE_LABEL: Record<Weekday, string> = {
  mon: "Physics → Chemistry Live Day",
  tue: "Physics → Chemistry Live Day",
  wed: "3-Lecture Chemistry-Priority Day",
  thu: "3-Lecture Chemistry-Priority Day",
  fri: "Chemistry → Maths Live Day",
  sat: "Chemistry → Maths Live Day",
  sun: "Rescue & Consolidation Day",
};

// Shared 06:00–10:15 morning block (11th grade Physics + Chemistry), identical
// Mon/Tue/Wed/Thu/Fri/Sat.
const MORNING_BLOCK: BlockTemplateInput[] = [
  { start: "06:00", end: "07:00", activity: "Wake-up routine: bowel movement, brushing, bath, stretching — no rushing", category: "health", subject: null, grade: null, minutes: 60 },
  { start: "07:00", end: "07:15", activity: "Breakfast", category: "meal", subject: null, grade: null, minutes: 15 },
  { start: "07:15", end: "07:55", activity: "11th Physics — New Concept Theory", category: "study_11", subject: "physics", grade: "11", minutes: 40 },
  { start: "07:55", end: "08:35", activity: "11th Physics — Immediate HW (problem-solving)", category: "study_11", subject: "physics", grade: "11", minutes: 40 },
  { start: "08:35", end: "09:15", activity: "11th Physics — Active Revision (quick recall)", category: "study_11", subject: "physics", grade: "11", minutes: 40 },
  { start: "09:15", end: "09:35", activity: "11th Chemistry — New Concept Theory", category: "study_11", subject: "chemistry", grade: "11", minutes: 20 },
  { start: "09:35", end: "09:55", activity: "11th Chemistry — Immediate HW", category: "study_11", subject: "chemistry", grade: "11", minutes: 20 },
  { start: "09:55", end: "10:15", activity: "11th Chemistry — Active Revision", category: "study_11", subject: "chemistry", grade: "11", minutes: 20 },
];

function monTue(hwSubject: "physics" | "chemistry"): BlockTemplateInput[] {
  const label = hwSubject === "physics" ? "Physics" : "Chemistry";
  return [
    ...MORNING_BLOCK,
    { start: "10:15", end: "10:30", activity: "Transition break — hydrate", category: "break", subject: null, grade: null, minutes: 15 },
    { start: "10:30", end: "12:30", activity: `12th ${label} — Previous-Day HW, Part 1 (effortful practice)`, category: "study_12", subject: hwSubject, grade: "12", minutes: 120 },
    { start: "12:30", end: "13:10", activity: "Lunch", category: "meal", subject: null, grade: null, minutes: 40 },
    { start: "13:10", end: "13:30", activity: "Digestive rest / short walk", category: "break", subject: null, grade: null, minutes: 20 },
    { start: "13:30", end: "15:00", activity: `12th ${label} — Previous-Day HW, Part 2 (low-friction review, mistake correction)`, category: "study_12", subject: hwSubject, grade: "12", minutes: 90 },
    { start: "15:00", end: "15:15", activity: "Break — hydrate", category: "break", subject: null, grade: null, minutes: 15 },
    { start: "15:15", end: "16:00", activity: "12th Physics — Pre-Lecture Priming (skim notes, preview topic)", category: "study_12", subject: "physics", grade: "12", minutes: 45 },
    { start: "16:00", end: "17:45", activity: "12th Physics — LIVE Lecture", category: "study_12", subject: "physics", grade: "12", minutes: 105, isLecture: true },
    { start: "17:45", end: "18:00", activity: "Break — snack/hydrate", category: "break", subject: null, grade: null, minutes: 15 },
    { start: "18:00", end: "18:15", activity: "12th Chemistry — Pre-Lecture Priming", category: "study_12", subject: "chemistry", grade: "12", minutes: 15 },
    { start: "18:15", end: "20:00", activity: "12th Chemistry — LIVE Lecture", category: "study_12", subject: "chemistry", grade: "12", minutes: 105, isLecture: true },
    { start: "20:00", end: "20:40", activity: "Dinner", category: "meal", subject: null, grade: null, minutes: 40 },
    { start: "20:40", end: "21:00", activity: "Wind-down", category: "break", subject: null, grade: null, minutes: 20 },
    { start: "21:00", end: "22:30", activity: "12th Physics — Immediate HW (Subject A, same night)", category: "study_12", subject: "physics", grade: "12", minutes: 90 },
    { start: "22:30", end: "23:00", activity: "Flashcard Recap — 11th + 12th spaced repetition", category: "study_12", subject: "mixed", grade: "12", minutes: 30 },
    { start: "23:00", end: "06:00", activity: "LIGHTS OUT — deep sleep", category: "health", subject: null, grade: null, minutes: 420 },
  ];
}

function wedThu(reviewSubject: "chemistry" | "maths"): BlockTemplateInput[] {
  const label = reviewSubject === "chemistry" ? "Chemistry" : "Maths";
  return [
    ...MORNING_BLOCK,
    { start: "10:15", end: "12:00", activity: "12th Chemistry — EXTRA Playback Lecture (fills the Physics slot swapped out today)", category: "study_12", subject: "chemistry", grade: "12", minutes: 105, isLecture: true },
    { start: "12:00", end: "12:40", activity: "Lunch", category: "meal", subject: null, grade: null, minutes: 40 },
    { start: "12:40", end: "14:55", activity: `12th ${label} — Previous-Day HW: Review & Light Practice (kept low-friction, rework flagged questions, no fresh hard problems)`, category: "study_12", subject: reviewSubject, grade: "12", minutes: 135 },
    { start: "14:55", end: "15:10", activity: "12th Chemistry — Pre-Lecture Priming", category: "study_12", subject: "chemistry", grade: "12", minutes: 15 },
    { start: "15:10", end: "15:30", activity: "Break — wind down", category: "break", subject: null, grade: null, minutes: 20 },
    { start: "15:30", end: "15:45", activity: "⚡ POWER NAP (strict 15 min — set an alarm)", category: "health", subject: null, grade: null, minutes: 15 },
    { start: "15:45", end: "16:00", activity: "Freshen up / re-activate", category: "break", subject: null, grade: null, minutes: 15 },
    { start: "16:00", end: "17:45", activity: "12th Chemistry — LIVE Lecture", category: "study_12", subject: "chemistry", grade: "12", minutes: 105, isLecture: true },
    { start: "17:45", end: "18:00", activity: "Break — snack/hydrate", category: "break", subject: null, grade: null, minutes: 15 },
    { start: "18:00", end: "18:15", activity: "12th Maths — Pre-Lecture Priming", category: "study_12", subject: "maths", grade: "12", minutes: 15 },
    { start: "18:15", end: "20:00", activity: "12th Maths — LIVE Lecture", category: "study_12", subject: "maths", grade: "12", minutes: 105, isLecture: true },
    { start: "20:00", end: "20:40", activity: "Dinner", category: "meal", subject: null, grade: null, minutes: 40 },
    { start: "20:40", end: "21:00", activity: "Wind-down", category: "break", subject: null, grade: null, minutes: 20 },
    { start: "21:00", end: "22:30", activity: "12th Chemistry — Immediate HW (Subject A, same night)", category: "study_12", subject: "chemistry", grade: "12", minutes: 90 },
    { start: "22:30", end: "23:00", activity: "Flashcard Recap", category: "study_12", subject: "mixed", grade: "12", minutes: 30 },
    { start: "23:00", end: "06:00", activity: "LIGHTS OUT — deep sleep", category: "health", subject: null, grade: null, minutes: 420 },
  ];
}

function friSat(): BlockTemplateInput[] {
  return [
    ...MORNING_BLOCK,
    { start: "10:15", end: "10:30", activity: "Transition break", category: "break", subject: null, grade: null, minutes: 15 },
    { start: "10:30", end: "12:30", activity: "12th Maths — Previous-Day HW, Part 1 (effortful practice)", category: "study_12", subject: "maths", grade: "12", minutes: 120 },
    { start: "12:30", end: "13:10", activity: "Lunch", category: "meal", subject: null, grade: null, minutes: 40 },
    { start: "13:10", end: "13:30", activity: "Digestive rest", category: "break", subject: null, grade: null, minutes: 20 },
    { start: "13:30", end: "15:00", activity: "12th Maths — Previous-Day HW, Part 2 (low-friction review)", category: "study_12", subject: "maths", grade: "12", minutes: 90 },
    { start: "15:00", end: "15:15", activity: "Break", category: "break", subject: null, grade: null, minutes: 15 },
    { start: "15:15", end: "16:00", activity: "12th Chemistry — Pre-Lecture Priming", category: "study_12", subject: "chemistry", grade: "12", minutes: 45 },
    { start: "16:00", end: "17:45", activity: "12th Chemistry — LIVE Lecture", category: "study_12", subject: "chemistry", grade: "12", minutes: 105, isLecture: true },
    { start: "17:45", end: "18:00", activity: "Break", category: "break", subject: null, grade: null, minutes: 15 },
    { start: "18:00", end: "18:15", activity: "12th Maths — Pre-Lecture Priming", category: "study_12", subject: "maths", grade: "12", minutes: 15 },
    { start: "18:15", end: "20:00", activity: "12th Maths — LIVE Lecture", category: "study_12", subject: "maths", grade: "12", minutes: 105, isLecture: true },
    { start: "20:00", end: "20:40", activity: "Dinner", category: "meal", subject: null, grade: null, minutes: 40 },
    { start: "20:40", end: "21:00", activity: "Wind-down", category: "break", subject: null, grade: null, minutes: 20 },
    { start: "21:00", end: "22:30", activity: "12th Chemistry — Immediate HW (Subject A, same night)", category: "study_12", subject: "chemistry", grade: "12", minutes: 90 },
    { start: "22:30", end: "23:00", activity: "Flashcard Recap", category: "study_12", subject: "mixed", grade: "12", minutes: 30 },
    { start: "23:00", end: "06:00", activity: "LIGHTS OUT — deep sleep", category: "health", subject: null, grade: null, minutes: 420 },
  ];
}

function sunday(): BlockTemplateInput[] {
  return [
    { start: "06:00", end: "07:00", activity: "Wake-up routine — same clock-time as weekdays, protects circadian rhythm", category: "health", subject: null, grade: null, minutes: 60 },
    { start: "07:00", end: "07:15", activity: "Breakfast", category: "meal", subject: null, grade: null, minutes: 15 },
    { start: "07:15", end: "09:00", activity: "12th Physics — Catch-up Playback, missed Wednesday lecture", category: "study_12", subject: "physics", grade: "12", minutes: 105, isLecture: true },
    { start: "09:00", end: "09:15", activity: "Break — hydrate, stretch", category: "break", subject: null, grade: null, minutes: 15 },
    { start: "09:15", end: "11:00", activity: "12th Physics — Catch-up Playback, missed Thursday lecture", category: "study_12", subject: "physics", grade: "12", minutes: 105, isLecture: true },
    { start: "11:00", end: "11:15", activity: "Break", category: "break", subject: null, grade: null, minutes: 15 },
    { start: "11:15", end: "13:00", activity: "12th Physics — HW/Practice on catch-up lectures (effortful, high-alertness)", category: "study_12", subject: "physics", grade: "12", minutes: 105 },
    { start: "13:00", end: "13:45", activity: "Lunch", category: "meal", subject: null, grade: null, minutes: 45 },
    { start: "13:45", end: "14:45", activity: "12th Physics — HW/Practice continued, kept low-friction (dip window)", category: "study_12", subject: "physics", grade: "12", minutes: 60 },
    { start: "14:45", end: "15:00", activity: "Break", category: "break", subject: null, grade: null, minutes: 15 },
    { start: "15:00", end: "18:00", activity: "11th Maths — Theory + HW + Active Revision (continuous — the week's only Maths slot)", category: "study_11", subject: "maths", grade: "11", minutes: 180 },
    { start: "18:00", end: "18:15", activity: "Break", category: "break", subject: null, grade: null, minutes: 15 },
    { start: "18:15", end: "19:45", activity: "12th Maths — Previous-Day HW (from Saturday's live lecture)", category: "study_12", subject: "maths", grade: "12", minutes: 90 },
    { start: "19:45", end: "20:30", activity: "Dinner", category: "meal", subject: null, grade: null, minutes: 45 },
    { start: "20:30", end: "20:45", activity: "Wind-down", category: "break", subject: null, grade: null, minutes: 15 },
    { start: "20:45", end: "22:15", activity: "12th Chemistry/Maths — Weekly Backlog Clearance (pending problem sets)", category: "study_12", subject: "mixed", grade: "12", minutes: 90 },
    { start: "22:15", end: "23:00", activity: "Flashcard Recap — full-week spaced repetition, all 3 subjects", category: "study_12", subject: "mixed", grade: "12", minutes: 45 },
    { start: "23:00", end: "06:00", activity: "LIGHTS OUT — deep sleep", category: "health", subject: null, grade: null, minutes: 420 },
  ];
}

export const TIMETABLE: Record<Weekday, BlockTemplateInput[]> = {
  mon: monTue("physics"),
  tue: monTue("chemistry"),
  wed: wedThu("chemistry"),
  thu: wedThu("maths"),
  fri: friSat(),
  sat: friSat(),
  sun: sunday(),
};

export function getWeekdayKey(date: Date): Weekday {
  const idx = date.getDay(); // 0=Sun..6=Sat
  const map: Weekday[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  return map[idx];
}

export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
