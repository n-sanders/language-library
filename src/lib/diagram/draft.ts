import { COMPLEMENT_ROLES, DiagramIndex, HEAD_ROLES } from "./tree";
import type { DiagramFeature, DiagramMode, DiagramRole, DraftNode, JoinableRole } from "./types";

const LINE_ROLES = ["indirect-object", ...COMPLEMENT_ROLES] as const satisfies readonly DiagramRole[];

function lineNodes(index: DiagramIndex<DraftNode>, id: string): DraftNode[] {
  return index.children(id, ...LINE_ROLES);
}

/** Moves objects, predicate words, and the conjunctions and group modifiers that belong with them. */
function reparentLine(nodes: DraftNode[], from: string, to: string): DraftNode[] {
  return nodes.map((n) => {
    if (n.parent !== from) return n;
    if ((LINE_ROLES as readonly string[]).includes(n.role)) return { ...n, parent: to };
    if (n.role === "conjunction" && n.joins && n.joins !== "clause" && n.joins !== "subject" && n.joins !== "verb") {
      return { ...n, parent: to };
    }
    if (n.role === "modifier" && n.modifies && n.modifies !== "subject" && n.modifies !== "verb") return { ...n, parent: to };
    return n;
  });
}

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
  | "compound-share"
  | "compound-keep"
  | "shared-direct-object"
  | "shared-predicate-adjective"
  | "shared-predicate-nominative"
  | "shared-indirect-object"
  | "shared-modifier"
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
    const verbs = index.children(clause.id, "verb");
    const shared = lineNodes(index, clause.id);
    const ownKind = lineNodes(index, selected.id).find((n) => n.role !== "indirect-object")?.role;
    const anyOwn = verbs.some((verb) => lineNodes(index, verb.id).length > 0);
    const openFork = has("compound-predicate") && verbs.length > 1 && shared.length === 0;

    const pushLine = (id: ElementId, label: string, hint: string, enabled: boolean) => {
      if (enabled) out.push({ id, label, hint });
    };

    if (verbs.length === 1 && shared.length === 0 && !ownKind) {
      pushLine("direct-object", "Direct object", "Who or what receives the action.", has("direct-object"));
      pushLine("predicate-adjective", "Predicate adjective", "A describing word after a linking verb.", has("predicate-adjective"));
      pushLine("predicate-nominative", "Predicate nominative", "A noun after a linking verb that renames the subject.", has("predicate-nominative"));
    } else if (openFork && !anyOwn) {
      pushLine("direct-object", "Direct object on this verb", "Who or what this verb acts on. The other verbs keep their own lines.", has("direct-object"));
      pushLine("shared-direct-object", "Shared direct object", "Every verb acts on the same thing. The verb lines meet before it.", has("direct-object"));
      pushLine("predicate-adjective", "Predicate adjective on this verb", "A describing word after this verb only.", has("predicate-adjective"));
      pushLine("shared-predicate-adjective", "Shared predicate adjective", "Every verb shares this describing word. The lines meet before it.", has("predicate-adjective"));
      pushLine("predicate-nominative", "Predicate nominative on this verb", "A renaming noun after this verb only.", has("predicate-nominative"));
      pushLine("shared-predicate-nominative", "Shared predicate nominative", "Every verb shares this renaming noun. The lines meet before it.", has("predicate-nominative"));
    } else if (openFork && !ownKind) {
      pushLine("direct-object", "Direct object on this verb", "Who or what this verb acts on.", has("direct-object"));
      pushLine("predicate-adjective", "Predicate adjective on this verb", "A describing word after this verb only.", has("predicate-adjective"));
      pushLine("predicate-nominative", "Predicate nominative on this verb", "A renaming noun after this verb only.", has("predicate-nominative"));
    }

    if (has("indirect-object") && verbs.length === 1) {
      out.push({ id: "indirect-object", label: "Indirect object", hint: "To whom or for whom the action is done." });
    } else if (has("indirect-object") && openFork && !anyOwn) {
      out.push({ id: "indirect-object", label: "Indirect object on this verb", hint: "To whom or for whom this verb's action is done." });
      out.push({ id: "shared-indirect-object", label: "Shared indirect object", hint: "Every verb shares this. The verb lines meet, and it hangs there." });
    } else if (has("indirect-object") && openFork) {
      out.push({ id: "indirect-object", label: "Indirect object on this verb", hint: "To whom or for whom this verb's action is done." });
    } else if (has("indirect-object") && has("compound-predicate") && shared.some((n) => n.role === "direct-object") && !shared.some((n) => n.role === "indirect-object")) {
      out.push({ id: "shared-indirect-object", label: "Indirect object", hint: "To whom or for whom, shared by these verbs." });
    }
  }

  if (has("compound") && clause && COMPOUND_LABELS[selected.role] && !selected.implied) {
    const verbs = index.children(clause.id, "verb");
    const sharedCount = lineNodes(index, clause.id).length;
    const own = selected.role === "verb" && lineNodes(index, selected.id).length > 0;
    if (!has("compound-predicate")) {
      const blocked = selected.role === "verb" ? sharedCount > 0 : (COMPLEMENT_ROLES as readonly string[]).includes(selected.role) && verbs.length > 1;
      if (!blocked) out.push({ id: "compound", label: COMPOUND_LABELS[selected.role]!, hint: "Two words sharing the same job, joined by and, or, or but." });
    } else if (selected.role === "verb" && verbs.length === 1 && (sharedCount > 0 || own)) {
      out.push({
        id: "compound-share",
        label: "Compound verb, share the object",
        hint: "Add another verb. The lines meet again before what is already on the line.",
      });
      out.push({
        id: "compound-keep",
        label: "Compound verb, this verb keeps its line",
        hint: "Add another verb. This verb keeps its object, and the new verb starts bare.",
      });
    } else {
      const sharing = selected.role === "verb" && sharedCount > 0;
      out.push({
        id: "compound",
        label: COMPOUND_LABELS[selected.role]!,
        hint: sharing ? "Add another verb that shares what follows." : "Two words sharing the same job, joined by and, or, or but.",
      });
    }
  }

  if (
    has("compound-predicate") &&
    has("modifier") &&
    clause &&
    selected.parent &&
    COMPOUND_LABELS[selected.role] &&
    !selected.implied &&
    index.children(selected.parent, selected.role).length > 1
  ) {
    out.push({
      id: "shared-modifier",
      label: "Modifier of the whole group",
      hint: "A word that describes every part of this compound, such as 'the' before two nouns.",
    });
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
    case "indirect-object": {
      if (!clause || !selected) return { nodes, select: selectedId };
      const severalVerbs = index.children(clause.id, "verb").length > 1;
      const shared = lineNodes(index, clause.id).length > 0;
      const parentId = severalVerbs && !shared && selected.role === "verb" ? selected.id : clause.id;
      return add(node(element, parentId));
    }
    case "shared-direct-object":
    case "shared-predicate-adjective":
    case "shared-predicate-nominative":
    case "shared-indirect-object": {
      if (!clause) return { nodes, select: selectedId };
      const role = element.slice("shared-".length) as DiagramRole;
      return add(node(role, clause.id));
    }
    case "shared-modifier": {
      if (!selected?.parent || !COMPOUND_LABELS[selected.role]) return { nodes, select: selectedId };
      return add(node("modifier", selected.parent, { modifies: selected.role as JoinableRole }));
    }
    case "compound-share":
    case "compound-keep": {
      if (!selected || !clause || selected.role !== "verb") return { nodes, select: selectedId };
      const moved = element === "compound-keep" ? reparentLine(nodes, clause.id, selected.id) : reparentLine(nodes, selected.id, clause.id);
      const extra: DraftNode[] = [node("verb", clause.id)];
      if (!new DiagramIndex(moved).conjunction(clause.id, "verb")) extra.push(node("conjunction", clause.id, { joins: "verb" }));
      return { nodes: [...moved, ...extra], select: extra[0].id };
    }
    case "compound": {
      if (!selected || !clause) return { nodes, select: selectedId };
      const role = selected.role as JoinableRole;
      const hostId = selected.parent ?? clause.id;
      const extra: DraftNode[] = [node(selected.role, hostId)];
      if (!index.conjunction(hostId, role)) extra.push(node("conjunction", hostId, { joins: role }));
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

  const host = index.get(target.parent);
  if (host && (host.role === "clause" || host.role === "verb") && rootId !== host.id && target.role !== "conjunction") {
    const after = new DiagramIndex(next);
    const role = target.role as JoinableRole;
    const conj = after.conjunction(host.id, role);
    if (conj && after.children(host.id, target.role).length < 2 && !conj.fixed) next = next.filter((n) => n.id !== conj.id);
    if (after.children(host.id, target.role).length < 2) {
      next = next.filter((n) => !(n.role === "modifier" && n.modifies === role && n.parent === host.id && !n.fixed));
    }
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
