import type { Token } from "@/lib/types";
import { COMPLEMENT_ROLES, DiagramIndex, inSentenceOrder } from "./tree";
import { ROLE_NAMES, type DiagramMode, type DiagramNode, type DiagramRole } from "./types";

const DETAIL_ROLES: DiagramRole[] = ["modifier", "preposition", "prep-object", "indirect-object", ...COMPLEMENT_ROLES];

export function nodeText(tokens: Token[], node: DiagramNode): string {
  if (node.implied) return "(you)";
  return node.words.map((i) => tokens[i]?.text ?? "?").join(" ");
}

const CLAUSE_TITLES = { main: "Main clause", coordinate: "Second clause", subordinate: "Dependent clause" } as const;

/** A readable outline of a diagram, one line per clause part, e.g. `subject "bird" (modifier "The")`. */
export function describeDiagram(tokens: Token[], nodes: DiagramNode[]): string[] {
  const index = new DiagramIndex(nodes);

  const describe = (node: DiagramNode, depth: number): string => {
    if (node.role === "modifier" && node.modifies) {
      return `modifier "${nodeText(tokens, node) || "_"}" of the compound ${ROLE_NAMES[node.modifies]}s`;
    }
    const kids = depth > 8 ? [] : inSentenceOrder(index.children(node.id, ...DETAIL_ROLES));
    const own = `${node.role === "conjunction" ? `conjunction joining ${node.joins === "clause" ? "the clauses" : `the ${node.joins}s`}` : ROLE_NAMES[node.role]} "${nodeText(tokens, node) || "_"}"`;
    return kids.length ? `${own} (${kids.map((k) => describe(k, depth + 1)).join("; ")})` : own;
  };

  const lines: string[] = [];
  for (const clause of nodes.filter((n) => n.role === "clause")) {
    const kind = clause.clauseKind ?? "main";
    const host = index.get(clause.parent);
    const title = kind === "subordinate" && host ? `${CLAUSE_TITLES[kind]} (tells about "${nodeText(tokens, host)}")` : CLAUSE_TITLES[kind];
    const parts = inSentenceOrder(index.children(clause.id).filter((n) => n.role !== "clause"));
    lines.push(`${title}: ${parts.map((p) => describe(p, 0)).join("; ") || "(empty)"}`);
  }
  return lines;
}

const MODE_NOTES: Record<DiagramMode, string> = {
  guided: "Guided: The whole diagram is drawn. Drag each word to its spot.",
  supported: "Supported: The main lines are drawn. Add the rest from the list, then place the words.",
  independent: "Independent: Start from a blank page. Add every part yourself.",
};

function nodePhrase(tokens: Token[], node: DiagramNode): string {
  const name =
    node.role === "conjunction"
      ? `conjunction joining ${node.joins === "clause" ? "the clauses" : `the ${node.joins ?? "?"}s`}`
      : node.role === "modifier" && node.modifies
        ? `modifier of the compound ${ROLE_NAMES[node.modifies]}s`
        : ROLE_NAMES[node.role];
  const text = nodeText(tokens, node);
  return text ? `${name} "${text}"` : `empty ${name} line`;
}

/** Node ids describeDiagram actually prints. A placed word outside this set would otherwise vanish. */
function outlinedNodeIds(nodes: DiagramNode[]): Set<string> {
  const index = new DiagramIndex(nodes);
  const seen = new Set<string>();

  const visit = (node: DiagramNode, depth: number) => {
    if (seen.has(node.id)) return;
    seen.add(node.id);
    if (depth > 8) return;
    for (const kid of index.children(node.id, ...DETAIL_ROLES)) visit(kid, depth + 1);
  };

  for (const clause of nodes.filter((n) => n.role === "clause")) {
    seen.add(clause.id);
    for (const part of index.children(clause.id).filter((n) => n.role !== "clause")) visit(part, 0);
  }
  return seen;
}

function hasPlacement(node: DiagramNode): boolean {
  return Boolean(node.implied) || node.words.length > 0;
}

/**
 * What the student has built so far: mode, clause outline, words left in the bank,
 * the selected line, and any placed word the clause outline could not attach.
 */
export function describeStudentDiagram(
  tokens: Token[],
  nodes: DiagramNode[],
  opts: { mode: DiagramMode; selectedId?: string | null },
): string[] {
  const index = new DiagramIndex(nodes);
  const outlined = outlinedNodeIds(nodes);
  const clauseLines = describeDiagram(tokens, nodes);
  const placed = new Set(nodes.flatMap((n) => n.words));
  const bank = tokens.filter((token, i) => token.isWord && !placed.has(i)).map((token) => token.text);
  const unattached = nodes.filter((n) => hasPlacement(n) && !outlined.has(n.id));
  const selected = opts.selectedId ? nodes.find((n) => n.id === opts.selectedId) : undefined;

  const lines = [MODE_NOTES[opts.mode]];
  if (clauseLines.length === 0 && unattached.length === 0) {
    lines.push("The page is blank. No words have been placed.");
  } else {
    lines.push(...(clauseLines.length ? clauseLines : ["No clause is drawn yet."]));
    for (const node of unattached) {
      const parent = index.get(node.parent);
      lines.push(
        parent
          ? `${nodePhrase(tokens, node)} is placed but not attached to a clause (it points at the ${nodePhrase(tokens, parent)}).`
          : `${nodePhrase(tokens, node)} is placed but not attached to the diagram.`,
      );
    }
  }
  lines.push(bank.length ? `Words still in the word bank: ${bank.join(", ")}.` : "The word bank is empty.");
  if (selected) {
    const parent = index.get(selected.parent);
    lines.push(
      parent
        ? `They have the ${nodePhrase(tokens, selected)} selected, under the ${nodePhrase(tokens, parent)}.`
        : `They have the ${nodePhrase(tokens, selected)} selected.`,
    );
  }
  return lines;
}
