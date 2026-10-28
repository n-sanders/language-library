"use client";

import { motion } from "framer-motion";
import { useRef } from "react";
import type { Token } from "@/lib/types";

/** Finds the diagram slot under a screen point, if any. */
function slotAt(clientX: number, clientY: number): string | null {
  for (const el of document.elementsFromPoint(clientX, clientY)) {
    const slot = (el as HTMLElement).closest?.("[data-slot-id]");
    if (slot) return slot.getAttribute("data-slot-id");
  }
  return null;
}

export function WordBank({
  tokens,
  placed,
  heldWord,
  disabled,
  onHold,
  onDrop,
}: {
  tokens: Token[];
  placed: Set<number>;
  heldWord: number | null;
  disabled?: boolean;
  onHold: (word: number | null) => void;
  onDrop: (word: number, nodeId: string) => void;
}) {
  const words = tokens.flatMap((t, i) => (t.isWord && !placed.has(i) ? [i] : []));
  const justDragged = useRef(false);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-amber-800">
        <strong>Word bank:</strong> drag a word onto a line, or tap a word and then tap its spot.
      </p>
      <div className="flex min-h-14 flex-wrap items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/70 p-3">
        {words.length === 0 && <span className="text-sm text-amber-700">Every word is on the diagram!</span>}
        {words.map((i) => (
          <motion.button
            key={i}
            type="button"
            disabled={disabled}
            drag={!disabled}
            dragSnapToOrigin
            dragMomentum={false}
            whileDrag={{ scale: 1.1, zIndex: 50, cursor: "grabbing" }}
            onClick={() => {
              if (justDragged.current) {
                justDragged.current = false;
                return;
              }
              if (!disabled) onHold(heldWord === i ? null : i);
            }}
            onDragStart={() => {
              justDragged.current = true;
            }}
            onDragEnd={(_e, info) => {
              const nodeId = slotAt(info.point.x - window.scrollX, info.point.y - window.scrollY);
              if (nodeId) onDrop(i, nodeId);
              // The click that ends a drag (if the browser sends one) arrives right after this.
              setTimeout(() => {
                justDragged.current = false;
              }, 0);
            }}
            aria-pressed={heldWord === i}
            className={`relative cursor-grab touch-none rounded-lg border-2 px-3 py-1 font-book text-lg shadow-sm select-none ${
              heldWord === i ? "border-sky-500 bg-sky-100 text-sky-950" : "border-amber-300 bg-white text-amber-950 hover:border-amber-500"
            }`}
          >
            {tokens[i].text}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
