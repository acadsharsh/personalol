import { getAllDailyLogsWithBlocks } from "@/lib/db-helpers";
import { computeOverview, generateDailyInsight, tomorrowFocus } from "@/lib/ai-mentor";
import { WEEKDAY_LABEL, getWeekdayKey } from "@/lib/timetable-data";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return Response.json({ error: "date query param required, format YYYY-MM-DD" }, { status: 400 });
  }

  const days = await getAllDailyLogsWithBlocks();
  const overview = computeOverview(days);
  const today = days.find((d) => d.date === date);

  if (!today) {
    return Response.json({ insights: ["No data logged for this date yet."], focus: null });
  }

  const insights = generateDailyInsight(today, overview);
  const nextDate = new Date(date + "T00:00:00");
  nextDate.setDate(nextDate.getDate() + 1);
  const nextWeekday = getWeekdayKey(nextDate);
  const focus = tomorrowFocus(WEEKDAY_LABEL[nextWeekday], overview);

  return Response.json({ insights, focus, overview });
}
