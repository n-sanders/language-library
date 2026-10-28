import { COMPLEMENT_ROLES, DiagramIndex, HEAD_ROLES } from "./tree";
import type { DiagramFeature, DiagramMode, DiagramRole, DraftNode, JoinableRole } from "./types";

let counter = 0;
const newId = () => `d${Date.now().toString(36)}${(counter++).toString(36)}`;

const node = (role: DiagramRole, parent: string | null, extra: Partial<DraftNode> = {}): DraftNode => ({
  id: newId(),
  role,
  parent,
  words: [],
  ...extra,
});

export type ElementId =
  | "baseline"
  | "modifier"
  | "prepositional-phrase"
  | "direct-object"
  | "predicate-adjective"
  | "predicate-nominative"
  | "indirect-object"
  | "compound"
  | "coordinate-clause"
  | "subordinate-clause"
  | "implied-you"
  | "remove";

export type PaletteElement = { id: ElementId; label: string; hint: string };

const COMPOUND_LABELS: Partial<Record<DiagramRole, string>> = {
  subject: "Compound subject (fork)",
  verb: "Compound verb (fork)",
  "direct-object": "Compound direct object (fork)",
  "predicate-adjective": "Compound predicate adjective (fork)",
  "predicate-nominative": "Compound predicate nominative (fork)",
};

/** Elements the student can add right now, given what's selected and what this chapter teaches. */
export function availableElements(
  nodes: DraftNode[],
  selectedId: string | null,
  features: DiagramFeature[],
  mode: DiagramMode,
): PaletteElement[] {
  if (mode === "guided") return [];
  const has = (f: DiagramFeature) => features.includes(f);
  const index = new DiagramIndex(nodes);
  const out: PaletteElement[] = [];

  if (!index.mainClause()) {
    out.push({ id: "baseline", label: "Baseline (subject | verb)", hint: "Start here: the main line with the subject and verb." });
    return out;
  }

  const selected = index.get(selectedId);
  if (!selected) return out;
  const clause = index.clauseOf(selected);
  const isMainVerb = selected.role === "verb" && clause?.clauseKind === "main";

  if (has("modifier") && (HEAD_ROLES.includes(selected.role) || selected.role === "modifier") && !selected.implied) {
    out.push({ id: "modifier", label: "Modifier (slant line)", hint: "An article, adjective, or adverb that describes this word." });
  }
  if (has("prepositional-phrase") && HEAD_ROLES.includes(selected.role) && !selected.implied) {
    out.push({ id: "prepositional-phrase", label: "Prepositional phrase", hint: "A preposition with its object, describing this word." });
  }

  if (selected.role === "verb" && clause) {
    const verbs = index.children(clause.id, "verb").length;
    const complements = index.children(clause.id, ...COMPLEMENT_ROLES);
    if (verbs === 1 && complements.length === 0) {
      if (has("direct-object")) out.push({ id: "direct-object", label: "Direct object", hint: "Who or what receives the action." });
      if (has("predicate-adjective")) {
        out.push({ id: "predicate-adjective", label: "Predicate adjective", hint: "A describing word after a linking verb." });
      }
      if (has("predicate-nominative")) {
        out.push({ id: "predicate-nominative", label: "Predicate nominative", hint: "A noun after a linking verb that renames the subject." });
      }
    }
    if (has("indirect-object") && verbs === 1) {
      out.push({ id: "indirect-object", label: "Indirect object", hint: "To whom or for whom the action is done." });
    }
  }

  if (has("compound") && clause && COMPOUND_LABELS[selected.role] && !selected.implied) {
    const verbs = index.children(clause.id, "verb").length;
    const complements = index.children(clause.id, "indirect-object", ...COMPLEMENT_ROLES).length;
    const blocked = selected.role === "verb" ? complements > 0 : COMPLEMENT_ROLES.some((r) => r === selected.role) && verbs > 1;
    if (!blocked) out.push({ id: "compound", label: COMPOUND_LABELS[selected.role]!, hint: "Two words sharing the same job, joined by and, or, or but." });
  }

  const extraClause = index.coordinateClause() || index.subordinateClause();
  if (isMainVerb && !extraClause) {
    if (has("coordinate-clause")) {
      out.push({ id: "coordinate-clause", label: "Second clause (compound sentence)", hint: "Another complete sentence joined with and, but, or or." });
    }
    if (has("subordinate-clause")) {
      out.push({ id: "subordinate-clause", label: "Dependent clause", hint: "A clause starting with because, when, if... that tells about this verb." });
    }
  }

  if (has("implied-you") && selected.role === "subject" && clause && index.children(clause.id, "subject").length === 1) {
    out.push({
      id: "implied-you",
      label: selected.implied ? "Remove (you)" : "Understood subject (you)",
      hint: selected.implied ? "Go back to a regular subject slot." : "For a command, the subject is the understood 'you'.",
    });
  }

  if (!selected.fixed) out.push({ id: "remove", label: "Remove this part", hint: "Take this element (and anything hanging from it) off the diagram." });
  return out;
}

/** Applies a palette element. Returns the new node list and which node to select next. */
export function applyElement(nodes: DraftNode[], selectedId: string | null, element: ElementId): { nodes: DraftNode[]; select: string | null } {
  const index = new DiagramIndex(nodes);
  const selected = index.get(selectedId);
  const clause = selected ? index.clauseOf(selected) : undefined;

  const add = (...added: DraftNode[]) => ({ nodes: [...nodes, ...added], select: added.find((n) => n.role !== "clause")?.id ?? null });

  switch (element) {
    case "baseline": {
      const c = node("clause", null, { clauseKind: "main" });
      const s = node("subject", c.id);
      return { nodes: [...nodes, c, s, node("verb", c.id)], select: s.id };
    }
    case "modifier":
      return selected ? add(node("modifier", selected.id)) : { nodes, select: selectedId };
    case "prepositional-phrase": {
      if (!selected) return { nodes, select: selectedId };
      const p = node("preposition", selected.id);
      return add(p, node("prep-object", p.id));
    }
    case "direct-object":
    case "predicate-adjective":
    case "predicate-nominative":
    case "indirect-object":
      return clause ? add(node(element, clause.id)) : { nodes, select: selectedId };
    case "compound": {
      if (!selected || !clause) return { nodes, select: selectedId };
      const role = selected.role as JoinableRole;
      const extra: DraftNode[] = [node(selected.role, clause.id)];
      if (!index.conjunction(clause.id, role)) extra.push(node("conjunction", clause.id, { joins: role }));
      return add(...extra);
    }
    case "coordinate-clause": {
      const c = node("clause", null, { clauseKind: "coordinate" });
      const k = node("conjunction", c.id, { joins: "clause" });
      return { nodes: [...nodes, c, k, node("subject", c.id), node("verb", c.id)], select: k.id };
    }
    case "subordinate-clause": {
      if (!selected) return { nodes, select: selectedId };
      const c = node("clause", selected.id, { clauseKind: "subordinate" });
      const b = node("subordinator", c.id);
      return { nodes: [...nodes, c, b, node("subject", c.id), node("verb", c.id)], select: b.id };
    }
    case "implied-you":
      return {
        nodes: nodes.map((n) => (n.id === selectedId ? { ...n, implied: n.implied ? undefined : "you", words: [] } : n)),
        select: selectedId,
      };
    case "remove":
      return selected ? { nodes: removeNode(nodes, selected.id), select: null } : { nodes, select: selectedId };
  }
}

/**
 * Removes a node and everything hanging from it. Removing the only subject or verb removes the whole clause,
 * and a fork that drops to one member loses its conjunction.
 */
export function removeNode(nodes: DraftNode[], id: string): DraftNode[] {
  const index = new DiagramIndex(nodes);
  const target = index.get(id);
  if (!target || target.fixed) return nodes;

  let rootId = id;
  const clause = index.get(target.parent);
  if (clause?.role === "clause" && (target.role === "subject" || target.role === "verb") && index.children(clause.id, target.role).length === 1) {
    if (clause.fixed) return nodes;
    rootId = clause.id;
  }
  if (target.role === "prep-object") rootId = target.parent ?? id;

  const doomed = new Set(index.subtree(rootId).map((n) => n.id));
  let next = nodes.filter((n) => !doomed.has(n.id));

  if (clause?.role === "clause" && rootId !== clause.id && target.role !== "conjunction") {
    const after = new DiagramIndex(next);
    const role = target.role as JoinableRole;
    const conj = after.conjunction(clause.id, role);
    if (conj && after.children(clause.id, target.role).length < 2 && !conj.fixed) next = next.filter((n) => n.id !== conj.id);
  }
  return next;
}

/** Puts a word in a slot, taking it out of wherever it was before. */
export function placeWord(nodes: DraftNode[], nodeId: string, word: number): DraftNode[] {
  return nodes.map((n) => {
    const without = n.words.filter((w) => w !== word);
    if (n.id !== nodeId) return without.length === n.words.length ? n : { ...n, words: without };
    return { ...n, implied: undefined, words: [...without, word].sort((a, b) => a - b) };
  });
}

export function unplaceWord(nodes: DraftNode[], word: number): DraftNode[] {
  return nodes.map((n) => (n.words.includes(word) ? { ...n, words: n.words.filter((w) => w !== word) } : n));
}

export function placedWords(nodes: DraftNode[]): Set<number> {
  return new Set(nodes.flatMap((n) => n.words));
}
