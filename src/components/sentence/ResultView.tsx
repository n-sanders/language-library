"use client";

import type { LabelDef } from "@/content/books";
import type { GradeResult, Token } from "@/lib/types";

export function ResultView({
  result,
  labels,
  tokens,
}: {
  result: GradeResult;
  labels: LabelDef[];
  tokens: Token[];
}) {
  const pct = result.total ? Math.round((result.score / result.total) * 100) : 0;

  if (result.perfect) {
    return (
      <div className="rounded-xl border-2 border-emerald-400 bg-emerald-50 p-4 text-emerald-900">
        <p className="text-2xl font-bold">🎉 Perfect! You found every one.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
      <p className="text-xl font-bold text-amber-900">
        {pct >= 70 ? "So close!" : "Good try!"} You got {result.score} of {result.total} right ({pct}%).
      </p>
      <ul className="flex flex-col gap-1">
        {result.labels.map((lr) => {
          const label = labels.find((l) => l.id === lr.labelId);
          if (!label) return null;
          const parts: string[] = [];
          if (lr.correct.length) parts.push(`${lr.correct.length} right`);
          if (lr.extra.length) parts.push(`${lr.extra.map((i) => `"${tokens[i].text}"`).join(", ")} ${lr.extra.length === 1 ? "isn't one" : "aren't"}`);
          if (lr.missedCount) parts.push(`${lr.missedCount} still hiding`);
          return (
            <li key={lr.labelId} className="flex items-start gap-2">
              <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: label.color }} />
              <span>
                <strong>{label.name}:</strong> {lr.perfect ? "all correct ✓" : parts.join(", ") || "none tagged yet"}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="text-sm text-amber-800">
        Change your tags and check again, ask the helper for a hint, or show the answer.
      </p>
    </div>
  );
}
