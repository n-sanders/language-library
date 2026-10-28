"use client";

import type { ElementId, PaletteElement } from "@/lib/diagram/draft";

export function ElementPalette({
  elements,
  selectedName,
  disabled,
  onAdd,
}: {
  elements: PaletteElement[];
  /** What is selected on the diagram, e.g. "subject", or null when nothing is. */
  selectedName: string | null;
  disabled?: boolean;
  onAdd: (id: ElementId) => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-white/70 p-3">
      <p className="text-sm text-amber-800">
        <strong>Diagram parts</strong>
        {selectedName ? (
          <>
            {" "}
            for the selected <strong>{selectedName}</strong>:
          </>
        ) : (
          ": click a line on the diagram to see what you can add to it."
        )}
      </p>
      {elements.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {elements.map((el) => (
            <button
              key={el.id}
              type="button"
              disabled={disabled}
              onClick={() => onAdd(el.id)}
              title={el.hint}
              className={`rounded-lg border-2 px-3 py-1.5 text-sm font-semibold shadow-sm transition hover:-translate-y-0.5 disabled:opacity-50 ${
                el.id === "remove"
                  ? "border-red-200 bg-red-50 text-red-800 hover:border-red-400"
                  : "border-emerald-300 bg-emerald-50 text-emerald-900 hover:border-emerald-500"
              }`}
            >
              {el.id === "remove" ? "✕ " : "+ "}
              {el.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
