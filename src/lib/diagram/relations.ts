import type { AnswerKey } from "@/lib/types";
import { DiagramIndex } from "./tree";
import { IMPLIED_YOU, type DiagramNode } from "./types";

const CLAUSE_ANCHORS = { main: "main", coordinate: "coord", subordinate: "sub" } as const;

function anchor(node: DiagramNode): string {
  if (node.role === "clause") return CLAUSE_ANCHORS[node.clauseKind ?? "main"];
  if (node.implied) return "you";
  return node.words.length ? String(Math.min(...node.words)) : `empty:${node.id}`;
}

/** A node's place in the diagram, independent of node ids and sibling order, e.g. "modifier@2" or "subject@main". */
export function relationOf(index: DiagramIndex, node: DiagramNode): string {
  const parent = index.get(node.parent);
  const role = node.role === "conjunction" ? `conjunction:${node.joins ?? "?"}` : node.role;
  return `${role}@${parent ? anchor(parent) : "root"}`;
}

/** Relation -> word indices. An implied "(you)" subject is recorded as IMPLIED_YOU. */
export function toRelations(nodes: DiagramNode[]): AnswerKey {
  const index = new DiagramIndex(nodes);
  const out: AnswerKey = {};
  for (const node of nodes) {
    if (node.role === "clause") continue;
    const words = node.implied ? [IMPLIED_YOU] : node.words;
    if (words.length === 0) continue;
    const rel = relationOf(index, node);
    out[rel] = [...new Set([...(out[rel] ?? []), ...words])].sort((a, b) => a - b);
  }
  return out;
}

/** Word index -> relations it was placed in (a word placed twice has two). */
export function wordPlacements(relations: AnswerKey): Map<number, string[]> {
  const map = new Map<number, string[]>();
  for (const [rel, words] of Object.entries(relations)) {
    for (const w of words) map.set(w, [...(map.get(w) ?? []), rel]);
  }
  return map;
}
