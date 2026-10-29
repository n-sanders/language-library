import { COMPLEMENT_ROLES, DiagramIndex } from "./tree";
import type { DiagramMode, DiagramNode, DraftNode } from "./types";

/** The answer key's shape with every word removed. Safe to send to the browser for Guided and Supported modes. */
export function structureOf(nodes: DiagramNode[]): DiagramNode[] {
  return nodes.map((n) => ({ ...n, words: [] }));
}

/**
 * Starting diagram for a mode.
 * - guided: the whole structure with empty slots.
 * - supported: only the key lines: baselines, the first subject and verb, the first complement, and clause connectors.
 * - independent: nothing.
 */
export function skeletonFor(mode: DiagramMode, structure: DiagramNode[]): DraftNode[] {
  if (mode === "independent") return [];
  const fixed = (n: DiagramNode): DraftNode => ({ ...n, words: [], fixed: true });
  if (mode === "guided") return structure.map(fixed);

  const index = new DiagramIndex(structure);
  const keep: DraftNode[] = [];
  for (const clause of structure.filter((n) => n.role === "clause")) {
    keep.push(fixed(clause));
    const [subject] = index.children(clause.id, "subject");
    const [verb] = index.children(clause.id, "verb");
    const [sharedComplement] = index.children(clause.id, ...COMPLEMENT_ROLES);
    const [verbComplement] = verb ? index.children(verb.id, ...COMPLEMENT_ROLES) : [];
    const complement = sharedComplement ?? verbComplement;
    if (subject) keep.push({ ...fixed(subject), implied: undefined });
    if (verb) keep.push(fixed(verb));
    if (complement) keep.push(fixed(complement));
    for (const connector of index.children(clause.id, "subordinator", "conjunction")) {
      if (connector.role === "subordinator" || connector.joins === "clause") keep.push(fixed(connector));
    }
  }

  // A subordinate clause hangs from a verb; make sure that verb survived, otherwise re-attach to the main verb.
  const kept = new Set(keep.map((n) => n.id));
  const mainVerb = keep.find((n) => n.role === "verb" && n.parent === index.mainClause()?.id);
  return keep.map((n) =>
    n.role === "clause" && n.clauseKind === "subordinate" && n.parent && !kept.has(n.parent) ? { ...n, parent: mainVerb?.id ?? null } : n,
  );
}
