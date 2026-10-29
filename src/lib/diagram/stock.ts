import type { DiagramChapter } from "@/content/books";
import { AnswerKeyError } from "@/lib/ai/answerKey";
import type { GeneratedDiagram } from "@/lib/ai/generateDiagram";
import { detokenize, tokenize } from "@/lib/tokenize";
import { toRelations } from "./relations";
import { validateDiagram } from "./validate";

/** The next hand-built example this student has not practiced recently, checked like a generated key. */
export function stockDiagram(chapter: DiagramChapter, avoid: string[]): GeneratedDiagram {
  if (chapter.examples.length === 0) {
    throw new AnswerKeyError("This chapter has no sample sentences.");
  }
  const bank = chapter.examples.map((item) => {
    const tokens = tokenize(item.sentence);
    return { item, tokens, sentence: detokenize(tokens) };
  });
  const chosen = bank.find((item) => !avoid.includes(item.sentence)) ?? bank[0];
  const nodes = chosen.item.nodes.map((node) => ({ ...node }));
  validateDiagram(chapter, chosen.tokens, nodes);
  return { sentence: chosen.sentence, tokens: chosen.tokens, nodes, key: toRelations(nodes), model: "stock" };
}
