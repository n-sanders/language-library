import { z } from "zod";
import type { DiagramChapter, SentencePattern } from "@/content/books";
import { toRelations } from "@/lib/diagram/relations";
import { CLAUSE_KINDS, DIAGRAM_ROLES, JOINABLE_ROLES, type DiagramNode } from "@/lib/diagram/types";
import { validateDiagram } from "@/lib/diagram/validate";
import { assertPattern } from "@/lib/patterns";
import { getModels } from "@/lib/settings";
import { detokenize, tokenize } from "@/lib/tokenize";
import type { AnswerKey, Token } from "@/lib/types";
import { AnswerKeyError } from "./answerKey";
import { diagramMessages, diagramSchema } from "./diagramPrompts";
import { parseJson } from "./generate";
import { complete } from "./openrouter";
import { generateWithRetries } from "./retry";

/** Diagram JSON is larger than a tagging key, so give each call a little longer. */
const DIAGRAM_ATTEMPT_TIMEOUT_MS = 30_000;

const responseSchema = z.object({
  words: z.array(z.string()).min(1).max(60),
  nodes: z
    .array(
      z.object({
        id: z.string().min(1).max(40),
        role: z.enum(DIAGRAM_ROLES),
        words: z.array(z.number().int()),
        parent: z.string().nullable(),
        clauseKind: z.enum([...CLAUSE_KINDS, "none"]).optional(),
        joins: z.enum([...JOINABLE_ROLES, "none"]).optional(),
        modifies: z.enum([...JOINABLE_ROLES, "none"]).optional(),
        implied: z.boolean().optional(),
      }),
    )
    .min(2)
    .max(80),
});

export type GeneratedDiagram = { sentence: string; tokens: Token[]; nodes: DiagramNode[]; key: AnswerKey; model: string };

/** Re-tokenizes the model's words with our tokenizer and confirms indices still line up. */
function tokensFromWords(words: string[]): Token[] {
  const tokens = tokenize(words.join(" "));
  const same = tokens.length === words.length && tokens.every((t, i) => t.text === words[i].trim());
  if (!same) {
    throw new AnswerKeyError(
      "The words array must list each word and each punctuation mark as its own entry, with no spaces inside entries.",
    );
  }
  if (tokens.filter((t) => t.isWord).length < 2) throw new AnswerKeyError("The sentence is too short.");
  const last = tokens[tokens.length - 1];
  if (!/^[.?!]$/.test(last.text)) throw new AnswerKeyError("The sentence must end with a period, question mark, or exclamation point.");
  return tokens;
}

export async function generateDiagram(opts: {
  chapter: DiagramChapter;
  topic: string;
  gradeLevel: number;
  avoid: string[];
  pattern?: SentencePattern | null;
}): Promise<GeneratedDiagram> {
  const model = getModels().sentence;
  const schema = diagramSchema();

  return generateWithRetries(
    async (attempt, previousError, timeoutMs) => {
      const content = await complete({
        model,
        jsonSchema: schema,
        temperature: attempt === 1 ? 0.9 : 0.5,
        messages: diagramMessages({ ...opts, previousError }),
        timeoutMs,
      });
      const parsed = responseSchema.parse(parseJson(content));
      const tokens = tokensFromWords(parsed.words);
      const nodes: DiagramNode[] = parsed.nodes.map((n) => ({
        id: n.id,
        role: n.role,
        words: [...new Set(n.words)].sort((a, b) => a - b),
        parent: n.parent,
        ...(n.clauseKind && n.clauseKind !== "none" ? { clauseKind: n.clauseKind } : {}),
        ...(n.joins && n.joins !== "none" ? { joins: n.joins } : {}),
        ...(n.modifies && n.modifies !== "none" ? { modifies: n.modifies } : {}),
        ...(n.implied ? { implied: "you" as const } : {}),
      }));
      validateDiagram(opts.chapter, tokens, nodes);
      if (opts.pattern) assertPattern(opts.chapter, opts.pattern, tokens, { nodes });
      return { sentence: detokenize(tokens), tokens, nodes, key: toRelations(nodes), model };
    },
    { label: "generate-diagram", attemptTimeoutMs: DIAGRAM_ATTEMPT_TIMEOUT_MS },
  );
}
