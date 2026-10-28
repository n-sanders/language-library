import { DiagramCanvas } from "@/components/diagram/DiagramCanvas";
import type { Chapter } from "@/content/books";
import type { Exercise } from "@/db/schema";
import { describeDiagram } from "@/lib/diagram/describe";
import { describeKey } from "@/lib/keyDisplay";

/** An exercise's answer key: label lists for tagging chapters, the diagram plus an outline for diagramming ones. */
export function AnswerKeyView({ chapter, exercise }: { chapter: Chapter; exercise: Exercise }) {
  if (chapter.kind === "diagram") {
    const nodes = exercise.diagramJson ?? [];
    return (
      <div className="mt-2 flex flex-col gap-2">
        <DiagramCanvas nodes={nodes} tokens={exercise.tokensJson} readOnly />
        <ul className="flex flex-col gap-0.5 text-sm">
          {describeDiagram(exercise.tokensJson, nodes).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <ul className="mt-2 flex flex-col gap-0.5 text-sm">
      {describeKey(chapter.labels, exercise.tokensJson, exercise.answerKeyJson).map(({ label, parts }) => (
        <li key={label.id}>
          <span className="font-semibold" style={{ color: label.color }}>
            {label.name}:
          </span>{" "}
          {parts.join(" / ") || "-"}
        </li>
      ))}
    </ul>
  );
}
