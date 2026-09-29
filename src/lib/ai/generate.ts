import { z } from "zod";
import type { Chapter } from "@/content/books";
import { getModels } from "@/lib/settings";
import type { AnswerKey, Token } from "@/lib/types";
import { AnswerKeyError, buildAnswerKey } from "./answerKey";
import { complete } from "./openrouter";
import { sentenceMessages, sentenceSchema } from "./prompts";

const MAX_TRIES = 3;

const responseSchema = z.object({
  sentence: z.string().min(1),
  spans: z.array(z.object({ label: z.string(), text: z.string() })),
});

function parseJson(content: string): unknown {
  const trimmed = content.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
    throw new AnswerKeyError("The response was not valid JSON.");
  }
}

export type GeneratedSentence = { sentence: string; tokens: Token[]; key: AnswerKey; model: string };

export async function generateSentence(opts: {
  chapter: Chapter;
  topic: string;
  gradeLevel: number;
  avoid: string[];
}): Promise<GeneratedSentence> {
  const model = getModels().sentence;
  const schema = sentenceSchema(opts.chapter);
  let previousError: string | undefined;

  for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
    const content = await complete({
      model,
      jsonSchema: schema,
      temperature: attempt === 1 ? 0.9 : 0.6,
      messages: sentenceMessages({ ...opts, previousError }),
    });

    try {
      const parsed = responseSchema.parse(parseJson(content));
      const sentence = parsed.sentence.replace(/\s+/g, " ").trim();
      const { tokens, key } = buildAnswerKey(opts.chapter, sentence, parsed.spans);
      return { sentence, tokens, key, model };
    } catch (err) {
      previousError = err instanceof AnswerKeyError ? err.message : "The JSON did not match the required format.";
      console.warn(`[generate] attempt ${attempt} rejected: ${previousError}`);
    }
  }

  throw new Error("The AI had trouble writing a good sentence. Please try again or pick another topic.");
}
