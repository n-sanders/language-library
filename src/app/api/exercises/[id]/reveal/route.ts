import { count, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb, schema } from "@/db";
import { handle } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { loadOwnExercise } from "@/lib/exercises";
import { grade } from "@/lib/grading";

export const POST = handle(async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser();
  const { id } = await ctx.params;
  const { exercise, chapter } = loadOwnExercise(Number(id), user.id);
  const db = getDb();

  if (!exercise.revealedAt) {
    const tries = db
      .select({ n: count() })
      .from(schema.attempts)
      .where(eq(schema.attempts.exerciseId, exercise.id))
      .get();

    // Showing the answer before trying counts as a zero first try, so progress stays honest.
    if (!tries?.n) {
      const empty = Object.fromEntries(chapter.labels.map((l) => [l.id, [] as number[]]));
      const result = grade(chapter, exercise.answerKeyJson, empty);
      db.insert(schema.attempts)
        .values({ exerciseId: exercise.id, userId: user.id, answerJson: empty, score: 0, total: result.total })
        .run();
    }

    db.update(schema.exercises).set({ revealedAt: new Date() }).where(eq(schema.exercises.id, exercise.id)).run();
  }

  return NextResponse.json({ key: exercise.answerKeyJson });
});
