"use client";

import { useMemo } from "react";
import { nodeText } from "@/lib/diagram/describe";
import { layoutDiagram, slotWidth, WORD_H } from "@/lib/diagram/layout";
import type { DiagramNode, DraftNode, WordStatus } from "@/lib/diagram/types";
import { ROLE_NAMES } from "@/lib/diagram/types";
import type { Token } from "@/lib/types";

const STATUS_CLASSES: Record<WordStatus, string> = {
  correct: "border-emerald-500 bg-emerald-100 text-emerald-900",
  misplaced: "border-red-400 bg-red-100 text-red-900",
  missing: "border-amber-300 bg-white text-amber-950",
};

export function DiagramCanvas({
  nodes,
  tokens,
  selectedId = null,
  armed = false,
  wordStatus,
  readOnly = false,
  emptyMessage = "Nothing here yet.",
  onSlotClick,
  onWordClick,
}: {
  nodes: (DiagramNode | DraftNode)[];
  tokens: Token[];
  selectedId?: string | null;
  /** A word is picked up and waiting to be placed, so every slot is a target. */
  armed?: boolean;
  wordStatus?: Map<number, WordStatus>;
  readOnly?: boolean;
  emptyMessage?: string;
  onSlotClick?: (nodeId: string) => void;
  onWordClick?: (word: number) => void;
}) {
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const layout = useMemo(
    () =>
      layoutDiagram(nodes, (n) => {
        if (n.implied) return slotWidth(["(you)"]);
        return slotWidth(n.words.map((w) => tokens[w]?.text ?? "?"));
      }),
    [nodes, tokens],
  );

  if (layout.slots.length === 0) {
    return (
      <div className="flex min-h-40 items-center justify-center rounded-xl border-2 border-dashed border-amber-300 bg-white/60 p-6 text-center text-amber-800">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-amber-200 bg-white/80">
      <div className="relative mx-auto" style={{ width: layout.width, height: layout.height }}>
        <svg width={layout.width} height={layout.height} className="absolute inset-0" aria-hidden>
          {layout.segs.map((s, i) => (
            <line
              key={i}
              x1={s.x1}
              y1={s.y1}
              x2={s.x2}
              y2={s.y2}
              stroke="#5a3620"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeDasharray={s.dashed ? "6 5" : undefined}
            />
          ))}
        </svg>

        {layout.slots.map((slot) => {
          const node = byId.get(slot.nodeId);
          if (!node) return null;
          const selected = node.id === selectedId;
          const empty = node.words.length === 0 && !node.implied;
          const label = ROLE_NAMES[node.role];
          return (
            <div
              key={slot.nodeId}
              data-slot-id={readOnly ? undefined : slot.nodeId}
              role={readOnly ? undefined : "button"}
              tabIndex={readOnly ? undefined : 0}
              aria-label={readOnly ? undefined : `${label}${empty ? " (empty)" : `: ${nodeText(tokens, node)}`}`}
              onClick={readOnly ? undefined : () => onSlotClick?.(node.id)}
              onKeyDown={
                readOnly
                  ? undefined
                  : (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSlotClick?.(node.id);
                      }
                    }
              }
              title={readOnly ? undefined : label}
              className={`absolute flex items-end gap-1 rounded-md px-0.5 pb-0.5 transition-colors ${
                readOnly ? "" : "cursor-pointer"
              } ${selected ? "bg-amber-200/70 ring-2 ring-amber-500" : armed && !readOnly ? "bg-sky-100/70 ring-1 ring-sky-300" : ""}`}
              style={{
                left: slot.x,
                top: slot.y - WORD_H,
                width: slot.w,
                height: WORD_H,
                transform: slot.angle ? `rotate(${slot.angle}deg)` : undefined,
                transformOrigin: "0% 100%",
              }}
            >
              {node.implied ? (
                <span className="rounded border border-amber-300 bg-amber-50 px-1.5 text-sm leading-6 font-semibold whitespace-nowrap text-amber-900">
                  (you)
                </span>
              ) : empty ? (
                <span className="h-5 w-full rounded border-2 border-dashed border-amber-300/80" />
              ) : readOnly ? (
                node.words.map((w) => (
                  <span
                    key={w}
                    className={`rounded border px-1.5 font-book text-base leading-6 whitespace-nowrap ${
                      wordStatus ? STATUS_CLASSES[wordStatus.get(w) ?? "missing"] : "border-transparent text-amber-950"
                    }`}
                  >
                    {tokens[w]?.text}
                  </span>
                ))
              ) : (
                node.words.map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onWordClick?.(w);
                    }}
                    title="Send back to the word bank"
                    className={`rounded border px-1.5 font-book text-base leading-6 whitespace-nowrap shadow-sm hover:-translate-y-0.5 ${
                      STATUS_CLASSES[wordStatus?.get(w) ?? "missing"]
                    }`}
                  >
                    {tokens[w]?.text}
                  </button>
                ))
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
