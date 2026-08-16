import { db } from "@/db";
import { dayLogs, slotLogs } from "@/db/schema";
import { and, gte, inArray, lte } from "drizzle-orm";
import {
  activeSlot,
  addDays,
  fmt,
  getDayType,
  istDateKey,
  istNowMinutes,
  prettyDate,
  slotMinutes,
  weekdayName,
} from "@/lib/timetable";
import {
  computeDayStats,
  fmtMinutes,
  type DaySnapshot,
} from "@/lib/stats";
import type { Subject } from "@/lib/timetable";
import type { SlotLog } from "@/db/schema";

export interface MissedSlot {
  time: string;
  title: string;
  category: string;
  subject: Subject | null;
  grade: 11 | 12 | null;
  lecture: boolean;
}

export interface DaySnapshotFull extends DaySnapshot {
  missed: MissedSlot[];
  dayTypeLabel: string;
}

const STUDY_MIN = 780; // planned study minutes per day

// ── snapshot building ───────────────────────────────────────────────────────
export async function buildSnapshots(endDate: string, days: number): Promise<DaySnapshotFull[]> {
  const start = addDays(endDate, -(days - 1));
  const rows = await db
    .select()
    .from(dayLogs)
    .where(and(gte(dayLogs.date, start), lte(dayLogs.date, endDate)));

  let slotRows: SlotLog[] = [];
  if (rows.length > 0) {
    slotRows = await db
      .select()
      .from(slotLogs)
      .where(inArray(slotLogs.dayLogId, rows.map((r) => r.id)));
  }
  const rowById = new Map(rows.map((r) => [r.id, r]));
  const slotsByDay = new Map<number, SlotLog[]>();
  for (const l of slotRows) {
    const arr = slotsByDay.get(l.dayLogId) ?? [];
    arr.push(l);
    slotsByDay.set(l.dayLogId, arr);
  }

  const out: DaySnapshotFull[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(start, i);
    const dayType = getDayType(date);
    const row = rows.find((r) => r.date === date);
    const logs = row ? slotsByDay.get(row.id) ?? [] : [];
    const stats = computeDayStats(dayType, logs);
    const logsById = new Map(logs.map((l) => [l.slotId, l]));
    const missed: MissedSlot[] = [];
    for (const s of dayType.slots) {
      const isStudy = s.category === "11th Study" || s.category === "12th Study";
      if (!isStudy) continue;
      const log = logsById.get(s.id);
      if (log && (log.status === "skipped" || log.status === "partial")) {
        missed.push({
          time: fmt(s.start),
          title: s.title,
          category: s.category,
          subject: s.subject ?? null,
          grade: s.grade ?? null,
          lecture: !!s.lecture,
        });
      }
    }
    out.push({
      date,
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
      missed,
      energy: row?.energy ?? null,
      mood: row?.mood ?? null,
      wakeTime: row?.wakeTime ?? null,
      sleepTime: row?.sleepTime ?? null,
    });
  }
  return out;
}

export function snapshotsToText(snaps: DaySnapshotFull[]): string {
  const lines: string[] = [];
  for (const s of snaps) {
    const subjects = Object.entries(s.bySubject)
      .filter(([, v]) => v.planned > 0)
      .map(([k, v]) => `${k}: ${fmtMinutes(v.done)}/${fmtMinutes(v.planned)}`)
      .join(", ");
    lines.push(
      `${s.date} (${s.dayTypeLabel})${s.logged ? "" : " — NOT LOGGED"} | adherence ${Math.round(
        s.adherence * 100
      )}% | study ${fmtMinutes(s.studyDone)}/${fmtMinutes(s.studyPlanned)} | slots done ${s.doneSlots}/${s.totalStudySlots} | skipped ${s.skipped} | partial ${s.partial} | energy ${
        s.energy ?? "?"
      }/5 | mood ${s.mood ?? "?"} | wake ${s.wakeTime ?? "?"} | sleep ${s.sleepTime ?? "?"}${subjects ? ` | subjects: ${subjects}` : ""}${
        s.missed.length ? ` | missed: ${s.missed.map((m) => `[${m.time} ${m.title}]`).join(", ")}` : ""
      }`
    );
  }
  return lines.join("\n");
}

// ── mentor (LLM) prompt ─────────────────────────────────────────────────────
export function mentorSystemPrompt(snaps: DaySnapshotFull[]): string {
  const today = snaps[snaps.length - 1];
  return `You are "Lakshya Mentor" — a sharp, warm, elite coach for a student preparing for JEE 2027 while studying BOTH 11th and 12th grade simultaneously. The trainee follows a fixed 13h/day framework (3h 11th + 10h 12th) with 4 rotating day-types. Fixed anchors: wake 06:00, lights-out 23:00, live lectures 16:00 & 18:15, Sunday = Physics catch-up + 11th Maths. Meal/break slots are part of the system and are NOT failures to skip.

TODAY is ${today.date} (${weekdayName(today.date)}, ${today.dayTypeLabel}).

RECENT TRACKER DATA (IST dates, adherence = study minutes completed / planned):
${snapshotsToText(snaps)}

RULES:
- Reply in plain, warm, coach-like language. Use light markdown: **bold**, "- " bullets, minimal emoji.
- Be SPECIFIC: reference actual dates, subjects, slot titles and numbers from the data above. Never vague-platitude the student.
- Keep replies under ~130 words unless the student asks for depth.
- Praise real wins from the data. Flag the top 1–2 concrete leaks (e.g. "Wed's 21:00 Chemistry HW skipped 3 times"). Suggest a precise fix that fits the existing timetable (rescue into Sunday backlog, swap breaks, protect morning 11th block). Never suggest dropping sleep, meals or the 15-min nap.
- If asked about schedule changes: protect the anchors (06:00, 23:00, 16:00/18:15 lectures, 3h/10h split) and propose swaps WITHIN the framework.
- You may tutor JEE Physics/Chemistry/Maths concepts when asked: give intuition first, then a tiny worked example.
- If data is empty/not logged, nudge gently to log the day.`;
}

// ── offline mentor reply engine ─────────────────────────────────────────────
export function mentorFallbackReply(userText: string, snaps: DaySnapshotFull[]): string {
  const text = userText.toLowerCase();
  const today = snaps[snaps.length - 1];
  const week = snaps.filter((s) => s.date !== today.date).slice(-6);
  const t = today;

  const greet =
    /^(hi|hii+|hello|hey|yo|namaste|salaam|good (morning|afternoon|evening|night))\b/.test(text) ||
    (userText.trim().length < 8 && !text.includes("?") && !text.includes("why"));

  if (greet) {
    const d = getDayType(today.date);
    const nowSlot = activeSlot(d, istNowMinutes());
    const todayLine = t.logged
      ? `You're at **${Math.round(t.adherence * 100)}%** today (${fmtMinutes(t.studyDone)} done, ${t.doneSlots}/${t.totalStudySlots} study slots).`
      : `You haven't logged today yet — it's a **${d.label}** day.`;
    return `Namaste! 🎯 I'm your Lakshya Mentor. Here's where you stand:\n\n${todayLine}\n${
      nowSlot
        ? `Right now the timetable says: **${nowSlot.title}** (${fmt(nowSlot.start)}–${fmt(nowSlot.end)}).`
        : "No slot is active right now — use the gap to hydrate or review flashcards."
    }\n\n- If you've done a slot, tap **Done** in the tracker so I can coach you accurately.\n- Ask me *"how's my week going?"* for a full read, or *"what should I do now?"* any time.`;
  }

  if (/(week|progress|report|how am i|how have i|summary|stats|analyse|analyze)/.test(text)) {
    return weeklyDigest(snaps);
  }

  if (/(skip|skipp|miss|weak|behind|lazy|fail|didn'?t|couldn'?t|procrastinat)/.test(text)) {
    return leakAnalysis(today, snaps);
  }

  if (/(now|next|what should i|do i do|right now|current)/.test(text)) {
    return nowAdvice(today);
  }

  if (/(timetable|schedule|routine|change|adjust|swap|plan|replan|reschedule)/.test(text)) {
    return frameworkAdvice(today);
  }

  if (/(tired|burnout|burn out|exhaust|drain|motivat|quit|overwhelm|sleep|nap|energy)/.test(text)) {
    return recoveryAdvice(today, snaps);
  }

  if (/(explain|why|what is|how does|concept|teach|help me with|don'?t understand|doubt)/.test(text)) {
    return tutoringReply(today);
  }

  // default: status digest
  return weeklyDigest(snaps);
}

function todayQuick(t: DaySnapshotFull): string {
  if (!t.logged) return `Today isn't logged yet. Even a partial log gives me a picture — mark what you actually did.`;
  const d = getDayType(t.date);
  const done = t.studyDone;
  const left = STUDY_MIN - done;
  return `**Today: ${Math.round(t.adherence * 100)}%** (${fmtMinutes(done)} of 13h study). ${
    t.doneSlots === t.totalStudySlots
      ? "Every study slot done — elite day. ✅"
      : `${t.doneSlots}/${t.totalStudySlots} slots done, ${left > 0 ? `${fmtMinutes(left)} still on the table` : "and you're over plan"}. ${
          t.missed.length ? `Missed so far: ${t.missed.map((m) => `**${m.title.split("—")[0].trim()}** (${m.time})`).slice(0, 3).join(", ")}.` : ""
        }`
  }`;
}

function weeklyDigest(snaps: DaySnapshotFull[]): string {
  const logged = snaps.filter((s) => s.logged);
  const today = snaps[snaps.length - 1];
  if (logged.length === 0) {
    return `I don't have enough data yet — no days logged in this window. Log today (even partially) and I'll start coaching you with real numbers.\n\nStart with the tracker: tap **Done / Partial / Skipped** on each slot as you move through the day.`;
  }
  const avg =
    logged.reduce((a, s) => a + s.adherence, 0) / logged.length;
  const totalDone = logged.reduce((a, s) => a + s.studyDone, 0);
  const best = [...logged].sort((a, b) => b.adherence - a.adherence)[0];
  const worst = [...logged].sort((a, b) => a.adherence - b.adherence)[0];
  const perDay = snaps.map((s) => `${s.date.slice(8)}:${s.logged ? Math.round(s.adherence * 100) : "—"}`).join(" ");
  const lines: string[] = [];
  lines.push(`**Weekly read — ${snaps[0].date} → ${snaps[snaps.length - 1].date}**`);
  lines.push(`- Adherence per day: \`${perDay}\``);
  lines.push(
    `- Average **${Math.round(avg * 100)}%**, ${fmtMinutes(totalDone)} total study over ${logged.length} logged day(s).`
  );
  if (best.adherence > 0)
    lines.push(`- Best day: **${prettyDate(best.date)}** at ${Math.round(best.adherence * 100)}% — that's your benchmark.`);
  if (worst.adherence < best.adherence)
    lines.push(`- Leakiest logged day: ${prettyDate(worst.date)} at ${Math.round(worst.adherence * 100)}%.`);
  const deficits = subjectDeficits(snaps);
  if (deficits.length)
    lines.push(
      `- Biggest deficits: ${deficits
        .slice(0, 2)
        .map((d) => `**${d.label}** (${fmtMinutes(d.deficit)} behind plan)`)
        .join(", ")}.`
    );
  lines.push(``);
  lines.push(todayQuick(today));
  lines.push(``);
  lines.push(`**My call:** ${coachCall(deficits[0]?.label, snaps)}`);
  return lines.join("\n");
}

function leakAnalysis(today: DaySnapshotFull, snaps: DaySnapshotFull[]): string {
  const all = snaps.filter((s) => s.logged && s.missed.length > 0);
  const lines: string[] = [];
  if (all.length === 0) {
    lines.push(`Good news: no skipped slots across the last ${snaps.length} days. Whatever's slipping hasn't hit the log yet.`);
    lines.push(``);
    lines.push(todayQuick(today));
    return lines.join("\n");
  }
  // most frequently missed slot title across the week
  const freq = new Map<string, { count: number; title: string; subject: string | null; time: string }>();
  for (const s of all) {
    for (const m of s.missed) {
      const cur = freq.get(m.title) ?? { count: 0, title: m.title, subject: m.subject, time: m.time };
      cur.count += 1;
      freq.set(m.title, cur);
    }
  }
  const ranked = [...freq.values()].sort((a, b) => b.count - a.count);
  const top = ranked[0];
  lines.push(`Your biggest leak right now: **${top.title}** — skipped ${top.count}× in the last 7 days.`);
  lines.push(``);
  const subject = top.subject ?? "study";
  const time = top.time;
  if (top.time >= "20:00") {
    lines.push(`This slot lives at the end of the day when your brain is drained. Fix, in order:\n- At **21:00 sharp**, phone out of the room. Start with 10 min of the EASIEST problem — starting is the whole battle.\n- If dinner runs late, compress wind-down to 10 min instead of cutting HW.\n- Anything truly unfinished goes to **Sunday's 20:45 backlog clearance** — but max 1 backlogged topic per week, or backlog becomes a habit.`);
  } else if (top.time >= "07:00" && top.time < "11:00") {
    lines.push(`This is your highest-alertness morning block — losing it is the costliest leak in the whole framework. Fix:\n- Start the wake-up routine 15 min earlier if you're drifting past 07:15.\n- Theory → HW → Revision must run back-to-back with **zero phone**. Put a timer for the first 40 min and just begin the theory page.\n- If you miss it, that material has no other home in the week — protect it like a lecture.`);
  } else if (top.time >= "13:00" && top.time < "16:00") {
    lines.push(`That's the post-lunch dip window — by design it only carries review, so skipping it is a discipline leak, not a brain leak. Fix: start with yesterday's flagged questions for 15 min. Momentum does the rest.`);
  } else {
    lines.push(`Lectures and priming are non-negotiable anchors. If you're skipping them, something upstream is broken (sleep or morning drift). We'll fix the root, not the symptom.`);
  }
  lines.push(``);
  lines.push(todayQuick(today));
  return lines.join("\n");
}

function nowAdvice(today: DaySnapshotFull): string {
  const d = getDayType(today.date);
  const now = istNowMinutes();
  const slot = activeSlot(d, now);
  const lines: string[] = [];
  if (!slot) {
    lines.push(`No study slot is live right now (IST ${fmt(now)}). Between slots: hydrate, walk, or flip 10 flashcards.`);
    const next = d.slots.find((s) => s.start > now && (s.category === "11th Study" || s.category === "12th Study"));
    if (next) lines.push(`Next study slot: **${next.title}** at ${fmt(next.start)}.`);
  } else {
    lines.push(`Right now (IST ${fmt(now)}) the framework says: **${slot.title}** — ${slotMinutes(slot)} min, ${slot.category}.`);
    if (slot.lecture)
      lines.push(`Lecture slot. Notepad open, phone in another room, sit front-of-mind. If it's already over and you missed it, don't spiral — flag it skipped and I'll slot the playback into a gap.`);
    else if (slot.category === "11th Study")
      lines.push(`11th-grade block — no lecture is enforcing this, so YOU are the enforcement. Timer on, one topic, done.`);
    else lines.push(`Do the first 10 minutes at 70% effort — starting is the whole game.`);
  }
  lines.push(``);
  lines.push(todayQuick(today));
  return lines.join("\n");
}

function frameworkAdvice(today: DaySnapshotFull): string {
  return `The framework has four fixed anchors I won't let you move:\n\n1. **Wake 06:00 / lights-out 23:00** — the sleep bank funds everything else.\n2. **Live lectures 16:00 & 18:15** — non-negotiable.\n3. **The 3h (11th) / 10h (12th) split** — 11th has no external deadline, so it must stay in the protected morning block.\n4. **Sunday** = Physics catch-up + the week's only 11th Maths.\n\nWhat you CAN flex:\n- Meal/break lengths (keep totals intact).\n- HW order inside a subject block.\n- Which playback fills Sunday's catch-up slots.\n- Moving a missed HW into **Sunday 20:45 backlog clearance** (max 1 per week).\n\n${todayQuick(today)}\n\nTell me which slot you want to move and why, and I'll give you a swap that doesn't break the machine.`;
}

function recoveryAdvice(today: DaySnapshotFull, snaps: DaySnapshotFull[]): string {
  const logged = snaps.filter((s) => s.logged);
  const overwork = logged.filter((s) => s.studyDone > s.studyPlanned + 60).length > 0;
  const sleepLate = logged.some((s) => s.sleepTime && s.sleepTime > "23:15");
  const lines: string[] = [];
  if (overwork)
    lines.push(`You've been overshooting slots (${logged.filter((s) => s.studyDone > s.studyPlanned + 60).length} day(s) over plan). **That is its own failure mode** — overrunning bleeds sleep, and sleep is what makes 13h days possible at all. Finish at the planned time, even if the problem isn't solved. Park it in the backlog slot.`);
  else lines.push(`Tiredness at ${today.studyDone >= STUDY_MIN * 0.8 ? "this volume of study" : "any volume of study"} is information, not weakness.`);
  lines.push(``);
  lines.push(`Recovery protocol (all legal inside your timetable):\n- Take the **15:30 power nap on Wed/Thu** — it's in the schedule for exactly this reason. Never skip it those days.\n- After a lecture, 3 min outside, no phone.\n- If tonight is bad: dinner + wind-down only, then lights-out AT 23:00 sharp. A skipped evening slot costs ~1h30. A skipped sleep cycle costs tomorrow's whole morning block.\n- One hard rule: **never trade the 23:00–06:00 window** for study.`);
  if (sleepLate) lines.push(`\nI can see a sleep-time past 23:15 in the log — that's the first thing to fix.`);
  return lines.join("\n");
}

function tutoringReply(today: DaySnapshotFull): string {
  return `Happy to teach. I can work through JEE Physics, Chemistry or Maths with you — intuition first, then a mini worked example.\n\nTell me the exact topic or question (e.g. *"why does Kc change with temperature but not concentration?"* or *"explain rolling without slipping"*) and which grade it's from. Meanwhile: ${todayQuick(today)}`;
}

function subjectDeficits(snaps: DaySnapshotFull[]): { key: string; label: string; deficit: number }[] {
  const agg = new Map<string, { planned: number; done: number; label: string }>();
  for (const s of snaps) {
    if (!s.logged) continue;
    for (const [k, v] of Object.entries(s.bySubject)) {
      const cur = agg.get(k) ?? { planned: 0, done: 0, label: k };
      cur.planned += v.planned;
      cur.done += v.done;
      agg.set(k, cur);
    }
  }
  return [...agg.entries()]
    .map(([key, v]) => ({ key, label: v.label, deficit: Math.max(0, v.planned - v.done) }))
    .sort((a, b) => b.deficit - a.deficit);
}

function coachCall(deficitLabel: string | undefined, snaps: DaySnapshotFull[]): string {
  const m11 = deficitLabel?.startsWith("11:");
  if (deficitLabel && m11)
    return `Your 11th-grade ${deficitLabel.slice(3)} block is running behind. Tomorrow, do the 07:15 morning block BEFORE touching anything else — that window is the only unforced study time in your day, and Physics/Chemistry theory there is what keeps 11th-grade JEE prep alive.`;
  if (deficitLabel)
    return `Bridging the ${deficitLabel} gap: tag its missed slots into **Sunday 20:45 backlog clearance** (max 1 topic), and mark skipped slots honestly — partial credit in the log is better than nothing.`;
  return `Keep the streak alive: log every slot honestly, protect 23:00 lights-out, and let Sunday do its rescue job.`;
}

// ── insight prompts + offline insight engines ───────────────────────────────
export function dailyInsightSystem(): string {
  return `You are an elite JEE coach writing a SHORT end-of-day review for a student following a fixed 13h/day timetable (3h 11th + 10h 12th, JEE 2027). Write in markdown, max 170 words, structured as:\n**Daily Review — {date} ({day type})**\n- **Score:** X% adherence (Yh ZZmin of 13h study planned) — one line on what that means.\n- **Won:** 1–2 real wins from the data (name subjects/slots).\n- **Leaked:** missed/partial slots with times, briefly.\n- **Tomorrow:** one concrete fix that fits the existing framework (anchors: 06:00 wake, 23:00 sleep, live lectures 16:00/18:15, Sunday = Physics catch-up + 11th Maths).\nBe specific, warm, zero fluff.`;
}

export function weeklyInsightSystem(): string {
  return `You are an elite JEE coach writing a SHORT weekly review for a student on a fixed 13h/day timetable (3h 11th + 10h 12th, JEE 2027). Write in markdown, max 220 words:\n**Weekly Review — {start} → {end}**\n- **Week score:** average adherence %, total study hours vs plan, best & worst day.\n- **Subjects:** deficits per subject (planned vs done).\n- **Patterns:** morning vs evening reliability; which slot type leaks most.\n- **Next week:** 2 precise, framework-respecting changes (max 2 — never touch sleep, meals, lectures, or the 3h/10h split).\nSpecific, warm, zero fluff.`;
}

export function dailyInsightPrompt(snap: DaySnapshotFull): string {
  const subjects = Object.entries(snap.bySubject)
    .filter(([, v]) => v.planned > 0)
    .map(([k, v]) => `${k}: ${fmtMinutes(v.done)}/${fmtMinutes(v.planned)}`)
    .join(", ");
  return [
    `Date: ${snap.date} (${weekdayName(snap.date)}, ${snap.dayTypeLabel})`,
    `Logged: ${snap.logged ? "yes" : "no"}`,
    `Adherence: ${Math.round(snap.adherence * 100)}% (${fmtMinutes(snap.studyDone)} of ${fmtMinutes(snap.studyPlanned)} study)`,
    `Slots: ${snap.doneSlots}/${snap.totalStudySlots} done, ${snap.skipped} skipped, ${snap.partial} partial`,
    `Subjects: ${subjects || "none"}`,
    `Missed/partial: ${snap.missed.length ? snap.missed.map((m) => `${m.time} ${m.title}`).join("; ") : "none"}`,
    `Check-in: energy ${snap.energy ?? "?"}/5, mood ${snap.mood ?? "?"}, wake ${snap.wakeTime ?? "?"}, sleep ${snap.sleepTime ?? "?"}`,
  ].join("\n");
}

export function weeklyInsightPrompt(snaps: DaySnapshotFull[]): string {
  return `Window: ${snaps[0].date} → ${snaps[snaps.length - 1].date}\nPer-day data:\n${snapshotsToText(snaps)}`;
}

export function dailyInsightFallback(snap: DaySnapshotFull): string {
  const p = Math.round(snap.adherence * 100);
  const lines: string[] = [];
  lines.push(`**Daily Review — ${snap.date} (${snap.dayTypeLabel})**`);
  if (!snap.logged) {
    lines.push(``);
    lines.push(`No log was kept for this day — the tracker can't coach what it can't see. Even a 30-second log of skipped slots is worth more than silence. Next time you log, I'll be here with numbers.`);
    return lines.join("\n");
  }
  lines.push(``);
  lines.push(`**Score: ${p}%** — ${fmtMinutes(snap.studyDone)} of ${fmtMinutes(snap.studyPlanned)} study, ${snap.doneSlots}/${snap.totalStudySlots} slots done (${snap.skipped} skipped, ${snap.partial} partial).`);
  const won: string[] = [];
  for (const [k, v] of Object.entries(snap.bySubject)) {
    if (v.done > 0 && v.planned > 0 && v.done / v.planned >= 0.9) won.push(`${k} (${fmtMinutes(v.done)})`);
  }
  if (won.length) lines.push(`- **Won:** ${won.slice(0, 3).join(", ")} — full coverage on those.`);
  else if (p > 0) lines.push(`- **Won:** you showed up and logged honestly — that's the foundation.`);
  if (snap.missed.length) {
    lines.push(`- **Leaked:** ${snap.missed.slice(0, 4).map((m) => `${m.title.split("—")[0].trim()} (${m.time})`).join("; ")}.`);
  } else {
    lines.push(`- **Leaked:** nothing. Clean sheet.`);
  }
  lines.push(`- **Tomorrow:** ${dailyAdviceRule(snap)}`);
  return lines.join("\n");
}

function dailyAdviceRule(snap: DaySnapshotFull): string {
  const eleven = snap.bySubject["11:Physics"] ?? { planned: 0, done: 0, doneSlots: 0, totalSlots: 0 };
  const elevenC = snap.bySubject["11:Chemistry"] ?? { planned: 0, done: 0, doneSlots: 0, totalSlots: 0 };
  const elevenDone = eleven.done + elevenC.done;
  const elevenPlanned = eleven.planned + elevenC.planned;
  if (snap.adherence >= 0.95) return `elite day. Same again tomorrow, then raise problem difficulty 10% — comfort is the enemy at 95%+.`;
  if (snap.adherence >= 0.8) return `strong. Close the last gap by starting the 21:00 HW with one easy problem the moment dinner ends.`;
  if (snap.missed.some((m) => m.lecture)) return `protect the lecture anchors — a missed live lecture costs 1h45 of playback later. Prime 15 min before 16:00 and 18:15.`;
  if (elevenPlanned > 0 && elevenDone / elevenPlanned < 0.7)
    return `reclaim the 07:15–10:15 morning block. 11th-grade has no deadline forcing it, so YOU start it before anything else tomorrow.`;
  if (snap.missed.some((m) => m.time >= "20:00"))
    return `the evening leaked — tomorrow, phone leaves the room at 20:40 and stays out until 22:30.`;
  if (snap.adherence > 0) return `partial credit beats silence — keep logging, and aim for +2 slots tomorrow.`;
  return `a reset: wake at 06:00, do the first morning slot in full, and let momentum carry the rest.`;
}

export function weeklyInsightFallback(snaps: DaySnapshotFull[]): string {
  const logged = snaps.filter((s) => s.logged);
  const lines: string[] = [];
  lines.push(`**Weekly Review — ${snaps[0].date} → ${snaps[snaps.length - 1].date}**`);
  lines.push(``);
  if (logged.length === 0) {
    lines.push(`No days logged this week — I can't coach ghosts. Log one full day and the weekly review lights up.`);
    return lines.join("\n");
  }
  const avg = logged.reduce((a, s) => a + s.adherence, 0) / logged.length;
  const totalDone = logged.reduce((a, s) => a + s.studyDone, 0);
  const totalPlanned = logged.reduce((a, s) => a + s.studyPlanned, 0);
  const best = [...logged].sort((a, b) => b.adherence - a.adherence)[0];
  const worst = [...logged].sort((a, b) => a.adherence - b.adherence)[0];
  lines.push(`**Week score: ${Math.round(avg * 100)}%** — ${fmtMinutes(totalDone)} of ${fmtMinutes(totalPlanned)} study across ${logged.length} logged day(s).`);
  lines.push(`- Best: **${prettyDate(best.date)}** (${Math.round(best.adherence * 100)}%).${worst.adherence < best.adherence ? ` Worst: ${prettyDate(worst.date)} (${Math.round(worst.adherence * 100)}%).` : ""}`);
  const deficits = subjectDeficits(snaps);
  if (deficits.length)
    lines.push(
      `- **Subjects:** ${deficits
        .slice(0, 3)
        .map((d) => `${d.label} ${fmtMinutes(d.deficit)} behind`)
        .join(" · ")}.`
    );
  // morning vs evening
  const mornings = countPeriodReliability(snaps, "07:00", "13:00");
  const evenings = countPeriodReliability(snaps, "18:00", "23:00");
  lines.push(`- **Patterns:** morning slots reliable at **${mornings}%**, evening at **${evenings}%**.${evenings < mornings ? ` The evening is your leak — classic for 13h days.` : ` Both halves holding — rare and good.`}`);
  lines.push(``);
  lines.push(`**Next week:** ${weeklyAdviceRule(snaps, deficits)}`);
  return lines.join("\n");
}

function countPeriodReliability(snaps: DaySnapshotFull[], from: string, to: string): number {
  let planned = 0;
  let done = 0;
  for (const s of snaps) {
    if (!s.logged) continue;
    const missedTitles = new Set(s.missed.map((m) => m.title));
    for (const slot of getDayType(s.date).slots) {
      const isStudy = slot.category === "11th Study" || slot.category === "12th Study";
      const start = fmt(slot.start);
      if (!isStudy || start < from || start >= to) continue;
      planned += 1;
      if (!missedTitles.has(slot.title)) done += 1;
    }
  }
  return planned > 0 ? Math.round((done / planned) * 100) : 0;
}

function weeklyAdviceRule(snaps: DaySnapshotFull[], deficits: { key: string; label: string; deficit: number }[]): string {
  const first = deficits[0];
  const parts: string[] = [];
  if (first && first.deficit > 0)
    parts.push(`route one backlogged **${first.label}** topic into Sunday's 20:45 clearance — and only one, or backlog becomes the plan.`);
  parts.push(`protect the morning 11th block (07:15–10:15) like a lecture; it's the only study time nobody forces you to do.`);
  parts.push(`keep the 23:00 lights-out non-negotiable — next week's adherence is bought tonight.`);
  return parts.join(" ");
}

// ── exported helpers used by API routes ────────────────────────────────────
export { getDayType, istDateKey, istNowMinutes, prettyDate, weekdayName };
