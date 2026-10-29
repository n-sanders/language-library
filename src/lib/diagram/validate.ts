import type { DiagramChapter } from "@/content/books";
import { AnswerKeyError } from "@/lib/ai/answerKey";
import type { Token } from "@/lib/types";
import { COMPLEMENT_ROLES, DiagramIndex, HEAD_ROLES } from "./tree";
import { type DiagramFeature, type DiagramNode, type DraftNode, JOINABLE_ROLES, ROLE_NAMES } from "./types";

const FEATURE_NAMES: Record<DiagramFeature, string> = {
  modifier: "modifiers",
  "direct-object": "a direct object",
  "predicate-adjective": "a predicate adjective",
  "predicate-nominative": "a predicate nominative",
  "prepositional-phrase": "a prepositional phrase",
  "indirect-object": "an indirect object",
  compound: "a compound subject, verb, or object",
  "compound-predicate": "a compound predicate (more than one compound part, or verbs that take objects)",
  "coordinate-clause": "a second independent clause (compound sentence)",
  "subordinate-clause": "a dependent clause",
  "implied-you": "an understood (you) subject",
  question: "a question",
  "verb-phrase": "a helping verb (verb phrase)",
};

const COMPOUNDABLE = JOINABLE_ROLES.filter((r) => r !== "clause");

/** Diagram features a sentence uses, so a chapter can require some and forbid the rest. */
export function featuresUsed(tokens: Token[], nodes: DiagramNode[]): Set<DiagramFeature> {
  const index = new DiagramIndex(nodes);
  const used = new Set<DiagramFeature>();
  for (const node of nodes) {
    if (node.role === "modifier") used.add("modifier");
    if (node.role === "direct-object") used.add("direct-object");
    if (node.role === "predicate-adjective") used.add("predicate-adjective");
    if (node.role === "predicate-nominative") used.add("predicate-nominative");
    if (node.role === "preposition") used.add("prepositional-phrase");
    if (node.role === "indirect-object") used.add("indirect-object");
    if (node.role === "clause" && node.clauseKind === "coordinate") used.add("coordinate-clause");
    if (node.role === "clause" && node.clauseKind === "subordinate") used.add("subordinate-clause");
    if (node.implied) used.add("implied-you");
    if (node.role === "verb" && node.words.length > 1) used.add("verb-phrase");
    if (node.role === "clause") {
      const verbs = index.children(node.id, "verb");
      const compounded = COMPOUNDABLE.filter((r) => index.children(node.id, r).length > 1);
      const verbCompounds = verbs.some((verb) => COMPLEMENT_ROLES.some((r) => index.children(verb.id, r).length > 1));
      if (compounded.length > 0 || verbCompounds) used.add("compound");
      const sharedFollows = index.children(node.id, "indirect-object", ...COMPLEMENT_ROLES).length > 0;
      const perVerb = verbs.some((verb) => index.children(verb.id, "indirect-object", ...COMPLEMENT_ROLES).length > 0);
      if (compounded.length > 1 || (verbs.length > 1 && (sharedFollows || perVerb))) used.add("compound-predicate");
    }
  }
  if (tokens[tokens.length - 1]?.text === "?") used.add("question");
  return used;
}

/** Checks a generated answer key is a well-formed diagram that fits the chapter. Throws AnswerKeyError. */
export function validateDiagram(chapter: DiagramChapter, tokens: Token[], nodes: DiagramNode[]): void {
  const fail = (msg: string): never => {
    throw new AnswerKeyError(msg);
  };
  const ids = new Set<string>();
  for (const node of nodes) {
    if (ids.has(node.id)) fail(`Node id "${node.id}" is used twice.`);
    ids.add(node.id);
  }
  const index = new DiagramIndex(nodes);

  const placed = new Map<number, string>();
  for (const node of nodes) {
    for (const w of node.words) {
      if (!Number.isInteger(w) || w < 0 || w >= tokens.length) fail(`Node "${node.id}" points at word ${w}, which doesn't exist.`);
      if (!tokens[w].isWord) fail(`Punctuation "${tokens[w].text}" must not be placed in the diagram.`);
      if (placed.has(w)) fail(`The word "${tokens[w].text}" appears in more than one node.`);
      placed.set(w, node.id);
    }
  }
  tokens.forEach((t, i) => {
    if (t.isWord && !placed.has(i)) fail(`The word "${t.text}" (index ${i}) is missing from the diagram. Every word must be placed.`);
  });

  const clauses = nodes.filter((n) => n.role === "clause");
  const mains = clauses.filter((c) => c.clauseKind === "main");
  if (mains.length !== 1) fail("There must be exactly one main clause.");
  const mainClause = mains[0];
  if (mainClause.parent !== null) fail("The main clause must have parent null.");
  if (clauses.length > 2) fail("Use at most one extra clause besides the main clause.");

  for (const node of nodes) {
    const parent = index.get(node.parent);
    const needParent = (ok: boolean, what: string) => {
      if (!ok) fail(`The ${ROLE_NAMES[node.role]} "${node.id}" must have ${what} as its parent.`);
    };
    if (node.role !== "clause" && !parent) fail(`Node "${node.id}" has a missing parent "${node.parent}".`);

    if (node.role === "clause") {
      if (node.words.length) fail("Clause nodes must have an empty words list.");
      if (node.clauseKind === "coordinate") needParent(node.parent === null, "null");
      if (node.clauseKind === "subordinate") {
        needParent(parent?.role === "verb" && index.clauseOf(parent)?.id === mainClause.id, "a verb of the main clause");
      }
      if (!node.clauseKind) fail(`Clause "${node.id}" needs a clauseKind.`);
      if (index.children(node.id, "subject").length === 0) fail(`Clause "${node.id}" needs a subject.`);
      if (index.children(node.id, "verb").length === 0) fail(`Clause "${node.id}" needs a verb.`);
      continue;
    }

    if (node.implied) {
      if (node.role !== "subject" || node.words.length) fail("Only a subject with an empty words list can be an implied (you).");
    } else if (node.words.length === 0) {
      fail(`The ${ROLE_NAMES[node.role]} "${node.id}" has no words.`);
    } else if (node.role !== "verb" && node.words.length > 1) {
      fail(`The ${ROLE_NAMES[node.role]} "${node.id}" must hold exactly one word. Give each word its own node.`);
    }

    if (node.role === "subject" || node.role === "verb") needParent(parent?.role === "clause", "a clause");
    if (node.role === "indirect-object" || (COMPLEMENT_ROLES as readonly string[]).includes(node.role)) {
      const onVerb = parent?.role === "verb" && index.clauseOf(parent);
      needParent(parent?.role === "clause" || Boolean(onVerb), "a clause, or the one verb they belong to");
    }
    if (node.role === "modifier" && node.modifies) {
      const ownsCompound =
        (parent?.role === "clause" || parent?.role === "verb") && index.children(parent.id, node.modifies).length >= 2;
      if (!ownsCompound) fail(`Modifier "${node.id}" must describe a compound that has at least two ${ROLE_NAMES[node.modifies]}s.`);
    } else if (node.role === "modifier") {
      needParent(!!parent && (HEAD_ROLES.includes(parent.role) || parent.role === "modifier"), "a word it describes");
    }
    if (node.role === "preposition") needParent(!!parent && HEAD_ROLES.includes(parent.role), "the word the phrase describes");
    if (node.role === "prep-object") needParent(parent?.role === "preposition", "a preposition");
    if (node.role === "subordinator") needParent(parent?.clauseKind === "subordinate", "the dependent clause");
    if (node.role === "conjunction") {
      const joins = node.joins;
      if (!joins) fail(`Conjunction "${node.id}" needs "joins".`);
      else if (joins === "clause") needParent(parent?.clauseKind === "coordinate", "the second clause");
      else if ((parent?.role !== "clause" && parent?.role !== "verb") || index.children(parent.id, joins).length < 2) {
        fail(`Conjunction "${node.id}" joins ${joins} parts, but its parent doesn't have two of them.`);
      }
    }
  }

  const reachable = new Set(clauses.filter((c) => c.parent === null).flatMap((c) => index.subtree(c.id).map((n) => n.id)));
  const stray = nodes.find((n) => !reachable.has(n.id));
  if (stray) fail(`Node "${stray.id}" isn't connected to any clause. Check its parent.`);

  for (const prep of nodes.filter((n) => n.role === "preposition")) {
    if (index.children(prep.id, "prep-object").length !== 1) fail(`The preposition "${prep.id}" must have exactly one object.`);
  }

  for (const clause of clauses) {
    const hosts = [clause, ...index.children(clause.id, "verb")];
    for (const host of hosts) {
      for (const role of COMPOUNDABLE) {
        const count = index.children(host.id, role).length;
        const conj = index.children(host.id, "conjunction").filter((c) => c.joins === role).length;
        if (count > 1 && conj !== 1) fail(`The compound ${ROLE_NAMES[role]}s need exactly one conjunction node joining them.`);
      }
    }
    const verbs = index.children(clause.id, "verb");
    const shared = index.children(clause.id, "indirect-object", ...COMPLEMENT_ROLES);
    const perVerb = verbs.flatMap((verb) => index.children(verb.id, "indirect-object", ...COMPLEMENT_ROLES));
    if (verbs.length === 1 && perVerb.length) {
      fail("With one verb, objects and predicate words belong on the clause, not on the verb.");
    }
    if (shared.length && perVerb.length) fail("Don't mix a shared object with objects that belong to each verb.");
    for (const host of [clause, ...verbs]) {
      const complements = index.children(host.id, "indirect-object", ...COMPLEMENT_ROLES);
      const kinds = new Set(complements.filter((c) => c.role !== "indirect-object").map((c) => c.role));
      if (kinds.size > 1) fail("A line can have direct objects or a predicate word, not a mix.");
      if (index.children(host.id, "indirect-object").length && !index.children(host.id, "direct-object").length) {
        fail("An indirect object needs a direct object on the same line.");
      }
    }
    if (clause.clauseKind === "subordinate" && index.children(clause.id, "subordinator").length !== 1) {
      fail("The dependent clause needs exactly one subordinating conjunction.");
    }
    if (clause.clauseKind === "coordinate" && index.children(clause.id, "conjunction").filter((c) => c.joins === "clause").length !== 1) {
      fail("The second clause needs exactly one conjunction joining it to the first.");
    }
  }

  const used = featuresUsed(tokens, nodes);
  for (const feature of used) {
    if (!chapter.features.includes(feature)) fail(`This chapter must not use ${FEATURE_NAMES[feature]}.`);
  }
  for (const group of chapter.required) {
    if (!group.some((f) => used.has(f))) fail(`The sentence must use ${group.map((f) => FEATURE_NAMES[f]).join(" or ")}.`);
  }
}

/** Light structural cleanup of a student's submitted draft so grading can't be confused by bad input. */
export function sanitizeDraft(tokens: Token[], nodes: DraftNode[]): DraftNode[] {
  const seenIds = new Set<string>();
  const seenWords = new Set<number>();
  const unique = nodes.filter((n) => !seenIds.has(n.id) && seenIds.add(n.id));
  return unique.map((n) => ({
    ...n,
    parent: n.parent && seenIds.has(n.parent) && n.parent !== n.id ? n.parent : null,
    words: n.words.filter((w) => {
      const ok = Number.isInteger(w) && w >= 0 && w < tokens.length && tokens[w].isWord && !seenWords.has(w);
      if (ok) seenWords.add(w);
      return ok;
    }),
  }));
}
