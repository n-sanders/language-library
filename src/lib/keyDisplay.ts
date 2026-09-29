import type { LabelDef } from "@/content/books";
import type { AnswerKey, Token } from "./types";

/** Groups a label's token indices into readable runs, e.g. ["the fluffy cat", "under the bed"]. */
export function describeTokens(tokens: Token[], indices: number[]): string[] {
  const sorted = [...indices].sort((a, b) => a - b);
  const runs: number[][] = [];
  for (const i of sorted) {
    const run = runs[runs.length - 1];
    const prev = run?.[run.length - 1];
    const adjacent = prev !== undefined && tokens.slice(prev + 1, i).every((t) => !t.isWord);
    if (run && adjacent) run.push(i);
    else runs.push([i]);
  }
  return runs.map((run) => run.map((i) => tokens[i]?.text ?? "?").join(" "));
}

export function describeKey(labels: LabelDef[], tokens: Token[], key: AnswerKey) {
  return labels.map((label) => ({ label, parts: describeTokens(tokens, key[label.id] ?? []) }));
}
