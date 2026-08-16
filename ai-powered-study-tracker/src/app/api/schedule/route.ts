import { db } from "@/db";
import { scheduleBlocks } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ensureScheduleSeeded, getBlocksForWeekday } from "@/lib/db-helpers";
import { WEEKDAYS } from "@/lib/timetable-data";

export const dynamic = "force-dynamic";

export async function GET() {
  await ensureScheduleSeeded();
  const grouped: Record<string, Awaited<ReturnType<typeof getBlocksForWeekday>>> = {};
  for (const w of WEEKDAYS) {
    grouped[w] = await getBlocksForWeekday(w);
  }
  return Response.json({ schedule: grouped });
}

export async function PATCH(req: Request) {
  const body = await req.json();
  const id = Number(body.id);
  if (!Number.isFinite(id)) {
    return Response.json({ error: "id is required" }, { status: 400 });
  }
  const updates: Partial<typeof scheduleBlocks.$inferInsert> = {};
  if ("activity" in body) updates.activity = body.activity;
  if ("startTime" in body) updates.startTime = body.startTime;
  if ("endTime" in body) updates.endTime = body.endTime;
  if ("plannedMinutes" in body) updates.plannedMinutes = body.plannedMinutes;

  const [updated] = await db.update(scheduleBlocks).set(updates).where(eq(scheduleBlocks.id, id)).returning();
  if (!updated) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ block: updated });
}
