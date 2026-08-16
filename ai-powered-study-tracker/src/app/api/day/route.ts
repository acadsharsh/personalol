import { db } from "@/db";
import { dayLogs, slotLogs } from "@/db/schema";
import { and, eq, gte, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import {
  addDays,
  getDayType,
  istDateKey,
  istNowMinutes,
  isWithinScheduleWindow,
  slotMinutes,
  weekdayName,
} from "@/lib/timetable";
import { computeDayStats, computeStreak } from "@/lib/stats";

export const dynamic = "force-dynamic";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validateDate(d: string | null): string | null {
  if (!d || !DATE_RE.test(d)) return null;
  const dt = new Date(`${d}T00:00:00Z`);
  return dt.toISOString().slice(0, 10) === d ? d : null;
}

interface DayPayload {
  date: string;
  weekday: string;
  dayTypeKey: string;
  dayTypeLabel: string;
  headline: string;
  note: string | null;
  inWindow: boolean;
  nowMinutes: number;
  activeSlotId: string | null;
  slots: unknown[];
  log: unknown;
  stats: unknown;
  streak: number;
  week: { date: string; logged: boolean; adherence: number }[];
}

async function buildPayload(date: string): Promise<DayPayload> {
  const dayType = getDayType(date);
  const [dayLogRow] = await db.select().from(dayLogs).where(eq(dayLogs.date, date)).limit(1);
  const logRows = dayLogRow
    ? await db.select().from(slotLogs).where(eq(slotLogs.dayLogId, dayLogRow.id))
    : [];
  const stats = computeDayStats(dayType, logRows);
  const logById = new Map(logRows.map((l) => [l.slotId, l]));

  // streak + last-7-days window
  const today = istDateKey();
  const since = addDays(today, -60);
  const dayRows = await db.select().from(dayLogs).where(gte(dayLogs.date, since));
  const slotRows = dayRows.length
    ? await db.select().from(slotLogs).where(inArray(slotLogs.dayLogId, dayRows.map((r) => r.id)))
    : [];

  const streakRows = dayRows.map((r) => {
    const st = computeDayStats(
      getDayType(r.date),
      slotRows.filter((s) => s.dayLogId === r.id)
    );
    return { date: r.date, adherence: st.adherence, logged: true };
  });
  const streak = computeStreak(streakRows, today);

  const nowMinutes = istNowMinutes();
  const slots = dayType.slots.map((s) => {
    const log = logById.get(s.id);
    return {
      ...s,
      duration: slotMinutes(s),
      status: log?.status ?? "none",
      loggedMinutes: log?.minutes ?? null,
      notes: log?.notes ?? "",
    };
  });

  const active = dayType.slots.find((s) => {
    if (s.end > 1440) return nowMinutes < s.end - 1440 || nowMinutes >= s.start;
    return nowMinutes >= s.start && nowMinutes < s.end;
  });

  const week: { date: string; logged: boolean; adherence: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = addDays(date, -i);
    const row = dayRows.find((r) => r.date === d);
    const logs = row ? slotRows.filter((s) => s.dayLogId === row.id) : [];
    const st = computeDayStats(getDayType(d), logs);
    week.push({ date: d, logged: !!row, adherence: st.adherence });
  }

  return {
    date,
    weekday: weekdayName(date),
    dayTypeKey: dayType.key,
    dayTypeLabel: dayType.label,
    headline: dayType.headline,
    note: dayType.note ?? null,
    inWindow: isWithinScheduleWindow(date),
    nowMinutes,
    activeSlotId: active?.id ?? null,
    slots,
    log: dayLogRow
      ? {
          wakeTime: dayLogRow.wakeTime,
          sleepTime: dayLogRow.sleepTime,
          energy: dayLogRow.energy,
          mood: dayLogRow.mood,
          notes: dayLogRow.notes ?? "",
        }
      : null,
    stats,
    streak,
    week,
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const date = validateDate(url.searchParams.get("date")) ?? istDateKey();
  return NextResponse.json(await buildPayload(date));
}

interface SaveBody {
  date?: string;
  fields?: {
    wakeTime?: string | null;
    sleepTime?: string | null;
    energy?: number | null;
    mood?: string | null;
    notes?: string | null;
  };
  slots?: {
    slotId: string;
    status: "done" | "partial" | "skipped" | "none";
    minutes?: number | null;
    notes?: string;
  }[];
}

export async function POST(req: Request) {
  let body: SaveBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const date = validateDate(body.date ?? null) ?? istDateKey();
  const dayType = getDayType(date);
  const validSlotIds = new Set(dayType.slots.map((s) => s.id));

  const now = new Date();
  const [existing] = await db.select().from(dayLogs).where(eq(dayLogs.date, date)).limit(1);
  const dayId = existing?.id ?? null;

  // upsert day log
  let dayLogRow = existing ?? null;
  if (dayId || body.fields) {
    const values = {
      date,
      wakeTime: body.fields?.wakeTime ?? existing?.wakeTime ?? null,
      sleepTime: body.fields?.sleepTime ?? existing?.sleepTime ?? null,
      energy: body.fields?.energy ?? existing?.energy ?? null,
      mood: body.fields?.mood ?? existing?.mood ?? null,
      notes: body.fields?.notes ?? existing?.notes ?? null,
    };
    if (dayId) {
      const [updated] = await db
        .update(dayLogs)
        .set({ ...values, updatedAt: now })
        .where(eq(dayLogs.id, dayId))
        .returning();
      dayLogRow = updated;
    } else {
      const [created] = await db.insert(dayLogs).values(values).returning();
      dayLogRow = created;
    }
  }

  // upsert / clear slot logs
  if (dayLogRow && Array.isArray(body.slots) && body.slots.length > 0) {
    for (const s of body.slots) {
      if (!validSlotIds.has(s.slotId)) continue;
      if (!["done", "partial", "skipped", "none"].includes(s.status)) continue;
      if (s.status === "none") {
        await db
          .delete(slotLogs)
          .where(and(eq(slotLogs.dayLogId, dayLogRow.id), eq(slotLogs.slotId, s.slotId)));
        continue;
      }
      await db
        .insert(slotLogs)
        .values({
          dayLogId: dayLogRow.id,
          slotId: s.slotId,
          status: s.status,
          minutes: s.minutes ?? null,
          notes: s.notes ?? null,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: [slotLogs.dayLogId, slotLogs.slotId],
          set: {
            status: s.status,
            minutes: s.minutes ?? null,
            notes: s.notes ?? null,
            updatedAt: now,
          },
        });
    }
  }

  return NextResponse.json(await buildPayload(date));
}
