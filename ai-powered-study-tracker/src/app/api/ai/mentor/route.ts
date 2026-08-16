import { db } from "@/db";
import { chatMessages } from "@/db/schema";
import { desc } from "drizzle-orm";
import { buildSnapshots, mentorFallbackReply, mentorSystemPrompt } from "@/lib/coach";
import { istDateKey } from "@/lib/timetable";
import { streamCompletion, type ChatMsg } from "@/lib/ai";
import { PROVIDER_LABEL } from "@/lib/ai-providers";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const history = await db
    .select()
    .from(chatMessages)
    .orderBy(desc(chatMessages.id))
    .limit(60);
  return Response.json({ messages: history.reverse() });
}

interface MentorBody {
  messages?: { role: "user" | "assistant"; content: string }[];
}

export async function POST(req: Request) {
  let body: MentorBody;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  const clientMessages = Array.isArray(body.messages) ? body.messages.slice(-12) : [];
  const lastUser = [...clientMessages].reverse().find((m) => m.role === "user")?.content ?? "";

  const today = istDateKey();
  const snaps = await buildSnapshots(today, 7);
  const fallback = mentorFallbackReply(lastUser, snaps);
  const system = mentorSystemPrompt(snaps);

  const history: ChatMsg[] = [
    { role: "system", content: system },
    ...clientMessages.map((m) => ({ role: m.role, content: m.content })),
  ];

  // persist the user's last message
  if (lastUser.trim()) {
    await db.insert(chatMessages).values({ role: "user", content: lastUser, provider: "user" });
  }

  const encoder = new TextEncoder();
  let full = "";

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      };
      try {
        const provider = await streamCompletion({
          system,
          messages: history,
          onToken: (t) => {
            full += t;
            send({ d: t });
          },
          fallback,
        });
        if (full.trim()) {
          await db.insert(chatMessages).values({
            role: "assistant",
            content: full,
            provider: PROVIDER_LABEL[provider],
          });
        }
        send({ done: true, provider: PROVIDER_LABEL[provider] });
        controller.close();
      } catch (err) {
        console.error("[mentor] stream error", err);
        send({ error: "stream failed" });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
