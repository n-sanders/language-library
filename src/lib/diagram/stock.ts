import type { DiagramChapter, SentencePattern } from "@/content/books";
import { AnswerKeyError } from "@/lib/ai/answerKey";
import type { GeneratedDiagram } from "@/lib/ai/generateDiagram";
import { patternMismatch } from "@/lib/patterns";
import { detokenize, tokenize } from "@/lib/tokenize";
import { toRelations } from "./relations";
import { validateDiagram } from "./validate";

/** The next hand-built example this student has not practiced recently, checked like a generated key. */
export function stockDiagram(chapter: DiagramChapter, avoid: string[], pattern?: SentencePattern | null): GeneratedDiagram {
  if (chapter.examples.length === 0) {
    throw new AnswerKeyError("This chapter has no sample sentences.");
  }
  const bank = chapter.examples.map((item) => {
    const tokens = tokenize(item.sentence);
    return { item, tokens, sentence: detokenize(tokens) };
  });
  const matching = pattern ? bank.filter((item) => patternMismatch(chapter, pattern, item.tokens, { nodes: item.item.nodes }) === null) : [];
  const pool = matching.length > 0 ? matching : bank;
  const chosen = pool.find((item) => !avoid.includes(item.sentence)) ?? pool[0];
  const nodes = chosen.item.nodes.map((node) => ({ ...node }));
  validateDiagram(chapter, chosen.tokens, nodes);
  return { sentence: chosen.sentence, tokens: chosen.tokens, nodes, key: toRelations(nodes), model: "stock" };
}
