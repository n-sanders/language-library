import { count, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { isDiagramChapter } from "@/content/books";
import { handle } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { gradeDiagram } from "@/lib/diagram/grade";
import { DIAGRAM_MODES } from "@/lib/diagram/types";
import { loadOwnExercise } from "@/lib/exercises";
import { grade } from "@/lib/grading";

const bodySchema = z.object({ mode: z.enum(DIAGRAM_MODES).optional() });

export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser();
  const { id } = await ctx.params;
  const { exercise, chapter } = loadOwnExercise(Number(id), user.id);
  const { mode } = bodySchema.parse(await req.json().catch(() => ({})));
  const db = getDb();

  if (!exercise.revealedAt) {
    const tries = db
      .select({ n: count() })
      .from(schema.attempts)
      .where(eq(schema.attempts.exerciseId, exercise.id))
      .get();

    // Showing the answer before trying counts as a zero first try, so progress stays honest.
    if (!tries?.n) {
      const diagram = isDiagramChapter(chapter);
      const empty = diagram ? {} : Object.fromEntries(chapter.labels.map((l) => [l.id, [] as number[]]));
      const total = diagram
        ? gradeDiagram(exercise.answerKeyJson, []).result.total
        : grade(chapter, exercise.answerKeyJson, empty).total;
      db.insert(schema.attempts)
        .values({ exerciseId: exercise.id, userId: user.id, answerJson: empty, score: 0, total, mode: diagram ? (mode ?? null) : null })
        .run();
    }

    db.update(schema.exercises).set({ revealedAt: new Date() }).where(eq(schema.exercises.id, exercise.id)).run();
  }

  return NextResponse.json({ key: exercise.answerKeyJson, diagram: exercise.diagramJson ?? undefined });
});
