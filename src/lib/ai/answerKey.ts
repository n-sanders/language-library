import type { Chapter } from "@/content/books";
import { normalizeWord, tokenize } from "@/lib/tokenize";
import type { AnswerKey, Token } from "@/lib/types";

export type RawSpan = { label: string; text: string };

export class AnswerKeyError extends Error {}

/** Finds where the span's words appear in the sentence, preferring positions not already used by this label. */
function locateSpan(tokens: Token[], spanText: string, usedForLabel: Set<number>): number[] | null {
  const spanWords = tokenize(spanText)
    .filter((t) => t.isWord)
    .map((t) => normalizeWord(t.text));
  if (spanWords.length === 0) return null;

  const wordPositions = tokens.flatMap((t, i) => (t.isWord ? [i] : []));
  const words = wordPositions.map((i) => normalizeWord(tokens[i].text));

  let fallback: number[] | null = null;
  for (let start = 0; start + spanWords.length <= words.length; start++) {
    if (!spanWords.every((w, k) => words[start + k] === w)) continue;
    const indices = wordPositions.slice(start, start + spanWords.length);
    if (indices.every((i) => !usedForLabel.has(i))) return indices;
    fallback ??= indices;
  }
  return fallback;
}

function isContiguous(tokens: Token[], indices: number[]): boolean {
  const sorted = [...indices].sort((a, b) => a - b);
  for (let k = 1; k < sorted.length; k++) {
    for (let i = sorted[k - 1] + 1; i < sorted[k]; i++) {
      if (tokens[i].isWord) return false;
    }
  }
  return true;
}

/**
 * Maps the model's text spans onto our own tokenization and checks the key is usable.
 * Throws AnswerKeyError with a reason the retry prompt can use.
 */
export function buildAnswerKey(chapter: Chapter, sentence: string, spans: RawSpan[]): { tokens: Token[]; key: AnswerKey } {
  const tokens = tokenize(sentence);
  if (tokens.filter((t) => t.isWord).length < 3) throw new AnswerKeyError("The sentence is too short.");

  const labelIds = new Set(chapter.labels.map((l) => l.id));
  const key: AnswerKey = Object.fromEntries(chapter.labels.map((l) => [l.id, [] as number[]]));

  for (const span of spans) {
    if (!labelIds.has(span.label)) throw new AnswerKeyError(`Unknown label "${span.label}".`);
    const used = new Set(key[span.label]);
    const indices = locateSpan(tokens, span.text, used);
    if (!indices) throw new AnswerKeyError(`The span "${span.text}" does not appear word-for-word in the sentence.`);
    for (const i of indices) used.add(i);
    key[span.label] = [...used].sort((a, b) => a - b);
  }

  for (const label of chapter.labels) {
    if (key[label.id].length === 0) throw new AnswerKeyError(`No words were labeled "${label.id}".`);
  }

  validateChapterRules(tokens, key, spans);
  return { tokens, key };
}

function validateChapterRules(tokens: Token[], key: AnswerKey, spans: RawSpan[]) {
  const has = (id: string) => id in key;
  const subset = (inner: number[], outer: number[]) => inner.every((i) => outer.includes(i));

  if (has("complete-subject") && !isContiguous(tokens, key["complete-subject"])) {
    throw new AnswerKeyError("The complete subject must be one continuous group of words.");
  }

  if (has("simple-subject") && has("complete-subject")) {
    if (!subset(key["simple-subject"], key["complete-subject"])) {
      throw new AnswerKeyError("The simple subject must be inside the complete subject.");
    }
  }

  if (has("dependent-clause")) {
    const clauseSpans = spans.filter((s) => s.label === "dependent-clause");
    if (clauseSpans.length !== 1) throw new AnswerKeyError("There must be exactly one dependent clause.");
    if (!isContiguous(tokens, key["dependent-clause"])) {
      throw new AnswerKeyError("The dependent clause must be one continuous group of words.");
    }
  }

  if (has("dependent-clause") && has("complete-subject")) {
    if (key["complete-subject"].some((i) => key["dependent-clause"].includes(i))) {
      throw new AnswerKeyError("The complete subject must belong to the independent clause, not the dependent clause.");
    }
  }

  if (has("dependent-clause") && has("subordinating-conjunction")) {
    if (!subset(key["subordinating-conjunction"], key["dependent-clause"])) {
      throw new AnswerKeyError("The subordinating conjunction must be inside the dependent clause.");
    }
    if (key["dependent-clause"][0] !== key["subordinating-conjunction"][0]) {
      throw new AnswerKeyError("The dependent clause must start with its subordinating conjunction.");
    }
  }

  for (const span of spans.filter((s) => s.label === "prepositional-phrase")) {
    const words = tokenize(span.text).filter((t) => t.isWord);
    if (words.length < 2) throw new AnswerKeyError(`"${span.text}" is too short to be a prepositional phrase.`);
  }
}
