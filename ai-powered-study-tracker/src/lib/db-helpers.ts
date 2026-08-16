import { db } from "@/db";
import { scheduleBlocks, dailyLogs, blockLogs } from "@/db/schema";
import { eq, asc, and } from "drizzle-orm";
import { TIMETABLE, WEEKDAYS, getWeekdayKey } from "@/lib/timetable-data";
import type { DailyLogRow } from "@/lib/ai-mentor";

export async function ensureScheduleSeeded() {
  const existing = await db.select({ id: scheduleBlocks.id }).from(scheduleBlocks).limit(1);
  if (existing.length > 0) return;

  const rows: (typeof scheduleBlocks.$inferInsert)[] = [];
  for (const weekday of WEEKDAYS) {
    const blocks = TIMETABLE[weekday];
    blocks.forEach((b, idx) => {
      rows.push({
        weekday,
        orderIndex: idx,
        startTime: b.start,
        endTime: b.end,
        activity: b.activity,
        category: b.category,
        subject: b.subject,
        grade: b.grade,
        plannedMinutes: b.minutes,
        isLecture: b.isLecture ?? false,
      });
    });
  }
  await db.insert(scheduleBlocks).values(rows);
}

export async function getBlocksForWeekday(weekday: string) {
  return db
    .select()
    .from(scheduleBlocks)
    .where(eq(scheduleBlocks.weekday, weekday))
    .orderBy(asc(scheduleBlocks.orderIndex));
}

export async function ensureDailyLog(dateKey: string) {
  await ensureScheduleSeeded();
  const weekday = getWeekdayKey(new Date(dateKey + "T00:00:00"));

  let [log] = await db.select().from(dailyLogs).where(eq(dailyLogs.date, dateKey)).limit(1);
  if (!log) {
    const inserted = await db
      .insert(dailyLogs)
      .values({ date: dateKey, weekday })
      .onConflictDoNothing()
      .returning();
    if (inserted[0]) {
      log = inserted[0];
    } else {
      [log] = await db.select().from(dailyLogs).where(eq(dailyLogs.date, dateKey)).limit(1);
    }
  }

  const templateBlocks = await getBlocksForWeekday(weekday);
  const existingBlockLogs = await db.select().from(blockLogs).where(eq(blockLogs.dailyLogId, log.id));
  const existingIds = new Set(existingBlockLogs.map((b) => b.scheduleBlockId));
  const missing = templateBlocks.filter((tb) => !existingIds.has(tb.id));
  if (missing.length > 0) {
    await db
      .insert(blockLogs)
      .values(missing.map((tb) => ({ dailyLogId: log.id, scheduleBlockId: tb.id })))
      .onConflictDoNothing();
  }

  const allBlockLogs = await db.select().from(blockLogs).where(eq(blockLogs.dailyLogId, log.id));
  const blockMap = new Map(templateBlocks.map((tb) => [tb.id, tb]));

  const merged = allBlockLogs
    .map((bl) => {
      const tb = blockMap.get(bl.scheduleBlockId);
      if (!tb) return null;
      return {
        id: bl.id,
        scheduleBlockId: bl.scheduleBlockId,
        status: bl.status as "pending" | "done" | "partial" | "skipped",
        actualMinutes: bl.actualMinutes,
        focus: bl.focus,
        note: bl.note,
        activity: tb.activity,
        category: tb.category,
        subject: tb.subject,
        grade: tb.grade,
        plannedMinutes: tb.plannedMinutes,
        isLecture: tb.isLecture,
        startTime: tb.startTime,
        endTime: tb.endTime,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => a.startTime.localeCompare(b.startTime) || blockMap.get(a.scheduleBlockId)!.orderIndex - blockMap.get(b.scheduleBlockId)!.orderIndex);

  return { log, blocks: merged };
}

export async function getAllDailyLogsWithBlocks(): Promise<DailyLogRow[]> {
  await ensureScheduleSeeded();
  const logs = await db.select().from(dailyLogs).orderBy(asc(dailyLogs.date));
  const allBlockLogs = await db.select().from(blockLogs);
  const allTemplates = await db.select().from(scheduleBlocks);
  const templateById = new Map(allTemplates.map((t) => [t.id, t]));

  return logs.map((log) => {
    const blocks = allBlockLogs
      .filter((bl) => bl.dailyLogId === log.id)
      .map((bl) => {
        const tb = templateById.get(bl.scheduleBlockId);
        if (!tb) return null;
        return {
          id: bl.id,
          scheduleBlockId: bl.scheduleBlockId,
          status: bl.status as "pending" | "done" | "partial" | "skipped",
          actualMinutes: bl.actualMinutes,
          focus: bl.focus,
          note: bl.note,
          activity: tb.activity,
          category: tb.category,
          subject: tb.subject,
          grade: tb.grade,
          plannedMinutes: tb.plannedMinutes,
          isLecture: tb.isLecture,
          startTime: tb.startTime,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    return {
      id: log.id,
      date: log.date,
      weekday: log.weekday,
      wakeTime: log.wakeTime,
      sleepHours: log.sleepHours,
      energy: log.energy,
      mood: log.mood,
      notes: log.notes,
      blocks,
    };
  });
}
