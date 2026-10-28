import type { AnswerKey } from "@/lib/types";
import { toRelations, wordPlacements } from "./relations";
import type { DiagramGradeResult, DraftNode, WordStatus } from "./types";

/** Added elements that still have no words. Skeleton (fixed) slots don't count; their words are already counted as missing. */
export function countEmptyElements(nodes: DraftNode[]): number {
  return nodes.filter((n) => n.role !== "clause" && !n.fixed && !n.implied && n.words.length === 0).length;
}

/**
 * Word-level grading. Each key word (and an implied "(you)") is worth a point and is correct when the
 * student put it in the same relation, e.g. "modifier of bird". Empty added elements add to the total.
 */
export function gradeDiagram(key: AnswerKey, draft: DraftNode[]): { result: DiagramGradeResult; relations: AnswerKey } {
  const relations = toRelations(draft);
  const expected = wordPlacements(key);
  const given = wordPlacements(relations);

  const words = [...expected.entries()]
    .sort(([a], [b]) => a - b)
    .map(([index, [rel]]) => {
      const placed = given.get(index) ?? [];
      const status: WordStatus = placed.length === 0 ? "missing" : placed.length === 1 && placed[0] === rel ? "correct" : "misplaced";
      return { index, status };
    });

  const emptyElements = countEmptyElements(draft);
  const score = words.filter((w) => w.status === "correct").length;
  const total = words.length + emptyElements;
  return { result: { words, emptyElements, score, total, perfect: score === total }, relations };
}
