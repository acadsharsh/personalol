// ─────────────────────────────────────────────────────────────────────────────
// Lakshya JEE 2027 timetable — 4 rotating day-types, 13h/day framework.
// Fixed anchors: wake 06:00, lights-out 23:00, lectures 16:00 & 18:15 (live),
// the 3h (11th) / 10h (12th) split, and Sunday as rescue day.
// ─────────────────────────────────────────────────────────────────────────────

export type Category = "11th Study" | "12th Study" | "Health" | "Meal" | "Break";
export type Subject = "Physics" | "Chemistry" | "Maths" | "General";

export interface Slot {
  id: string;
  start: number; // minutes from 00:00 (may exceed 1440 for sleep crossing midnight)
  end: number;
  title: string;
  detail?: string;
  category: Category;
  subject?: Subject;
  grade?: 11 | 12;
  lecture?: "live" | "playback";
  priority?: boolean; // special / non-negotiable
}

export interface DayType {
  key: "mon_tue" | "wed_thu" | "fri_sat" | "sun";
  label: string;
  daysLabel: string;
  headline: string;
  slots: Slot[];
  totals: { eleventh: number; twelfth: number; study: number };
  note?: string;
}

export const SCHEDULE_START = "2026-06-29";
export const SCHEDULE_END = "2026-11-29";

// ── time helpers ────────────────────────────────────────────────────────────
export function t(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function fmt(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function slotMinutes(slot: Slot): number {
  return slot.end - slot.start;
}

export function durationLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

// ── shared building blocks ──────────────────────────────────────────────────
const WAKE: Slot = {
  id: "wake",
  start: t("06:00"),
  end: t("07:00"),
  title: "Wake-up routine",
  detail: "Bowel movement, brushing, bath, stretching — no rushing",
  category: "Health",
};

const BREAKFAST: Slot = {
  id: "breakfast",
  start: t("07:00"),
  end: t("07:15"),
  title: "Breakfast",
  category: "Meal",
};

const P11_THEORY: Slot = {
  id: "p11_theory",
  start: t("07:15"),
  end: t("07:55"),
  title: "11th Physics — New Concept Theory",
  category: "11th Study",
  subject: "Physics",
  grade: 11,
};

const P11_HW: Slot = {
  id: "p11_hw",
  start: t("07:55"),
  end: t("08:35"),
  title: "11th Physics — Immediate HW",
  detail: "Problem-solving while the concept is fresh",
  category: "11th Study",
  subject: "Physics",
  grade: 11,
};

const P11_REV: Slot = {
  id: "p11_rev",
  start: t("08:35"),
  end: t("09:15"),
  title: "11th Physics — Active Revision",
  detail: "Quick recall — beat the forgetting curve",
  category: "11th Study",
  subject: "Physics",
  grade: 11,
};

const C11_THEORY: Slot = {
  id: "c11_theory",
  start: t("09:15"),
  end: t("09:35"),
  title: "11th Chemistry — New Concept Theory",
  category: "11th Study",
  subject: "Chemistry",
  grade: 11,
};

const C11_HW: Slot = {
  id: "c11_hw",
  start: t("09:35"),
  end: t("09:55"),
  title: "11th Chemistry — Immediate HW",
  category: "11th Study",
  subject: "Chemistry",
  grade: 11,
};

const C11_REV: Slot = {
  id: "c11_rev",
  start: t("09:55"),
  end: t("10:15"),
  title: "11th Chemistry — Active Revision",
  category: "11th Study",
  subject: "Chemistry",
  grade: 11,
};

const LUNCH_1240: Slot = {
  id: "lunch",
  start: t("12:30"),
  end: t("13:10"),
  title: "Lunch",
  category: "Meal",
};

const REST: Slot = {
  id: "rest",
  start: t("13:10"),
  end: t("13:30"),
  title: "Digestive rest / short walk",
  category: "Break",
};

const BREAK_1515: Slot = {
  id: "break_1515",
  start: t("15:00"),
  end: t("15:15"),
  title: "Break — hydrate",
  category: "Break",
};

const BREAK_1745: Slot = {
  id: "break_1745",
  start: t("17:45"),
  end: t("18:00"),
  title: "Break — snack / hydrate",
  category: "Break",
};

const DINNER_2000: Slot = {
  id: "dinner",
  start: t("20:00"),
  end: t("20:40"),
  title: "Dinner",
  category: "Meal",
};

const WIND: Slot = {
  id: "wind",
  start: t("20:40"),
  end: t("21:00"),
  title: "Wind-down",
  category: "Break",
};

const FLASH: Slot = {
  id: "flash",
  start: t("22:30"),
  end: t("23:00"),
  title: "Flashcard Recap",
  detail: "11th + 12th spaced repetition",
  category: "12th Study",
  subject: "General",
  grade: 12,
};

const LIGHTS: Slot = {
  id: "lights",
  start: t("23:00"),
  end: t("06:00") + 24 * 60,
  title: "LIGHTS OUT — deep sleep",
  detail: "7h 00m — protects the whole week",
  category: "Health",
  priority: true,
};

const TRANSITION: Slot = {
  id: "transition",
  start: t("10:15"),
  end: t("10:30"),
  title: "Transition break — hydrate",
  category: "Break",
};

// ── Day-type 1: Monday & Tuesday ────────────────────────────────────────────
// Physics (Live) 16:00 → Chemistry (Live) 18:15
const monTue: DayType = {
  key: "mon_tue",
  label: "Monday & Tuesday",
  daysLabel: "Mon · Tue",
  headline: "Physics (Live) 4:00 PM → Chemistry (Live) 6:15 PM",
  totals: { eleventh: 180, twelfth: 600, study: 780 },
  slots: [
    WAKE,
    BREAKFAST,
    P11_THEORY,
    P11_HW,
    P11_REV,
    C11_THEORY,
    C11_HW,
    C11_REV,
    TRANSITION,
    {
      id: "prevhw1",
      start: t("10:30"),
      end: t("12:30"),
      title: "12th Previous-Day HW — Part 1",
      detail: "Effortful practice · Physics (Mon) / Chemistry (Tue)",
      category: "12th Study",
      grade: 12,
      subject: "Physics",
    },
    LUNCH_1240,
    REST,
    {
      id: "prevhw2",
      start: t("13:30"),
      end: t("15:00"),
      title: "12th Previous-Day HW — Part 2",
      detail: "Low-friction review, mistake correction",
      category: "12th Study",
      grade: 12,
      subject: "Physics",
    },
    BREAK_1515,
    {
      id: "prime_phy",
      start: t("15:15"),
      end: t("16:00"),
      title: "12th Physics — Pre-Lecture Priming",
      detail: "Skim notes, preview topic",
      category: "12th Study",
      subject: "Physics",
      grade: 12,
    },
    {
      id: "live_phy",
      start: t("16:00"),
      end: t("17:45"),
      title: "12th Physics — LIVE Lecture",
      category: "12th Study",
      subject: "Physics",
      grade: 12,
      lecture: "live",
      priority: true,
    },
    BREAK_1745,
    {
      id: "prime_chem",
      start: t("18:00"),
      end: t("18:15"),
      title: "12th Chemistry — Pre-Lecture Priming",
      category: "12th Study",
      subject: "Chemistry",
      grade: 12,
    },
    {
      id: "live_chem",
      start: t("18:15"),
      end: t("20:00"),
      title: "12th Chemistry — LIVE Lecture",
      category: "12th Study",
      subject: "Chemistry",
      grade: 12,
      lecture: "live",
      priority: true,
    },
    DINNER_2000,
    WIND,
    {
      id: "imm_hw",
      start: t("21:00"),
      end: t("22:30"),
      title: "12th Physics — Immediate HW",
      detail: "Subject A, same night — Physics (Mon/Tue)",
      category: "12th Study",
      subject: "Physics",
      grade: 12,
    },
    FLASH,
    LIGHTS,
  ],
};

// ── Day-type 2: Wednesday & Thursday ────────────────────────────────────────
// Extra Chemistry Playback 10:15 → Live Chemistry 16:00 → Live Maths 18:15
const wedThu: DayType = {
  key: "wed_thu",
  label: "Wednesday & Thursday",
  daysLabel: "Wed · Thu",
  headline: "3-Lecture Day — Chemistry Playback 10:15 AM → Live Chemistry 4:00 PM → Live Maths 6:15 PM",
  totals: { eleventh: 180, twelfth: 600, study: 780 },
  note: "Physics paused today — rescued Sunday. The 15:30 power nap is non-negotiable.",
  slots: [
    WAKE,
    BREAKFAST,
    P11_THEORY,
    P11_HW,
    P11_REV,
    C11_THEORY,
    C11_HW,
    C11_REV,
    {
      id: "extra_chem",
      start: t("10:15"),
      end: t("12:00"),
      title: "12th Chemistry — EXTRA Playback Lecture",
      detail: "Fills the Physics slot swapped out today",
      category: "12th Study",
      subject: "Chemistry",
      grade: 12,
      lecture: "playback",
      priority: true,
    },
    {
      id: "lunch",
      start: t("12:00"),
      end: t("12:40"),
      title: "Lunch",
      category: "Meal",
    },
    {
      id: "prevhw",
      start: t("12:40"),
      end: t("14:55"),
      title: "12th Previous-Day HW — Review & Light Practice",
      detail: "Chemistry (Wed) / Maths (Thu) · rework flagged questions, no fresh hard problems",
      category: "12th Study",
      grade: 12,
      subject: "Chemistry",
    },
    {
      id: "prime_chem",
      start: t("14:55"),
      end: t("15:10"),
      title: "12th Chemistry — Pre-Lecture Priming",
      category: "12th Study",
      subject: "Chemistry",
      grade: 12,
    },
    {
      id: "break_1510",
      start: t("15:10"),
      end: t("15:30"),
      title: "Break — wind down",
      category: "Break",
    },
    {
      id: "nap",
      start: t("15:30"),
      end: t("15:45"),
      title: "⚡ POWER NAP",
      detail: "Strict 15 min — set an alarm. Restores prefrontal alertness for 2 lectures + evening HW.",
      category: "Health",
      priority: true,
    },
    {
      id: "freshen",
      start: t("15:45"),
      end: t("16:00"),
      title: "Freshen up / re-activate",
      category: "Break",
    },
    {
      id: "live_chem",
      start: t("16:00"),
      end: t("17:45"),
      title: "12th Chemistry — LIVE Lecture",
      category: "12th Study",
      subject: "Chemistry",
      grade: 12,
      lecture: "live",
      priority: true,
    },
    BREAK_1745,
    {
      id: "prime_math",
      start: t("18:00"),
      end: t("18:15"),
      title: "12th Maths — Pre-Lecture Priming",
      category: "12th Study",
      subject: "Maths",
      grade: 12,
    },
    {
      id: "live_math",
      start: t("18:15"),
      end: t("20:00"),
      title: "12th Maths — LIVE Lecture",
      category: "12th Study",
      subject: "Maths",
      grade: 12,
      lecture: "live",
      priority: true,
    },
    DINNER_2000,
    WIND,
    {
      id: "imm_hw",
      start: t("21:00"),
      end: t("22:30"),
      title: "12th Chemistry — Immediate HW",
      detail: "Subject A, same night — Chemistry (Wed/Thu)",
      category: "12th Study",
      subject: "Chemistry",
      grade: 12,
    },
    FLASH,
    LIGHTS,
  ],
};

// ── Day-type 3: Friday & Saturday ───────────────────────────────────────────
// Chemistry (Live) 16:00 → Maths (Live) 18:15
const friSat: DayType = {
  key: "fri_sat",
  label: "Friday & Saturday",
  daysLabel: "Fri · Sat",
  headline: "Chemistry (Live) 4:00 PM → Maths (Live) 6:15 PM",
  totals: { eleventh: 180, twelfth: 600, study: 780 },
  slots: [
    WAKE,
    BREAKFAST,
    P11_THEORY,
    P11_HW,
    P11_REV,
    C11_THEORY,
    C11_HW,
    C11_REV,
    TRANSITION,
    {
      id: "prevhw1",
      start: t("10:30"),
      end: t("12:30"),
      title: "12th Maths — Previous-Day HW, Part 1",
      detail: "Effortful practice",
      category: "12th Study",
      subject: "Maths",
      grade: 12,
    },
    LUNCH_1240,
    REST,
    {
      id: "prevhw2",
      start: t("13:30"),
      end: t("15:00"),
      title: "12th Maths — Previous-Day HW, Part 2",
      detail: "Low-friction review",
      category: "12th Study",
      subject: "Maths",
      grade: 12,
    },
    BREAK_1515,
    {
      id: "prime_chem",
      start: t("15:15"),
      end: t("16:00"),
      title: "12th Chemistry — Pre-Lecture Priming",
      category: "12th Study",
      subject: "Chemistry",
      grade: 12,
    },
    {
      id: "live_chem",
      start: t("16:00"),
      end: t("17:45"),
      title: "12th Chemistry — LIVE Lecture",
      category: "12th Study",
      subject: "Chemistry",
      grade: 12,
      lecture: "live",
      priority: true,
    },
    BREAK_1745,
    {
      id: "prime_math",
      start: t("18:00"),
      end: t("18:15"),
      title: "12th Maths — Pre-Lecture Priming",
      category: "12th Study",
      subject: "Maths",
      grade: 12,
    },
    {
      id: "live_math",
      start: t("18:15"),
      end: t("20:00"),
      title: "12th Maths — LIVE Lecture",
      category: "12th Study",
      subject: "Maths",
      grade: 12,
      lecture: "live",
      priority: true,
    },
    DINNER_2000,
    WIND,
    {
      id: "imm_hw",
      start: t("21:00"),
      end: t("22:30"),
      title: "12th Chemistry — Immediate HW",
      detail: "Subject A, same night — Chemistry (Fri/Sat)",
      category: "12th Study",
      subject: "Chemistry",
      grade: 12,
    },
    FLASH,
    LIGHTS,
  ],
};

// ── Day-type 4: Sunday — Rescue & Consolidation ─────────────────────────────
const sunday: DayType = {
  key: "sun",
  label: "Sunday",
  daysLabel: "Sun",
  headline: "Rescue & Consolidation — 12th Physics catch-up in the AM · 11th Maths in the PM",
  totals: { eleventh: 180, twelfth: 600, study: 780 },
  note: "Same wake-up time as weekdays — protects the circadian rhythm.",
  slots: [
    WAKE,
    BREAKFAST,
    {
      id: "catch1",
      start: t("07:15"),
      end: t("09:00"),
      title: "12th Physics — Catch-up Playback",
      detail: "Missed Wednesday lecture",
      category: "12th Study",
      subject: "Physics",
      grade: 12,
      lecture: "playback",
      priority: true,
    },
    {
      id: "break_0900",
      start: t("09:00"),
      end: t("09:15"),
      title: "Break — hydrate, stretch",
      category: "Break",
    },
    {
      id: "catch2",
      start: t("09:15"),
      end: t("11:00"),
      title: "12th Physics — Catch-up Playback",
      detail: "Missed Thursday lecture",
      category: "12th Study",
      subject: "Physics",
      grade: 12,
      lecture: "playback",
      priority: true,
    },
    {
      id: "break_1100",
      start: t("11:00"),
      end: t("11:15"),
      title: "Break",
      category: "Break",
    },
    {
      id: "catch_hw1",
      start: t("11:15"),
      end: t("13:00"),
      title: "12th Physics — HW on catch-up lectures",
      detail: "Effortful, high-alertness window",
      category: "12th Study",
      subject: "Physics",
      grade: 12,
    },
    {
      id: "lunch",
      start: t("13:00"),
      end: t("13:45"),
      title: "Lunch",
      category: "Meal",
    },
    {
      id: "catch_hw2",
      start: t("13:45"),
      end: t("14:45"),
      title: "12th Physics — HW continued",
      detail: "Low-friction — review/consolidate only (dip window)",
      category: "12th Study",
      subject: "Physics",
      grade: 12,
    },
    {
      id: "break_1445",
      start: t("14:45"),
      end: t("15:00"),
      title: "Break",
      category: "Break",
    },
    {
      id: "m11_maths",
      start: t("15:00"),
      end: t("18:00"),
      title: "11th Maths — Theory + HW + Active Revision",
      detail: "The week's only Maths slot — continuous, clear of the post-lunch dip",
      category: "11th Study",
      subject: "Maths",
      grade: 11,
      priority: true,
    },
    {
      id: "break_1800",
      start: t("18:00"),
      end: t("18:15"),
      title: "Break",
      category: "Break",
    },
    {
      id: "prevhw_math",
      start: t("18:15"),
      end: t("19:45"),
      title: "12th Maths — Previous-Day HW",
      detail: "From Saturday's live lecture",
      category: "12th Study",
      subject: "Maths",
      grade: 12,
    },
    {
      id: "dinner",
      start: t("19:45"),
      end: t("20:30"),
      title: "Dinner",
      category: "Meal",
    },
    {
      id: "wind",
      start: t("20:30"),
      end: t("20:45"),
      title: "Wind-down",
      category: "Break",
    },
    {
      id: "backlog",
      start: t("20:45"),
      end: t("22:15"),
      title: "12th Chemistry/Maths — Weekly Backlog Clearance",
      detail: "Pending problem sets",
      category: "12th Study",
      subject: "General",
      grade: 12,
    },
    {
      id: "flash",
      start: t("22:15"),
      end: t("23:00"),
      title: "Flashcard Recap",
      detail: "Full-week spaced repetition, all 3 subjects",
      category: "12th Study",
      subject: "General",
      grade: 12,
    },
    LIGHTS,
  ],
};

export const DAY_TYPES: Record<DayType["key"], DayType> = {
  mon_tue: monTue,
  wed_thu: wedThu,
  fri_sat: friSat,
  sun: sunday,
};

// ── rotation mapping ────────────────────────────────────────────────────────
const WEEKDAY_TO_TYPE: DayType["key"][] = [
  "sun", // 0
  "mon_tue", // 1
  "mon_tue", // 2
  "wed_thu", // 3
  "wed_thu", // 4
  "fri_sat", // 5
  "fri_sat", // 6
];

/** Day-type key for a given ISO date (IST date string "YYYY-MM-DD"). */
export function getDayTypeKey(dateKey: string): DayType["key"] {
  const d = new Date(`${dateKey}T00:00:00Z`);
  return WEEKDAY_TO_TYPE[d.getUTCDay()];
}

export function getDayType(dateKey: string): DayType {
  return DAY_TYPES[getDayTypeKey(dateKey)];
}

// ── IST date helpers (all date keys are IST calendar dates) ─────────────────
const IST_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function istDateKey(d: Date = new Date()): string {
  return IST_FORMATTER.format(d);
}

export function addDays(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function weekdayName(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00Z`);
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d.getUTCDay()];
}

export function shortWeekday(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00Z`);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getUTCDay()];
}

export function prettyDate(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00Z`);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

export function isWithinScheduleWindow(dateKey: string): boolean {
  return dateKey >= SCHEDULE_START && dateKey <= SCHEDULE_END;
}

/** Current time-of-day in IST, in minutes from midnight. */
export function istNowMinutes(): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return h * 60 + m;
}

/** Slot that is active right now, if any. */
export function activeSlot(dayType: DayType, nowMinutes: number): Slot | null {
  for (const s of dayType.slots) {
    const end = s.end > 1440 ? s.end : s.end;
    if (nowMinutes >= s.start && nowMinutes < end) return s;
    if (s.end > 1440 && nowMinutes < s.end - 1440) return s; // sleep crosses midnight
  }
  return null;
}

// ── presentation helpers (shared server/client) ─────────────────────────────
export const CATEGORY_STYLE: Record<Category, { dot: string; chip: string; bar: string }> = {
  "12th Study": { dot: "bg-indigo-400", chip: "bg-indigo-500/15 text-indigo-300 border-indigo-500/30", bar: "bg-indigo-400" },
  "11th Study": { dot: "bg-emerald-400", chip: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", bar: "bg-emerald-400" },
  Health: { dot: "bg-amber-400", chip: "bg-amber-500/15 text-amber-300 border-amber-500/30", bar: "bg-amber-400" },
  Meal: { dot: "bg-rose-400", chip: "bg-rose-500/15 text-rose-300 border-rose-500/30", bar: "bg-rose-400" },
  Break: { dot: "bg-slate-400", chip: "bg-slate-500/15 text-slate-300 border-slate-500/30", bar: "bg-slate-400" },
};

export const SUBJECT_COLORS: Record<Subject, string> = {
  Physics: "#818cf8",
  Chemistry: "#34d399",
  Maths: "#f472b6",
  General: "#fbbf24",
};

export const ALL_SUBJECTS: { key: string; label: string; color: string }[] = [
  { key: "11:Physics", label: "11th Physics", color: "#34d399" },
  { key: "11:Chemistry", label: "11th Chemistry", color: "#2dd4bf" },
  { key: "11:Maths", label: "11th Maths", color: "#4ade80" },
  { key: "12:Physics", label: "12th Physics", color: "#818cf8" },
  { key: "12:Chemistry", label: "12th Chemistry", color: "#a78bfa" },
  { key: "12:Maths", label: "12th Maths", color: "#f472b6" },
  { key: "12:General", label: "12th General", color: "#fbbf24" },
];

/** Unique subject bucket key, e.g. "11:Physics". */
export function subjectKey(grade: 11 | 12 | undefined, subject: Subject | undefined): string | null {
  if (!grade || !subject) return null;
  return `${grade}:${subject}`;
}
