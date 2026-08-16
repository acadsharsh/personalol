import { db } from "@/db";
import { dailyLogs } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ensureDailyLog } from "@/lib/db-helpers";
import { DAY_TYPE_LABEL, WEEKDAY_LABEL } from "@/lib/timetable-data";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json({ error: "Invalid date" }, { status: 400 });
  }
  const { log, blocks } = await ensureDailyLog(date);
  return Response.json({
    log,
    blocks,
    weekdayLabel: WEEKDAY_LABEL[log.weekday as keyof typeof WEEKDAY_LABEL],
    dayTypeLabel: DAY_TYPE_LABEL[log.weekday as keyof typeof DAY_TYPE_LABEL],
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const body = await req.json();
  const { log } = await ensureDailyLog(date);

  const updates: Partial<typeof dailyLogs.$inferInsert> = { updatedAt: new Date() };
  if ("wakeTime" in body) updates.wakeTime = body.wakeTime;
  if ("sleepHours" in body) updates.sleepHours = body.sleepHours === null ? null : String(body.sleepHours);
  if ("energy" in body) updates.energy = body.energy;
  if ("mood" in body) updates.mood = body.mood;
  if ("notes" in body) updates.notes = body.notes;

  const [updated] = await db.update(dailyLogs).set(updates).where(eq(dailyLogs.id, log.id)).returning();
  return Response.json({ log: updated });
}
