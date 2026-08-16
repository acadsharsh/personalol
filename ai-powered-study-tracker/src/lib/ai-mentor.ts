// A deterministic, data-driven "AI mentor" engine. No external LLM call is
// required — every insight and reply is generated from the student's own
// logged data using heuristics grounded in the psychology behind the plan
// (forgetting curve, circadian dip, blocked vs interleaved practice, etc.)

export interface BlockLogRow {
  id: number;
  scheduleBlockId: number;
  status: "pending" | "done" | "partial" | "skipped";
  actualMinutes: number | null;
  focus: number | null;
  note: string | null;
  activity: string;
  category: string;
  subject: string | null;
  grade: string | null;
  plannedMinutes: number;
  isLecture: boolean;
  startTime: string;
}

export interface DailyLogRow {
  id: number;
  date: string;
  weekday: string;
  wakeTime: string | null;
  sleepHours: string | null;
  energy: number | null;
  mood: number | null;
  notes: string | null;
  blocks: BlockLogRow[];
}

export interface Overview {
  totalDaysLogged: number;
  currentStreak: number;
  bestStreak: number;
  overallCompletionRate: number; // 0-100
  categoryCompletion: Record<string, number>;
  subjectCompletion: Record<string, number>;
  avgEnergy: number | null;
  avgMood: number | null;
  avgSleep: number | null;
  trend: "improving" | "declining" | "steady" | "insufficient-data";
  weakestSubject: string | null;
  strongestSubject: string | null;
  mostSkippedActivity: { activity: string; skipCount: number } | null;
  napSkipRate: number | null; // Wed/Thu power-nap adherence
  lectureAdherence: number; // % of lecture blocks marked done
  totalBlocksLogged: number;
  totalDoneOrPartial: number;
}

function completionScore(status: string): number {
  if (status === "done") return 1;
  if (status === "partial") return 0.5;
  return 0;
}

function dayCompletionRate(day: DailyLogRow): number {
  const scored = day.blocks.filter((b) => b.status !== "pending");
  if (scored.length === 0) return 0;
  const sum = day.blocks.reduce((acc, b) => acc + completionScore(b.status), 0);
  return (sum / day.blocks.length) * 100;
}

export function computeOverview(days: DailyLogRow[]): Overview {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));

  const categoryTotals: Record<string, { sum: number; count: number }> = {};
  const subjectTotals: Record<string, { sum: number; count: number }> = {};
  const activitySkips: Record<string, number> = {};
  let lectureDone = 0;
  let lectureTotal = 0;
  let napDone = 0;
  let napTotal = 0;
  let totalBlocksLogged = 0;
  let totalDoneOrPartial = 0;
  let overallSum = 0;
  let overallCount = 0;

  const energies: number[] = [];
  const moods: number[] = [];
  const sleeps: number[] = [];

  for (const day of sorted) {
    if (day.energy != null) energies.push(day.energy);
    if (day.mood != null) moods.push(day.mood);
    if (day.sleepHours != null) sleeps.push(Number(day.sleepHours));

    for (const b of day.blocks) {
      if (b.category === "break" || b.category === "meal") continue;
      totalBlocksLogged += 1;
      const score = completionScore(b.status);
      overallSum += score;
      overallCount += 1;
      if (b.status === "done" || b.status === "partial") totalDoneOrPartial += 1;

      categoryTotals[b.category] ??= { sum: 0, count: 0 };
      categoryTotals[b.category].sum += score;
      categoryTotals[b.category].count += 1;

      if (b.subject) {
        subjectTotals[b.subject] ??= { sum: 0, count: 0 };
        subjectTotals[b.subject].sum += score;
        subjectTotals[b.subject].count += 1;
      }

      if (b.isLecture) {
        lectureTotal += 1;
        if (b.status === "done") lectureDone += 1;
      }

      if (b.activity.includes("POWER NAP")) {
        napTotal += 1;
        if (b.status === "done") napDone += 1;
      }

      if (b.status === "skipped") {
        activitySkips[b.activity] = (activitySkips[b.activity] ?? 0) + 1;
      }
    }
  }

  const categoryCompletion: Record<string, number> = {};
  for (const [k, v] of Object.entries(categoryTotals)) {
    categoryCompletion[k] = v.count ? Math.round((v.sum / v.count) * 100) : 0;
  }
  const subjectCompletion: Record<string, number> = {};
  for (const [k, v] of Object.entries(subjectTotals)) {
    subjectCompletion[k] = v.count ? Math.round((v.sum / v.count) * 100) : 0;
  }

  // streaks: a day "counts" if its completion rate >= 50%
  let currentStreak = 0;
  let bestStreak = 0;
  let running = 0;
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  for (const day of sorted) {
    const rate = dayCompletionRate(day);
    if (rate >= 50) {
      running += 1;
      bestStreak = Math.max(bestStreak, running);
    } else {
      running = 0;
    }
  }
  // current streak = trailing run ending at the most recent logged day (today or yesterday)
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    const rate = dayCompletionRate(sorted[i]);
    if (rate >= 50) currentStreak += 1;
    else break;
  }
  // if the most recent log isn't today/yesterday, treat streak as broken
  if (sorted.length > 0) {
    const last = sorted[sorted.length - 1].date;
    const lastDate = new Date(last + "T00:00:00");
    const diffDays = Math.round((new Date(todayKey + "T00:00:00").getTime() - lastDate.getTime()) / 86400000);
    if (diffDays > 1) currentStreak = 0;
  }

  let weakestSubject: string | null = null;
  let strongestSubject: string | null = null;
  let minRate = Infinity;
  let maxRate = -Infinity;
  for (const [subject, rate] of Object.entries(subjectCompletion)) {
    if (subject === "mixed") continue;
    if (rate < minRate) {
      minRate = rate;
      weakestSubject = subject;
    }
    if (rate > maxRate) {
      maxRate = rate;
      strongestSubject = subject;
    }
  }

  let mostSkippedActivity: { activity: string; skipCount: number } | null = null;
  for (const [activity, count] of Object.entries(activitySkips)) {
    if (!mostSkippedActivity || count > mostSkippedActivity.skipCount) {
      mostSkippedActivity = { activity, skipCount: count };
    }
  }

  // trend: compare last 7 logged days vs previous 7
  let trend: Overview["trend"] = "insufficient-data";
  if (sorted.length >= 4) {
    const recent = sorted.slice(-7);
    const prior = sorted.slice(-14, -7);
    if (prior.length > 0) {
      const recentAvg = recent.reduce((a, d) => a + dayCompletionRate(d), 0) / recent.length;
      const priorAvg = prior.reduce((a, d) => a + dayCompletionRate(d), 0) / prior.length;
      const diff = recentAvg - priorAvg;
      trend = diff > 5 ? "improving" : diff < -5 ? "declining" : "steady";
    } else if (recent.length >= 3) {
      trend = "steady";
    }
  }

  return {
    totalDaysLogged: sorted.length,
    currentStreak,
    bestStreak,
    overallCompletionRate: overallCount ? Math.round((overallSum / overallCount) * 100) : 0,
    categoryCompletion,
    subjectCompletion,
    avgEnergy: energies.length ? Number((energies.reduce((a, b) => a + b, 0) / energies.length).toFixed(1)) : null,
    avgMood: moods.length ? Number((moods.reduce((a, b) => a + b, 0) / moods.length).toFixed(1)) : null,
    avgSleep: sleeps.length ? Number((sleeps.reduce((a, b) => a + b, 0) / sleeps.length).toFixed(1)) : null,
    trend,
    weakestSubject,
    strongestSubject,
    mostSkippedActivity,
    napSkipRate: napTotal ? Math.round(((napTotal - napDone) / napTotal) * 100) : null,
    lectureAdherence: lectureTotal ? Math.round((lectureDone / lectureTotal) * 100) : 0,
    totalBlocksLogged,
    totalDoneOrPartial,
  };
}

const SUBJECT_LABEL: Record<string, string> = {
  physics: "Physics",
  chemistry: "Chemistry",
  maths: "Maths",
  mixed: "Mixed/Flashcards",
};

export function generateDailyInsight(day: DailyLogRow, overview: Overview): string[] {
  const insights: string[] = [];
  const rate = Math.round(dayCompletionRate(day));

  if (day.blocks.every((b) => b.status === "pending")) {
    insights.push("Nothing logged yet today — start ticking off blocks as you go so tonight's review actually means something.");
    return insights;
  }

  if (rate >= 90) {
    insights.push(`🔥 ${rate}% completion — an excellent day. This is exactly the consistency that compounds over 5 months.`);
  } else if (rate >= 70) {
    insights.push(`✅ ${rate}% completion — solid day, close to the full 13h rhythm.`);
  } else if (rate >= 40) {
    insights.push(`⚠️ ${rate}% completion — a rough day. Don't try to "make it all up" tomorrow; that just cascades the backlog. Protect tomorrow's live lectures first.`);
  } else {
    insights.push(`🚨 ${rate}% completion — well below plan. One low day is normal; two in a row is when backlog becomes unrecoverable before Sunday.`);
  }

  const skipped = day.blocks.filter((b) => b.status === "skipped");
  const lecturesSkipped = skipped.filter((b) => b.isLecture);
  if (lecturesSkipped.length > 0) {
    insights.push(
      `📡 You skipped ${lecturesSkipped.length} live/playback lecture${lecturesSkipped.length > 1 ? "s" : ""} today (${lecturesSkipped
        .map((b) => b.activity.split("—")[0].trim())
        .join(", ")}). Catch these back within 48h — untouched lecture backlog is the single fastest way this plan collapses.`,
    );
  }

  const nap = day.blocks.find((b) => b.activity.includes("POWER NAP"));
  if (nap && nap.status === "skipped") {
    insights.push("😴 Nap skipped — on a 3-lecture day this is exactly the corner the plan warned against; expect the evening Maths lecture to suffer from sleep-inertia-adjacent fatigue instead.");
  }

  const flashcards = day.blocks.find((b) => b.activity.includes("Flashcard Recap"));
  if (flashcards && flashcards.status === "done") {
    insights.push("🧠 Flashcard recap done — good, that's the spaced-repetition rep that keeps last week's Chemistry reactions from decaying.");
  } else if (flashcards && flashcards.status !== "pending") {
    insights.push("🧠 Flashcard recap missed — spaced repetition only works if the reps actually happen; try moving it earlier if 22:30 keeps losing to tiredness.");
  }

  const study11Blocks = day.blocks.filter((b) => b.category === "study_11" && b.status !== "pending");
  if (study11Blocks.length > 0) {
    const rate11 = Math.round((study11Blocks.reduce((a, b) => a + completionScore(b.status), 0) / study11Blocks.length) * 100);
    if (rate11 < 60) {
      insights.push("📘 11th-grade blocks are slipping — remember, this is exactly the content with no external deadline pulling it into place. It's the first thing present bias eats. Protect the 07:15–10:15 window deliberately.");
    }
  }

  if (day.energy != null && day.energy <= 2) {
    insights.push("🔋 Low energy logged — consider an earlier lights-out tonight rather than pushing through the 21:00 Immediate HW block at low quality.");
  }

  if (overview.trend === "declining" && rate < overview.overallCompletionRate) {
    insights.push(`📉 Your 7-day trend is declining and today continued that. Worth a quick honest check: is a specific block (not the whole day) the recurring point of failure?`);
  }

  return insights;
}

export function tomorrowFocus(nextWeekday: string, overview: Overview): string {
  const weak = overview.weakestSubject ? SUBJECT_LABEL[overview.weakestSubject] ?? overview.weakestSubject : null;
  const base = `Tomorrow (${nextWeekday}) — `;
  if (nextWeekday.toLowerCase().startsWith("wed") || nextWeekday.toLowerCase().startsWith("thu")) {
    return base + "it's a 3-lecture day. Protect the 15:30 nap non-negotiably; it's what keeps the 18:15 Maths lecture sharp.";
  }
  if (nextWeekday.toLowerCase().startsWith("sun")) {
    return base + "Rescue Day — clear any Physics playback backlog first thing while alertness is highest, then the 3h 11th-Maths block in the afternoon.";
  }
  if (weak) {
    return base + `keep an eye on ${weak} — it's currently your weakest-tracked subject at ${overview.subjectCompletion[overview.weakestSubject!]}% completion.`;
  }
  return base + "keep the same rhythm — consistency compounds more than any single heroic day.";
}

export interface AdaptiveSuggestion {
  severity: "info" | "warning" | "critical";
  text: string;
}

export function adaptiveSuggestions(overview: Overview, days: DailyLogRow[]): AdaptiveSuggestion[] {
  const suggestions: AdaptiveSuggestion[] = [];

  if (overview.totalDaysLogged < 3) {
    suggestions.push({ severity: "info", text: "Log at least 3–4 days to unlock reliable pattern detection — right now there isn't enough history to be confident about anything." });
    return suggestions;
  }

  if (overview.lectureAdherence < 80 && overview.lectureAdherence > 0) {
    suggestions.push({
      severity: "critical",
      text: `Only ${overview.lectureAdherence}% of live/playback lectures are marked done. Lectures are the plan's anchor points — everything else (HW, revision, flashcards) is scheduled relative to them. Fix this first before anything else.`,
    });
  }

  if (overview.napSkipRate != null && overview.napSkipRate > 40) {
    suggestions.push({
      severity: "warning",
      text: `The 15-min power nap is being skipped ${overview.napSkipRate}% of the time on 3-lecture days. Consider moving it 10 minutes earlier (15:20) if the Chemistry lecture priming is what's eating into it.`,
    });
  }

  if (overview.weakestSubject && overview.strongestSubject && overview.weakestSubject !== overview.strongestSubject) {
    const gap = (overview.subjectCompletion[overview.strongestSubject] ?? 0) - (overview.subjectCompletion[overview.weakestSubject] ?? 0);
    if (gap > 25) {
      suggestions.push({
        severity: "warning",
        text: `${SUBJECT_LABEL[overview.weakestSubject] ?? overview.weakestSubject} is lagging ${gap} points behind ${SUBJECT_LABEL[overview.strongestSubject] ?? overview.strongestSubject}. Consider using Sunday's backlog-clearance block specifically for it this week.`,
      });
    }
  }

  if (overview.categoryCompletion["study_11"] != null && overview.categoryCompletion["study_11"] < 60) {
    suggestions.push({
      severity: "warning",
      text: "11th-grade blocks are consistently under-completed. Since they carry no live-lecture deadline, they're the easiest thing to silently drop — try treating the 07:15 alarm as non-negotiable as a lecture start time.",
    });
  }

  if (overview.mostSkippedActivity && overview.mostSkippedActivity.skipCount >= 3) {
    suggestions.push({
      severity: "info",
      text: `"${overview.mostSkippedActivity.activity}" has been skipped ${overview.mostSkippedActivity.skipCount} times — if a block keeps failing regardless of intent, the block (timing/length) is probably the problem, not willpower. Consider shortening it or swapping its slot from /schedule.`,
    });
  }

  if (overview.avgEnergy != null && overview.avgEnergy < 2.5) {
    suggestions.push({
      severity: "warning",
      text: `Average logged energy is ${overview.avgEnergy}/5. Given the plan runs a strict 7h sleep window, check whether lights-out is slipping past 23:00 — that's the most common silent leak.`,
    });
  }

  if (overview.trend === "declining") {
    suggestions.push({ severity: "critical", text: "Your completion rate has dropped over the last week compared to the week before. One data point isn't a trend, but two is a pattern — worth a deliberate reset day rather than pushing through." });
  } else if (overview.trend === "improving") {
    suggestions.push({ severity: "info", text: "Your completion rate is trending up week-over-week. Whatever changed, keep doing it." });
  }

  if (suggestions.length === 0) {
    suggestions.push({ severity: "info", text: "No red flags detected — the plan is holding. Keep logging honestly; that's what makes these suggestions useful." });
  }

  return suggestions;
}

function pctText(overview: Overview, key: string, map: Record<string, number>): string {
  const v = map[key];
  return v == null ? "no data logged yet" : `${v}% completion`;
}

export function generateMentorReply(message: string, overview: Overview, days: DailyLogRow[]): string {
  const m = message.toLowerCase();

  if (overview.totalDaysLogged === 0) {
    return "You haven't logged any days yet — head to the Tracker tab and mark a few blocks done or skipped. Once there's data, I can actually coach you instead of guessing.";
  }

  const greet = /^(hi|hey|hello|yo|sup)\b/.test(m);
  if (greet) {
    return `Hey! You're at a ${overview.overallCompletionRate}% overall completion rate across ${overview.totalDaysLogged} logged day${overview.totalDaysLogged === 1 ? "" : "s"}, current streak ${overview.currentStreak} day${overview.currentStreak === 1 ? "" : "s"}. What do you want to dig into — a subject, energy/sleep, or today's plan?`;
  }

  if (/physics/.test(m)) {
    return `Physics completion: ${pctText(overview, "physics", overview.subjectCompletion)}. ${
      overview.weakestSubject === "physics"
        ? "It's currently your weakest tracked subject — Sunday's dedicated 3.5h catch-up block exists exactly for this, use it deliberately rather than as an overflow buffer."
        : "It's holding up reasonably well — keep the 07:15 morning block and the 21:00 Immediate HW chained with zero gap, that's what converts it to long-term retention."
    }`;
  }
  if (/chem/.test(m)) {
    return `Chemistry completion: ${pctText(overview, "chemistry", overview.subjectCompletion)}. Chemistry gets triple exposure on Wed/Thu (extra playback, live, same-night HW) — if it's slipping, check whether the 15:30 nap is being skipped, since that's the block protecting the whole afternoon/evening chain.`;
  }
  if (/maths|math\b/.test(m)) {
    return `Maths completion: ${pctText(overview, "maths", overview.subjectCompletion)}. Maths lectures land last in the evening (18:15) on Wed/Thu/Fri/Sat, when errors compound most in multi-step problems — if focus ratings are low there, that's a fatigue signal, not an ability one.`;
  }

  if (/sleep|tired|energy|exhaust|fatigue/.test(m)) {
    const sleepText = overview.avgSleep != null ? `Average logged sleep: ${overview.avgSleep}h against a 7h target.` : "No sleep data logged yet.";
    const energyText = overview.avgEnergy != null ? `Average energy: ${overview.avgEnergy}/5.` : "";
    return `${sleepText} ${energyText} The plan is only stable at exactly 7h (23:00–06:00) — even losing 30-45 min compounds fast across a 91h study week. If lights-out is slipping, that's almost always the real bottleneck behind a "motivation" problem.`;
  }

  if (/nap/.test(m)) {
    return overview.napSkipRate != null
      ? `Power-nap skip rate: ${overview.napSkipRate}%. It's only 15 minutes but it's load-bearing on Wed/Thu — those days carry 5h15m of lecture-equivalents vs the usual 3h30m. Skipping it routes straight into evening Maths quality.`
      : "No nap data logged yet — it only appears on Wed/Thu. Log it honestly; it's a small block but a disproportionately important one.";
  }

  if (/streak|behind|progress|how am i doing|doing so far|overall/.test(m)) {
    return `Overall: ${overview.overallCompletionRate}% completion across ${overview.totalDaysLogged} days. Current streak: ${overview.currentStreak} day${overview.currentStreak === 1 ? "" : "s"} (best: ${overview.bestStreak}). Trend: ${overview.trend}. Lecture adherence: ${overview.lectureAdherence}% — that one matters most since everything else is scheduled around lectures.`;
  }

  if (/motivat|give up|quit|hard|difficult|can'?t/.test(m)) {
    return `13h/day for 5 months is genuinely hard — the plan itself says the nap and buffers exist because a week this size "collapses on itself" without them. You're at ${overview.overallCompletionRate}% overall. That's not a verdict on you, it's a data point on the plan's current friction. Pick the single most-skipped block ("${overview.mostSkippedActivity?.activity ?? "none flagged yet"}") and fix just that one thing this week instead of trying to fix everything.`;
  }

  if (/sunday|catch.?up|backlog/.test(m)) {
    return `Sunday exists specifically to absorb Wed/Thu's Physics backlog and give 11th Maths its only weekly slot. If Sunday itself is getting skipped, the backlog compounds silently into the next week — check your Sunday completion rate specifically in the History tab.`;
  }

  if (/focus|what should i do|today|next|up next|plan/.test(m)) {
    const suggestion = overview.weakestSubject
      ? `Right now your weakest subject is ${SUBJECT_LABEL[overview.weakestSubject] ?? overview.weakestSubject} at ${overview.subjectCompletion[overview.weakestSubject]}%. `
      : "";
    return `${suggestion}Open today's tracker and look at "Up Next" — the plan is deliberately sequenced (theory → immediate HW → active revision with zero gaps) so the highest-leverage move is almost always just staying on the current block rather than skipping ahead.`;
  }

  if (/skip|missed|forgot/.test(m)) {
    return overview.mostSkippedActivity
      ? `Your most frequently skipped block is "${overview.mostSkippedActivity.activity}" (${overview.mostSkippedActivity.skipCount} times). If willpower isn't the issue, the slot probably is — consider adjusting its length or time from the Schedule tab rather than continuing to force it.`
      : "No block has a strong skip pattern yet — good sign, keep logging honestly so I can catch it early if one develops.";
  }

  // fallback: general status summary
  return `Here's where you stand: ${overview.overallCompletionRate}% overall completion, streak ${overview.currentStreak} day(s), trend ${overview.trend}. Ask me about a subject (Physics/Chemistry/Maths), sleep/energy, the nap, Sunday backlog, or what to focus on next — I'll answer using your actual logged data.`;
}
