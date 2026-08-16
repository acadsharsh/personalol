import { db } from "@/db";
import { mentorMessages } from "@/db/schema";
import { asc } from "drizzle-orm";
import { getAllDailyLogsWithBlocks } from "@/lib/db-helpers";
import { computeOverview, generateMentorReply } from "@/lib/ai-mentor";

export const dynamic = "force-dynamic";

export async function GET() {
  const messages = await db.select().from(mentorMessages).orderBy(asc(mentorMessages.createdAt));
  return Response.json({ messages });
}

export async function POST(req: Request) {
  const body = await req.json();
  const message: string = (body.message ?? "").toString().trim();
  if (!message) {
    return Response.json({ error: "message is required" }, { status: 400 });
  }

  await db.insert(mentorMessages).values({ role: "user", content: message });

  const days = await getAllDailyLogsWithBlocks();
  const overview = computeOverview(days);
  const reply = generateMentorReply(message, overview, days);

  const [saved] = await db.insert(mentorMessages).values({ role: "assistant", content: reply }).returning();

  return Response.json({ reply: saved });
}
