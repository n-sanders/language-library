import { and, count, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { isDiagramChapter } from "@/content/books";
import { handle, jsonError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { gradeDiagram } from "@/lib/diagram/grade";
import { CLAUSE_KINDS, DIAGRAM_MODES, DIAGRAM_ROLES, JOINABLE_ROLES } from "@/lib/diagram/types";
import { sanitizeDraft } from "@/lib/diagram/validate";
import { loadOwnExercise } from "@/lib/exercises";
import { cleanAnswer, grade } from "@/lib/grading";

const durationS = z.number().min(0).max(24 * 60 * 60).default(0);

const tagBodySchema = z.object({
  answer: z.record(z.string(), z.array(z.number().int())),
  durationS,
});

const draftNodeSchema = z.object({
  id: z.string().min(1).max(40),
  role: z.enum(DIAGRAM_ROLES),
  words: z.array(z.number().int()).max(12),
  parent: z.string().max(40).nullable(),
  clauseKind: z.enum(CLAUSE_KINDS).optional(),
  joins: z.enum(JOINABLE_ROLES).optional(),
  modifies: z.enum(JOINABLE_ROLES).optional(),
  implied: z.literal("you").optional(),
  fixed: z.boolean().optional(),
});

const diagramBodySchema = z.object({
  diagram: z.object({ nodes: z.array(draftNodeSchema).max(100) }),
  mode: z.enum(DIAGRAM_MODES),
  durationS,
});

export const POST = handle(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireApiUser();
  const { id } = await ctx.params;
  const { exercise, chapter } = loadOwnExercise(Number(id), user.id);
  if (exercise.revealedAt) return jsonError(409, "The answer was already shown for this sentence.");

  const db = getDb();
  const hints = db
    .select({ n: count() })
    .from(schema.chatMessages)
    .where(and(eq(schema.chatMessages.exerciseId, exercise.id), eq(schema.chatMessages.role, "user")))
    .get();

  const save = (answer: Record<string, number[]>, score: number, total: number, seconds: number, mode: (typeof DIAGRAM_MODES)[number] | null) =>
    db
      .insert(schema.attempts)
      .values({
        exerciseId: exercise.id,
        userId: user.id,
        answerJson: answer,
        score,
        total,
        hintsUsed: hints?.n ?? 0,
        durationS: Math.round(seconds),
        mode,
      })
      .run();

  if (isDiagramChapter(chapter)) {
    if (!exercise.diagramJson) return jsonError(500, "This sentence is missing its diagram.");
    const body = diagramBodySchema.parse(await req.json());
    const draft = sanitizeDraft(exercise.tokensJson, body.diagram.nodes);
    const { result, relations } = gradeDiagram(exercise.answerKeyJson, draft);
    save(relations, result.score, result.total, body.durationS, body.mode);
    return NextResponse.json({ result, diagram: result.perfect ? exercise.diagramJson : undefined });
  }

  const body = tagBodySchema.parse(await req.json());
  const answer = cleanAnswer(chapter, exercise.tokensJson, body.answer);
  const result = grade(chapter, exercise.answerKeyJson, answer);
  save(answer, result.score, result.total, body.durationS, null);
  return NextResponse.json({ result, key: result.perfect ? exercise.answerKeyJson : undefined });
});
