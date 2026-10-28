export const DIAGRAM_ROLES = [
  "clause",
  "subject",
  "verb",
  "direct-object",
  "indirect-object",
  "predicate-adjective",
  "predicate-nominative",
  "modifier",
  "preposition",
  "prep-object",
  "conjunction",
  "subordinator",
] as const;

export type DiagramRole = (typeof DIAGRAM_ROLES)[number];

export const CLAUSE_KINDS = ["main", "coordinate", "subordinate"] as const;
export type ClauseKind = (typeof CLAUSE_KINDS)[number];

/** Roles a conjunction can join: the members of a compound part, or two whole clauses. */
export const JOINABLE_ROLES = [
  "subject",
  "verb",
  "direct-object",
  "predicate-adjective",
  "predicate-nominative",
  "clause",
] as const;
export type JoinableRole = (typeof JOINABLE_ROLES)[number];

/**
 * One piece of a Reed-Kellogg diagram, stored as a flat list with parent links.
 * - clause: parent is null (main or coordinate) or the main-clause verb node a subordinate clause attaches to.
 * - subject, verb, objects, predicate words: parent is their clause.
 * - modifier, preposition: parent is the word node they describe.
 * - prep-object: parent is its preposition.
 * - conjunction: parent is the clause; `joins` says which compound part (or "clause" for a compound sentence).
 * - subordinator: parent is the subordinate clause.
 */
export type DiagramNode = {
  id: string;
  role: DiagramRole;
  /** Token indices; empty for clauses and for an implied "(you)" subject. */
  words: number[];
  implied?: "you";
  parent: string | null;
  clauseKind?: ClauseKind;
  joins?: JoinableRole;
};

/** The student's in-progress diagram. Fixed nodes come from the mode's starting skeleton and can't be removed. */
export type DraftNode = DiagramNode & { fixed?: boolean };

export const DIAGRAM_MODES = ["guided", "supported", "independent"] as const;
export type DiagramMode = (typeof DIAGRAM_MODES)[number];

export const DIAGRAM_FEATURES = [
  "modifier",
  "direct-object",
  "predicate-adjective",
  "predicate-nominative",
  "prepositional-phrase",
  "indirect-object",
  "compound",
  "coordinate-clause",
  "subordinate-clause",
  "implied-you",
  "question",
  "verb-phrase",
] as const;
export type DiagramFeature = (typeof DIAGRAM_FEATURES)[number];

/** Pseudo token index used for an implied "(you)" subject in relation keys and grading. */
export const IMPLIED_YOU = -1;

export type WordStatus = "correct" | "misplaced" | "missing";

export type DiagramGradeResult = {
  words: { index: number; status: WordStatus }[];
  /** Elements the student added but left without any words. */
  emptyElements: number;
  score: number;
  total: number;
  perfect: boolean;
};

export const ROLE_NAMES: Record<DiagramRole, string> = {
  clause: "baseline",
  subject: "subject",
  verb: "verb",
  "direct-object": "direct object",
  "indirect-object": "indirect object",
  "predicate-adjective": "predicate adjective",
  "predicate-nominative": "predicate nominative",
  modifier: "modifier",
  preposition: "preposition",
  "prep-object": "object of the preposition",
  conjunction: "conjunction",
  subordinator: "subordinating conjunction",
};
