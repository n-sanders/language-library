"use client";

import type { LabelDef } from "@/content/books";
import type { Token } from "@/lib/types";

export type TokenFeedback = "correct" | "extra";

const GAP = 12;

export function TaggableSentence({
  tokens,
  labels,
  tags,
  activeId,
  onToggle,
  feedback,
  readOnly,
  celebrate,
}: {
  tokens: Token[];
  labels: LabelDef[];
  tags: Record<string, number[]>;
  activeId: string;
  onToggle: (index: number) => void;
  feedback?: Map<number, TokenFeedback>;
  readOnly?: boolean;
  celebrate?: boolean;
}) {
  const tagSets = Object.fromEntries(labels.map((l) => [l.id, new Set(tags[l.id] ?? [])]));
  const active = labels.find((l) => l.id === activeId) ?? labels[0];

  return (
    <div className="flex flex-wrap items-start gap-y-5 font-book text-3xl leading-none sm:text-4xl">
      {tokens.map((token, i) => {
        const next = tokens[i + 1];
        const gapAfter = next?.isWord ? GAP : 0;

        if (!token.isWord) {
          return (
            <span key={i} className="py-1.5" style={{ paddingRight: gapAfter }}>
              {token.text}
            </span>
          );
        }

        const activeTagged = tagSets[active.id].has(i);
        const status = feedback?.get(i);
        const ring =
          status === "correct"
            ? "ring-2 ring-emerald-500"
            : status === "extra"
              ? "outline-2 outline-dashed outline-red-500"
              : "";

        return (
          <button
            key={i}
            type="button"
            disabled={readOnly}
            onClick={() => onToggle(i)}
            aria-pressed={activeTagged}
            aria-label={`${token.text}${activeTagged ? `, tagged ${active.name}` : ""}`}
            className="group relative flex flex-col items-stretch disabled:cursor-default"
            style={{ paddingRight: gapAfter }}
          >
            {status && (
              <span
                className={`absolute -top-3 left-0 z-10 flex h-5 w-5 items-center justify-center rounded-full font-sans text-xs font-bold text-white ${
                  status === "correct" ? "bg-emerald-500" : "bg-red-500"
                }`}
              >
                {status === "correct" ? "✓" : "✗"}
              </span>
            )}
            <span
              className={`rounded-md px-1 py-1.5 transition-colors ${ring} ${
                readOnly ? "" : "group-hover:bg-amber-100"
              } ${celebrate ? "word-hop" : ""}`}
              style={{
                backgroundColor: activeTagged ? `${active.color}26` : undefined,
                animationDelay: celebrate ? `${i * 60}ms` : undefined,
              }}
            >
              {token.text}
            </span>
            <span className="mt-1 flex flex-col gap-1">
              {labels.map((label) => {
                const on = tagSets[label.id].has(i);
                const fromPrev = on && tokens[i - 1]?.isWord && tagSets[label.id].has(i - 1);
                const toNext = on && next?.isWord && tagSets[label.id].has(i + 1);
                return (
                  <span
                    key={label.id}
                    className="h-1.5"
                    style={{
                      backgroundColor: on ? label.color : "transparent",
                      marginRight: toNext ? -gapAfter : 0,
                      borderTopLeftRadius: fromPrev ? 0 : 999,
                      borderBottomLeftRadius: fromPrev ? 0 : 999,
                      borderTopRightRadius: toNext ? 0 : 999,
                      borderBottomRightRadius: toNext ? 0 : 999,
                    }}
                  />
                );
              })}
            </span>
          </button>
        );
      })}
    </div>
  );
}
