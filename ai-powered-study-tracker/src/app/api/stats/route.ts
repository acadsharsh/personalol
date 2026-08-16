import { db } from "@/db";
import { dayLogs, slotLogs } from "@/db/schema";
import { and, gte, inArray, lte } from "drizzle-orm";
import { NextResponse } from "next/server";
import { addDays, getDayType, istDateKey, shortWeekday } from "@/lib/timetable";
import { computeDayStats } from "@/lib/stats";
import { validateDate } from "@/app/api/day/route";

export const dynamic = "force-dynamic";

const MAX_RANGE = 31;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const today = istDateKey();
  let to = validateDate(url.searchParams.get("to")) ?? today;
  let from = validateDate(url.searchParams.get("from")) ?? addDays(to, -6);

  if (from > to) [from, to] = [to, from];
  const span = Math.floor((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86400000) + 1;
  if (span > MAX_RANGE) from = addDays(to, -(MAX_RANGE - 1));

  const dayRows = await db
    .select()
    .from(dayLogs)
    .where(and(gte(dayLogs.date, from), lte(dayLogs.date, to)));
  const slotRows = dayRows.length
    ? await db.select().from(slotLogs).where(inArray(slotLogs.dayLogId, dayRows.map((r) => r.id)))
    : [];

  const rows = [];
  for (let i = 0; ; i++) {
    const date = addDays(from, i);
    if (date > to) break;
    const row = dayRows.find((r) => r.date === date);
    const logs = row ? slotRows.filter((s) => s.dayLogId === row.id) : [];
    const dayType = getDayType(date);
    const stats = computeDayStats(dayType, logs);
    rows.push({
      date,
      weekday: shortWeekday(date),
      dayTypeKey: dayType.key,
      dayTypeLabel: dayType.label,
      logged: !!row,
      adherence: stats.adherence,
      studyDone: stats.studyDone,
      studyPlanned: stats.studyPlanned,
      doneSlots: stats.doneSlots,
      totalStudySlots: stats.totalStudySlots,
      skipped: stats.skipped,
      partial: stats.partial,
      bySubject: stats.bySubject,
      byGrade: stats.byGrade,
      energy: row?.energy ?? null,
      mood: row?.mood ?? null,
    });
  }

  // aggregate subject totals across the window
  const subjectTotals: Record<string, { planned: number; done: number; doneSlots: number; totalSlots: number }> = {};
  for (const r of rows) {
    if (!r.logged) continue;
    for (const [k, v] of Object.entries(r.bySubject)) {
      const cur = subjectTotals[k] ?? { planned: 0, done: 0, doneSlots: 0, totalSlots: 0 };
      cur.planned += v.planned;
      cur.done += v.done;
      cur.doneSlots += v.doneSlots;
      cur.totalSlots += v.totalSlots;
      subjectTotals[k] = cur;
    }
  }

  const logged = rows.filter((r) => r.logged);
  const totals = {
    loggedDays: logged.length,
    studyDone: logged.reduce((a, r) => a + r.studyDone, 0),
    studyPlanned: logged.reduce((a, r) => a + r.studyPlanned, 0),
    adherence: logged.length
      ? logged.reduce((a, r) => a + r.adherence, 0) / logged.length
      : 0,
    bestDay: logged.length ? [...logged].sort((a, b) => b.adherence - a.adherence)[0].date : null,
    worstDay: logged.length ? [...logged].sort((a, b) => a.adherence - b.adherence)[0].date : null,
  };

  return NextResponse.json({ from, to, rows, subjectTotals, totals });
}
