import { and, asc, count, eq, gt } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { AiNotConfiguredError, stream, type ChatMessage } from "@/lib/ai/openrouter";
import { helperSystemPrompt } from "@/lib/ai/prompts";
import { handle, jsonError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { loadOwnExercise } from "@/lib/exercises";
import { getApiKey, getModels } from "@/lib/settings";

const RATE_LIMIT_MESSAGES = 20;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const HISTORY_LIMIT = 16;

const bodySchema = z.object({
  exerciseId: z.number().int(),
  message: z.string().trim().min(1).max(500),
  focusLabelId: z.string().optional(),
});

export const POST = handle(async (req: Request) => {
  const user = await requireApiUser();
  const body = bodySchema.parse(await req.json());
  const { exercise, chapter } = loadOwnExercise(body.exerciseId, user.id);
  if (!getApiKey()) return jsonError(503, new AiNotConfiguredError().message);

  const db = getDb();
  const recent = db
    .select({ n: count() })
    .from(schema.chatMessages)
    .where(
      and(
        eq(schema.chatMessages.userId, user.id),
        eq(schema.chatMessages.role, "user"),
        gt(schema.chatMessages.createdAt, new Date(Date.now() - RATE_LIMIT_WINDOW_MS)),
      ),
    )
    .get();
  if ((recent?.n ?? 0) >= RATE_LIMIT_MESSAGES) {
    return jsonError(429, "You've asked a lot of questions! Take a short break and try the sentence on your own.");
  }

  const history = db
    .select({ role: schema.chatMessages.role, content: schema.chatMessages.content })
    .from(schema.chatMessages)
    .where(eq(schema.chatMessages.exerciseId, exercise.id))
    .orderBy(asc(schema.chatMessages.id))
    .all()
    .slice(-HISTORY_LIMIT);

  const messages: ChatMessage[] = [
    {
      role: "system",
      content: helperSystemPrompt({
        chapter,
        tokens: exercise.tokensJson,
        key: exercise.answerKeyJson,
        gradeLevel: user.gradeLevel,
        studentName: user.displayName,
        focusLabelId: body.focusLabelId,
        answerRevealed: Boolean(exercise.revealedAt),
      }),
    },
    ...history,
    { role: "user", content: body.message },
  ];

  db.insert(schema.chatMessages)
    .values({ exerciseId: exercise.id, userId: user.id, role: "user", content: body.message })
    .run();

  const model = getModels().helper;
  const encoder = new TextEncoder();

  const output = new ReadableStream<Uint8Array>({
    async start(controller) {
      let reply = "";
      try {
        for await (const delta of stream({ model, messages, signal: req.signal })) {
          reply += delta;
          controller.enqueue(encoder.encode(delta));
        }
      } catch (err) {
        if (!req.signal.aborted) {
          console.error("[helper]", err);
          const msg = reply ? "\n\n(Sorry, I lost my train of thought. Try asking again.)" : "Sorry, I couldn't answer right now. Try again in a moment.";
          reply += msg;
          controller.enqueue(encoder.encode(msg));
        }
      } finally {
        if (reply.trim()) {
          db.insert(schema.chatMessages)
            .values({ exerciseId: exercise.id, userId: user.id, role: "assistant", content: reply })
            .run();
        }
        try {
          controller.close();
        } catch {
          // client already disconnected
        }
      }
    },
  });

  return new Response(output, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
});
