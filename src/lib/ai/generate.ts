import { z } from "zod";
import type { TaggingChapter } from "@/content/books";
import { getModels } from "@/lib/settings";
import type { AnswerKey, Token } from "@/lib/types";
import { AnswerKeyError, buildAnswerKey } from "./answerKey";
import { complete } from "./openrouter";
import { sentenceMessages, sentenceSchema } from "./prompts";
import { generateWithRetries } from "./retry";

const responseSchema = z.object({
  sentence: z.string().min(1),
  spans: z.array(z.object({ label: z.string(), text: z.string() })),
});

export function parseJson(content: string): unknown {
  const trimmed = content.trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        // fall through
      }
    }
    throw new AnswerKeyError("The response was not valid JSON.");
  }
}

export type GeneratedSentence = { sentence: string; tokens: Token[]; key: AnswerKey; model: string };

export async function generateSentence(opts: {
  chapter: TaggingChapter;
  topic: string;
  gradeLevel: number;
  avoid: string[];
}): Promise<GeneratedSentence> {
  const model = getModels().sentence;
  const schema = sentenceSchema(opts.chapter);

  return generateWithRetries(
    async (attempt, previousError, timeoutMs) => {
      const content = await complete({
        model,
        jsonSchema: schema,
        temperature: attempt === 1 ? 0.9 : 0.6,
        messages: sentenceMessages({ ...opts, previousError }),
        timeoutMs,
      });
      const parsed = responseSchema.parse(parseJson(content));
      const sentence = parsed.sentence.replace(/\s+/g, " ").trim();
      const { tokens, key } = buildAnswerKey(opts.chapter, sentence, parsed.spans);
      return { sentence, tokens, key, model };
    },
    { label: "generate" },
  );
}
