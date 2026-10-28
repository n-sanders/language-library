import type { DiagramNode, DiagramRole, DraftNode, JoinableRole } from "./types";

export type DraftDiagram = { nodes: DraftNode[] };

/** Read-only lookups over a flat node list. */
export class DiagramIndex<N extends DiagramNode = DiagramNode> {
  readonly byId = new Map<string, N>();
  private readonly kids = new Map<string, N[]>();

  constructor(readonly nodes: N[]) {
    for (const node of nodes) this.byId.set(node.id, node);
    for (const node of nodes) {
      if (node.parent === null || !this.byId.has(node.parent)) continue;
      const list = this.kids.get(node.parent) ?? [];
      list.push(node);
      this.kids.set(node.parent, list);
    }
  }

  get(id: string | null | undefined): N | undefined {
    return id ? this.byId.get(id) : undefined;
  }

  children(id: string, ...roles: DiagramRole[]): N[] {
    const all = this.kids.get(id) ?? [];
    return roles.length ? all.filter((n) => roles.includes(n.role)) : all;
  }

  /** Conjunction joining a compound part (or two clauses) under `parentId`. */
  conjunction(parentId: string, joins: JoinableRole): N | undefined {
    return this.children(parentId, "conjunction").find((n) => n.joins === joins);
  }

  mainClause(): N | undefined {
    return this.nodes.find((n) => n.role === "clause" && n.clauseKind === "main");
  }

  coordinateClause(): N | undefined {
    return this.nodes.find((n) => n.role === "clause" && n.clauseKind === "coordinate");
  }

  subordinateClause(): N | undefined {
    return this.nodes.find((n) => n.role === "clause" && n.clauseKind === "subordinate");
  }

  /** The clause a node belongs to, walking up through word nodes. */
  clauseOf(node: N): N | undefined {
    let current: N | undefined = node;
    const seen = new Set<string>();
    while (current && current.role !== "clause" && !seen.has(current.id)) {
      seen.add(current.id);
      current = this.get(current.parent);
    }
    return current?.role === "clause" ? current : undefined;
  }

  /** Every node under `id`, including itself. */
  subtree(id: string): N[] {
    const out: N[] = [];
    const seen = new Set<string>();
    const visit = (nodeId: string) => {
      if (seen.has(nodeId)) return;
      seen.add(nodeId);
      const node = this.byId.get(nodeId);
      if (node) out.push(node);
      for (const child of this.kids.get(nodeId) ?? []) visit(child.id);
    };
    visit(id);
    return out;
  }
}

/** Sort key so siblings render in sentence order; empty draft nodes keep insertion order at the end. */
export function firstWord(node: DiagramNode): number {
  if (node.implied) return -1;
  return node.words.length ? Math.min(...node.words) : Number.MAX_SAFE_INTEGER;
}

export function inSentenceOrder<N extends DiagramNode>(nodes: N[]): N[] {
  return nodes
    .map((node, i) => ({ node, i }))
    .sort((a, b) => firstWord(a.node) - firstWord(b.node) || a.i - b.i)
    .map((x) => x.node);
}

/** Roles that hold a word on a horizontal or slanted line and can have modifiers hung under them. */
export const HEAD_ROLES: DiagramRole[] = [
  "subject",
  "verb",
  "direct-object",
  "indirect-object",
  "predicate-adjective",
  "predicate-nominative",
  "prep-object",
];

export const COMPLEMENT_ROLES = ["direct-object", "predicate-adjective", "predicate-nominative"] as const;
