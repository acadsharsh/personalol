import { db } from "@/db";
import { insights } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import {
  buildSnapshots,
  dailyInsightFallback,
  dailyInsightPrompt,
  dailyInsightSystem,
  weeklyInsightFallback,
  weeklyInsightPrompt,
  weeklyInsightSystem,
} from "@/lib/coach";
import { complete } from "@/lib/ai";
import { PROVIDER_LABEL } from "@/lib/ai-providers";
import { validateDate } from "@/app/api/day/route";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind") === "weekly" ? "weekly" : "daily";
  const date = validateDate(url.searchParams.get("date")) ?? new URL(req.url).searchParams.get("date");
  if (!date) return NextResponse.json({ insight: null });
  const [row] = await db
    .select()
    .from(insights)
    .where(and(eq(insights.kind, kind), eq(insights.date, date)))
    .limit(1);
  return NextResponse.json({ insight: row ?? null });
}

export async function POST(req: Request) {
  let body: { kind?: string; date?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const kind = body.kind === "weekly" ? "weekly" : "daily";
  const date = validateDate(body.date ?? null);
  if (!date) return NextResponse.json({ error: "invalid date" }, { status: 400 });

  const snaps = await buildSnapshots(date, kind === "weekly" ? 7 : 1);
  const snap = snaps[snaps.length - 1];

  const isWeekly = kind === "weekly";
  const system = isWeekly ? weeklyInsightSystem() : dailyInsightSystem();
  const userPrompt = isWeekly ? weeklyInsightPrompt(snaps) : dailyInsightPrompt(snap);
  const fallback = isWeekly ? weeklyInsightFallback(snaps) : dailyInsightFallback(snap);

  const { text, provider } = await complete({
    system,
    messages: [{ role: "user", content: userPrompt }],
    fallback,
  });

  const content = text.trim();
  if (content) {
    await db
      .insert(insights)
      .values({ kind, date, content, provider: PROVIDER_LABEL[provider] })
      .onConflictDoUpdate({
        target: [insights.kind, insights.date],
        set: { content, provider: PROVIDER_LABEL[provider] },
      });
  }

  return NextResponse.json({ insight: { kind, date, content, provider: PROVIDER_LABEL[provider] } });
}
