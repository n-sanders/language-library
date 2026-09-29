import type { Chapter } from "@/content/books";
import type { AnswerKey, GradeResult, LabelResult, StudentAnswer, Token } from "./types";

/** Keeps only valid, taggable token indices for the chapter's labels. */
export function cleanAnswer(chapter: Chapter, tokens: Token[], answer: StudentAnswer): StudentAnswer {
  const cleaned: StudentAnswer = {};
  for (const label of chapter.labels) {
    const raw = Array.isArray(answer[label.id]) ? answer[label.id] : [];
    const valid = raw.filter((i) => Number.isInteger(i) && i >= 0 && i < tokens.length && tokens[i].isWord);
    cleaned[label.id] = [...new Set(valid)].sort((a, b) => a - b);
  }
  return cleaned;
}

/**
 * Word-level grading per label. Each key word is worth a point, and each extra
 * word the student tagged adds to the total so guessing everything doesn't pay off.
 */
export function grade(chapter: Chapter, key: AnswerKey, answer: StudentAnswer): GradeResult {
  const labels: LabelResult[] = chapter.labels.map((label) => {
    const expected = new Set(key[label.id] ?? []);
    const given = answer[label.id] ?? [];
    const correct = given.filter((i) => expected.has(i));
    const extra = given.filter((i) => !expected.has(i));
    const missedCount = expected.size - correct.length;
    return { labelId: label.id, correct, extra, missedCount, perfect: missedCount === 0 && extra.length === 0 };
  });

  const score = labels.reduce((sum, l) => sum + l.correct.length, 0);
  const total = labels.reduce((sum, l) => sum + l.correct.length + l.missedCount + l.extra.length, 0);
  return { labels, score, total, perfect: labels.every((l) => l.perfect) };
}
