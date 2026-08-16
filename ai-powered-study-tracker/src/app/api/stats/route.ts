import { getAllDailyLogsWithBlocks } from "@/lib/db-helpers";
import { computeOverview, adaptiveSuggestions } from "@/lib/ai-mentor";

export const dynamic = "force-dynamic";

export async function GET() {
  const days = await getAllDailyLogsWithBlocks();
  const overview = computeOverview(days);
  const suggestions = adaptiveSuggestions(overview, days);
  return Response.json({
    overview,
    suggestions,
    days: days.map((d) => ({
      date: d.date,
      weekday: d.weekday,
      energy: d.energy,
      mood: d.mood,
      sleepHours: d.sleepHours,
      completion: d.blocks.length
        ? Math.round(
            (d.blocks.reduce((acc, b) => acc + (b.status === "done" ? 1 : b.status === "partial" ? 0.5 : 0), 0) / d.blocks.length) * 100,
          )
        : 0,
    })),
  });
}
