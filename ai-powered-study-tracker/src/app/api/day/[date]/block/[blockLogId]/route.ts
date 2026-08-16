import { db } from "@/db";
import { blockLogs } from "@/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

const VALID_STATUS = new Set(["pending", "done", "partial", "skipped"]);

export async function PATCH(req: Request, { params }: { params: Promise<{ date: string; blockLogId: string }> }) {
  const { blockLogId } = await params;
  const id = Number(blockLogId);
  if (!Number.isFinite(id)) {
    return Response.json({ error: "Invalid block log id" }, { status: 400 });
  }
  const body = await req.json();

  const updates: Partial<typeof blockLogs.$inferInsert> = { updatedAt: new Date() };
  if ("status" in body) {
    if (!VALID_STATUS.has(body.status)) {
      return Response.json({ error: "Invalid status" }, { status: 400 });
    }
    updates.status = body.status;
  }
  if ("actualMinutes" in body) updates.actualMinutes = body.actualMinutes;
  if ("focus" in body) updates.focus = body.focus;
  if ("note" in body) updates.note = body.note;

  const [updated] = await db.update(blockLogs).set(updates).where(eq(blockLogs.id, id)).returning();
  if (!updated) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ blockLog: updated });
}
