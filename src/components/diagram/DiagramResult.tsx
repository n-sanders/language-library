"use client";

import { PerfectCelebration } from "@/components/sentence/Celebration";
import { IMPLIED_YOU, type DiagramGradeResult } from "@/lib/diagram/types";
import type { Token } from "@/lib/types";

const wordText = (tokens: Token[], i: number) => (i === IMPLIED_YOU ? "(you)" : tokens[i]?.text ?? "?");

export function DiagramResult({ result, tokens }: { result: DiagramGradeResult; tokens: Token[] }) {
  if (result.perfect) return <PerfectCelebration />;

  const pct = result.total ? Math.round((result.score / result.total) * 100) : 0;
  const misplaced = result.words.filter((w) => w.status === "misplaced");
  const missing = result.words.filter((w) => w.status === "missing");

  return (
    <div className="flex flex-col gap-2 rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
      <p className="text-xl font-bold text-amber-900">
        {pct >= 70 ? "So close!" : "Good try!"} You got {result.score} of {result.total} right ({pct}%).
      </p>
      <ul className="flex flex-col gap-1">
        {misplaced.length > 0 && (
          <li className="flex items-start gap-2">
            <span className="mt-1 h-3 w-3 shrink-0 rounded-full bg-red-400" />
            <span>
              <strong>Not quite in the right spot:</strong> {misplaced.map((w) => `"${wordText(tokens, w.index)}"`).join(", ")}
            </span>
          </li>
        )}
        {missing.length > 0 && (
          <li className="flex items-start gap-2">
            <span className="mt-1 h-3 w-3 shrink-0 rounded-full bg-amber-400" />
            <span>
              <strong>Still waiting for a spot:</strong> {missing.length} {missing.length === 1 ? "word" : "words"}
              {missing.some((w) => w.index === IMPLIED_YOU) && " (one is a subject you can't see in the sentence)"}
            </span>
          </li>
        )}
        {result.emptyElements > 0 && (
          <li className="flex items-start gap-2">
            <span className="mt-1 h-3 w-3 shrink-0 rounded-full bg-stone-400" />
            <span>
              <strong>Empty lines:</strong> {result.emptyElements} {result.emptyElements === 1 ? "part has" : "parts have"} no
              words. Fill {result.emptyElements === 1 ? "it" : "them"} or remove {result.emptyElements === 1 ? "it" : "them"}.
            </span>
          </li>
        )}
      </ul>
      <p className="text-sm text-amber-800">
        Green words are right. Move the red ones, ask Professor Hoot for a hint, or show the answer.
      </p>
    </div>
  );
}
