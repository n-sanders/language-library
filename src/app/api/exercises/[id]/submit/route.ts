import { and, count, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { handle, jsonError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { loadOwnExercise } from "@/lib/exercises";
import { cleanAnswer, grade } from "@/lib/grading";

const bodySchema = z.object({
  answer: z.record(z.string(), z.array(z.number().int())),
  durationS: z.number().min(0).max(24 * 60 * 60).default(0),
});

export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser();
  const { id } = await ctx.params;
  const { exercise, chapter } = loadOwnExercise(Number(id), user.id);
  if (exercise.revealedAt) return jsonError(409, "The answer was already shown for this sentence.");

  const body = bodySchema.parse(await req.json());
  const answer = cleanAnswer(chapter, exercise.tokensJson, body.answer);
  const result = grade(chapter, exercise.answerKeyJson, answer);

  const db = getDb();
  const hints = db
    .select({ n: count() })
    .from(schema.chatMessages)
    .where(and(eq(schema.chatMessages.exerciseId, exercise.id), eq(schema.chatMessages.role, "user")))
    .get();

  db.insert(schema.attempts)
    .values({
      exerciseId: exercise.id,
      userId: user.id,
      answerJson: answer,
      score: result.score,
      total: result.total,
      hintsUsed: hints?.n ?? 0,
      durationS: Math.round(body.durationS),
    })
    .run();

  return NextResponse.json({ result, key: result.perfect ? exercise.answerKeyJson : undefined });
});
