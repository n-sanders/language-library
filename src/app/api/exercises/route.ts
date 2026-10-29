import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { getChapter, isDiagramChapter } from "@/content/books";
import { sanitizeTopic } from "@/content/topics";
import { AnswerKeyError } from "@/lib/ai/answerKey";
import { generateSentence } from "@/lib/ai/generate";
import { generateDiagram } from "@/lib/ai/generateDiagram";
import { AiNotConfiguredError } from "@/lib/ai/openrouter";
import { GenerationFailedError } from "@/lib/ai/retry";
import { handle, jsonError } from "@/lib/api";
import { requireApiUser } from "@/lib/auth";
import { structureOf } from "@/lib/diagram/skeleton";
import { stockDiagram } from "@/lib/diagram/stock";
import { stockSentencesEnabled } from "@/lib/settings";

const bodySchema = z.object({
  book: z.string(),
  chapter: z.string(),
  topic: z.string().max(100),
});

export const POST = handle(async (req: Request) => {
  const user = await requireApiUser();
  const body = bodySchema.parse(await req.json());
  const found = getChapter(body.book, body.chapter);
  if (!found) return jsonError(404, "That chapter doesn't exist.");

  const topic = sanitizeTopic(body.topic);
  if (!topic) return jsonError(400, "Pick a topic first.");

  const db = getDb();
  const avoid = db
    .select({ sentence: schema.exercises.sentence })
    .from(schema.exercises)
    .where(
      and(
        eq(schema.exercises.userId, user.id),
        eq(schema.exercises.book, body.book),
        eq(schema.exercises.chapter, body.chapter),
      ),
    )
    .orderBy(desc(schema.exercises.id))
    .limit(8)
    .all()
    .map((r) => r.sentence);

  const { chapter } = found;
  try {
    const opts = { topic, gradeLevel: user.gradeLevel, avoid };
    const generated =
      isDiagramChapter(chapter) && stockSentencesEnabled()
        ? stockDiagram(chapter, avoid)
        : isDiagramChapter(chapter)
          ? await generateDiagram({ chapter, ...opts })
          : { ...(await generateSentence({ chapter, ...opts })), nodes: null };
    const { nodes } = generated;

    const row = db
      .insert(schema.exercises)
      .values({
        userId: user.id,
        book: body.book,
        chapter: body.chapter,
        topic,
        sentence: generated.sentence,
        tokensJson: generated.tokens,
        answerKeyJson: generated.key,
        diagramJson: nodes,
        model: generated.model,
      })
      .returning({ id: schema.exercises.id })
      .get();

    return NextResponse.json({
      id: row.id,
      topic,
      tokens: generated.tokens,
      ...(nodes ? { structure: structureOf(nodes) } : {}),
    });
  } catch (err) {
    if (err instanceof AiNotConfiguredError) return jsonError(503, err.message);
    if (err instanceof AnswerKeyError) return jsonError(422, err.message);
    if (err instanceof GenerationFailedError) return jsonError(422, err.message, "generation_failed");
    throw err;
  }
});
