import type { Chapter, DiagramChapter, DiagramExample, SentencePattern } from "@/content/books";
import { AnswerKeyError } from "@/lib/ai/answerKey";
import { DiagramIndex } from "@/lib/diagram/tree";
import type { DiagramNode, JoinableRole } from "@/lib/diagram/types";
import { normalizeWord, tokenize } from "@/lib/tokenize";
import type { AnswerKey, Token } from "@/lib/types";

const ARTICLES = new Set(["a", "an", "the"]);
const SUBJECT_PREPS = new Set(["in", "on", "under", "with"]);
const PREPOSITIONS = new Set([
  ...SUBJECT_PREPS,
  "over",
  "near",
  "by",
  "at",
  "from",
  "of",
  "into",
  "onto",
  "beside",
  "behind",
  "around",
  "across",
  "through",
  "between",
  "above",
  "below",
  "along",
  "inside",
  "outside",
]);
const TIME_ADVERBS = new Set([
  "yesterday",
  "today",
  "tomorrow",
  "tonight",
  "soon",
  "now",
  "later",
  "always",
  "often",
  "sometimes",
  "never",
]);

type Source = { key?: AnswerKey; nodes?: DiagramNode[] | null };
type Check = (tokens: Token[], source: Source) => string | null;

export function patternFor(chapter: Chapter, gradeLevel: number, step: number): SentencePattern | null {
  const patterns = (chapter.patterns ?? []).filter((pattern) => gradeLevel >= (pattern.minGrade ?? 1));
  if (patterns.length === 0) return null;
  const index = ((step % patterns.length) + patterns.length) % patterns.length;
  return patterns[index];
}

export function shapeLines(pattern: SentencePattern | null): string[] {
  if (!pattern) return [];
  return [
    "",
    "Sentence shape for this exercise (required):",
    `- ${pattern.instruction}`,
    "- Follow this shape even when it makes the sentence shorter than the grade length guidance.",
  ];
}

/** Lines the retry prompt can use. Null means the sentence matches. */
export function patternMismatch(chapter: Chapter, pattern: SentencePattern, tokens: Token[], source: Source): string | null {
  const check = CHECKS[chapter.slug]?.[pattern.id];
  if (!check) return `This chapter has no checker for "${pattern.id}".`;
  return check(tokens, source);
}

export function assertPattern(chapter: Chapter, pattern: SentencePattern, tokens: Token[], source: Source): void {
  const reason = patternMismatch(chapter, pattern, tokens, source);
  if (reason) throw new AnswerKeyError(reason);
}

export function hasPatternChecker(slug: string, id: string): boolean {
  return Boolean(CHECKS[slug]?.[id]);
}

/** Few-shot diagrams that already use this shape. If none do, keep the samples and mark them format-only. */
export function matchingExamples(
  chapter: DiagramChapter,
  pattern: SentencePattern | null,
): { examples: DiagramExample[]; formatOnly: boolean } {
  if (!pattern || chapter.examples.length === 0) return { examples: chapter.examples, formatOnly: false };
  const matching = chapter.examples.filter((example) => {
    const tokens = tokenize(example.sentence);
    return patternMismatch(chapter, pattern, tokens, { nodes: example.nodes }) === null;
  });
  if (matching.length > 0) return { examples: matching, formatOnly: false };
  return { examples: chapter.examples, formatOnly: true };
}

function wordIndices(tokens: Token[], indices: number[] | undefined): number[] {
  return (indices ?? []).filter((i) => tokens[i]?.isWord);
}

function wordAt(tokens: Token[], index: number): string {
  return normalizeWord(tokens[index]?.text ?? "");
}

function hasPreposition(tokens: Token[]): boolean {
  return tokens.some((token) => token.isWord && PREPOSITIONS.has(normalizeWord(token.text)));
}

function hasProperNoun(tokens: Token[], nouns: number[]): boolean {
  return nouns.some((i) => i > 0 && /^[A-Z]/.test(tokens[i]?.text ?? ""));
}

function nextWord(tokens: Token[], index: number): number | null {
  for (let i = index + 1; i < tokens.length; i++) if (tokens[i].isWord) return i;
  return null;
}

function requireKey(source: Source): AnswerKey | string {
  if (!source.key) return "The answer key is missing.";
  return source.key;
}

function clauseShape(tokens: Token[], source: Source, word: string, position: "after" | "before"): string | null {
  const key = requireKey(source);
  if (typeof key === "string") return key;
  const clause = key["dependent-clause"];
  if (!clause?.length) return "The sentence needs one dependent clause.";
  const first = clause[0];
  if (!tokens[first]?.isWord || wordAt(tokens, first) !== word) return `The dependent clause must start with "${word}".`;
  if (position === "before" && first !== 0) return `Start the sentence with "${word}".`;
  if (position === "after" && first === 0) {
    return `Put the independent clause first, and end with the dependent clause beginning with "${word}".`;
  }
  return null;
}

function subjectPatterns(): Record<string, Check> {
  const one = (tokens: Token[], source: Source) => {
    const key = requireKey(source);
    if (typeof key === "string") return key;
    const simple = wordIndices(tokens, key["simple-subject"]);
    const complete = wordIndices(tokens, key["complete-subject"]);
    return { key, simple, complete };
  };

  return {
    "article-adjective": (tokens, source) => {
      const found = one(tokens, source);
      if (typeof found === "string" || !("simple" in found)) return found as string;
      const { simple, complete } = found;
      if (simple.length !== 1) return "Tag exactly one simple subject.";
      if (complete.length !== 3) return "The complete subject must be an article, an adjective, and a noun.";
      if (!ARTICLES.has(wordAt(tokens, complete[0]))) return "Start the complete subject with a, an, or the.";
      if (ARTICLES.has(wordAt(tokens, complete[1])) || PREPOSITIONS.has(wordAt(tokens, complete[1]))) {
        return "The middle word of the complete subject must be an adjective.";
      }
      if (complete[2] !== simple[0]) return "The simple subject must be the noun at the end of the complete subject.";
      if (hasPreposition(tokens)) return "Do not use a prepositional phrase.";
      return null;
    },
    "adjective-noun": (tokens, source) => {
      const found = one(tokens, source);
      if (typeof found === "string" || !("simple" in found)) return found as string;
      const { simple, complete } = found;
      if (simple.length !== 1) return "Tag exactly one simple subject.";
      if (complete.length !== 2) return "The complete subject must be an adjective and a noun, with no article.";
      if (ARTICLES.has(wordAt(tokens, complete[0]))) return "Do not put an article on the subject.";
      if (complete[1] !== simple[0]) return "The simple subject must be the noun.";
      if (hasPreposition(tokens)) return "Do not use a prepositional phrase.";
      return null;
    },
    "subject-phrase": (tokens, source) => {
      const found = one(tokens, source);
      if (typeof found === "string" || !("simple" in found)) return found as string;
      const { simple, complete } = found;
      if (simple.length !== 1) return "Tag exactly one simple subject.";
      if (!ARTICLES.has(wordAt(tokens, complete[0]))) return "Start the complete subject with a, an, or the.";
      const prepAt = complete.find((i) => SUBJECT_PREPS.has(wordAt(tokens, i)));
      if (prepAt === undefined) return "The complete subject must include a prepositional phrase using in, on, under, or with.";
      if (!(simple[0] < prepAt)) return "The simple subject must be the noun before the preposition.";
      return null;
    },
    "compound-subject": (tokens, source) => {
      const found = one(tokens, source);
      if (typeof found === "string" || !("simple" in found)) return found as string;
      const { simple, complete } = found;
      if (simple.length !== 2) return "Tag exactly two simple subjects.";
      if (!complete.some((i) => wordAt(tokens, i) === "and")) return "The complete subject must include and between the two nouns.";
      if (hasPreposition(tokens)) return "Do not add a prepositional phrase.";
      return null;
    },
  };
}

function nounVerbPatterns(): Record<string, Check> {
  const counts = (tokens: Token[], source: Source) => {
    const key = requireKey(source);
    if (typeof key === "string") return key;
    return {
      nouns: wordIndices(tokens, key.noun),
      verbs: wordIndices(tokens, key.verb),
    };
  };

  return {
    "two-common": (tokens, source) => {
      const found = counts(tokens, source);
      if (typeof found === "string") return found;
      if (found.nouns.length !== 2) return "Use exactly two nouns.";
      if (found.verbs.length !== 1) return "Use exactly one verb word.";
      if (hasProperNoun(tokens, found.nouns)) return "Do not use a name.";
      if (hasPreposition(tokens)) return "Do not use a prepositional phrase.";
      return null;
    },
    "proper-noun": (tokens, source) => {
      const found = counts(tokens, source);
      if (typeof found === "string") return found;
      if (found.nouns.length < 2) return "Include at least two nouns.";
      if (found.verbs.length !== 1) return "Use exactly one verb word.";
      if (!hasProperNoun(tokens, found.nouns)) return "Include a proper noun that is not the first word.";
      if (hasPreposition(tokens)) return "Do not use a prepositional phrase.";
      return null;
    },
    "helping-verb": (tokens, source) => {
      const found = counts(tokens, source);
      if (typeof found === "string") return found;
      if (found.nouns.length < 2) return "Include at least two nouns.";
      if (found.verbs.length !== 2) return "Use a helping verb and a main verb as two verb words.";
      if (hasProperNoun(tokens, found.nouns)) return "Use common nouns only, with no names.";
      if (hasPreposition(tokens)) return "Do not use a prepositional phrase.";
      return null;
    },
    "prep-noun": (tokens, source) => {
      const found = counts(tokens, source);
      if (typeof found === "string") return found;
      if (found.nouns.length < 3) return "Include at least three nouns, counting the object of the preposition.";
      if (found.verbs.length !== 1) return "Use exactly one verb word.";
      if (!hasPreposition(tokens)) return "Include a prepositional phrase.";
      if (hasProperNoun(tokens, found.nouns)) return "Do not use a name.";
      return null;
    },
  };
}

function adverbPatterns(): Record<string, Check> {
  const adverb = (tokens: Token[], source: Source) => {
    const key = requireKey(source);
    if (typeof key === "string") return key;
    const adverbs = wordIndices(tokens, key.adverb);
    const verbs = wordIndices(tokens, key.verb);
    if (adverbs.length !== 1) return "Use exactly one adverb.";
    return { adverb: adverbs[0], verbs, time: TIME_ADVERBS.has(wordAt(tokens, adverbs[0])) };
  };

  return {
    "manner-after": (tokens, source) => {
      const found = adverb(tokens, source);
      if (typeof found === "string" || !("adverb" in found)) return found as string;
      if (found.time) return "Use a manner adverb, not a time adverb.";
      if (found.verbs.length === 0 || found.adverb <= Math.max(...found.verbs)) return "Put the manner adverb after the verb.";
      return null;
    },
    "time-adverb": (tokens, source) => {
      const found = adverb(tokens, source);
      if (typeof found === "string" || !("adverb" in found)) return found as string;
      if (!found.time) return "Use a time adverb such as yesterday, soon, or often.";
      return null;
    },
    "adverb-before": (tokens, source) => {
      const found = adverb(tokens, source);
      if (typeof found === "string" || !("adverb" in found)) return found as string;
      if (found.time) return "Use a manner adverb, not a time adverb.";
      const following = nextWord(tokens, found.adverb);
      if (following === null || !found.verbs.includes(following)) return "Place the manner adverb immediately before the verb.";
      return null;
    },
  };
}

function clausePatterns(): Record<string, Check> {
  const steps: { position: "after" | "before"; word: string }[] = [
    { position: "after", word: "because" },
    { position: "before", word: "when" },
    { position: "after", word: "although" },
    { position: "before", word: "if" },
    { position: "after", word: "since" },
    { position: "before", word: "while" },
    { position: "after", word: "until" },
    { position: "before", word: "unless" },
    { position: "after", word: "after" },
    { position: "before", word: "before" },
  ];
  return Object.fromEntries(steps.map(({ position, word }) => [`${position}-${word}`, (tokens: Token[], source: Source) => clauseShape(tokens, source, word, position)]));
}

function nodeWord(tokens: Token[], node: DiagramNode): string {
  const index = node.words[0];
  return index === undefined ? "" : wordAt(tokens, index);
}

function firstWord(node: DiagramNode): number {
  return Math.min(...node.words);
}

function isArticle(tokens: Token[], node: DiagramNode): boolean {
  return ARTICLES.has(nodeWord(tokens, node));
}

function diagramOf(source: Source): { index: DiagramIndex; main: DiagramNode } | string {
  if (!source.nodes) return "The diagram is missing.";
  const index = new DiagramIndex(source.nodes);
  const main = index.mainClause();
  if (!main) return "The diagram needs a main clause.";
  return { index, main };
}

function joinedByAnd(index: DiagramIndex, parentId: string, joins: JoinableRole, tokens: Token[]): boolean {
  const conj = index.conjunction(parentId, joins);
  return Boolean(conj && nodeWord(tokens, conj) === "and");
}

function subjectVerbPatterns(): Record<string, Check> {
  const parts = (tokens: Token[], source: Source) => {
    const diagram = diagramOf(source);
    if (typeof diagram === "string") return diagram;
    const subjects = diagram.index.children(diagram.main.id, "subject");
    const verbs = diagram.index.children(diagram.main.id, "verb");
    if (subjects.length !== 1 || verbs.length !== 1) return "Use exactly one subject and one verb.";
    const subjectMods = diagram.index.children(subjects[0].id, "modifier");
    const verbMods = diagram.index.children(verbs[0].id, "modifier");
    const verbAt = firstWord(verbs[0]);
    return {
      articles: subjectMods.filter((mod) => isArticle(tokens, mod)).length,
      adjectives: subjectMods.filter((mod) => !isArticle(tokens, mod)).length,
      before: verbMods.some((mod) => firstWord(mod) < verbAt),
      after: verbMods.some((mod) => firstWord(mod) > verbAt),
    };
  };

  return {
    "article-adverb-after": (tokens, source) => {
      const found = parts(tokens, source);
      if (typeof found === "string") return found;
      if (found.articles < 1 || found.adjectives < 1) return "Put an article and an adjective on the subject.";
      if (!found.after || found.before) return "Put the adverb after the verb, not before it.";
      return null;
    },
    "adjective-adverb-after": (tokens, source) => {
      const found = parts(tokens, source);
      if (typeof found === "string") return found;
      if (found.articles > 0) return "Do not put an article on the subject.";
      if (found.adjectives < 1) return "Put an adjective on the subject.";
      if (!found.after || found.before) return "Put the adverb after the verb, not before it.";
      return null;
    },
    "adverb-before": (tokens, source) => {
      const found = parts(tokens, source);
      if (typeof found === "string") return found;
      if (found.articles + found.adjectives < 1) return "Put an article or an adjective on the subject.";
      if (!found.before || found.after) return "Put the adverb before the verb, not after it.";
      return null;
    },
  };
}

function directObjectPatterns(): Record<string, Check> {
  const parts = (tokens: Token[], source: Source) => {
    const diagram = diagramOf(source);
    if (typeof diagram === "string") return diagram;
    const subjects = diagram.index.children(diagram.main.id, "subject");
    const verbs = diagram.index.children(diagram.main.id, "verb");
    const objects = diagram.index.children(diagram.main.id, "direct-object");
    if (verbs.length !== 1 || objects.length !== 1) return "Use exactly one verb and exactly one direct object.";
    return {
      objectMods: diagram.index.children(objects[0].id, "modifier").length,
      verbMods: diagram.index.children(verbs[0].id, "modifier").length,
      adjective: subjects.some((subject) => diagram.index.children(subject.id, "modifier").some((mod) => !isArticle(tokens, mod))),
    };
  };

  return {
    "object-modifier": (_tokens, source) => {
      const found = parts(_tokens, source);
      if (typeof found === "string") return found;
      if (found.objectMods < 1) return "Put a modifier on the direct object.";
      if (found.verbMods > 0) return "Do not put an adverb on the verb.";
      return null;
    },
    "subject-adjective": (_tokens, source) => {
      const found = parts(_tokens, source);
      if (typeof found === "string") return found;
      if (!found.adjective) return "Put an adjective on the subject.";
      if (found.objectMods > 0) return "Do not put a modifier on the direct object.";
      if (found.verbMods > 0) return "Do not put an adverb on the verb.";
      return null;
    },
    "verb-adverb": (_tokens, source) => {
      const found = parts(_tokens, source);
      if (typeof found === "string") return found;
      if (found.verbMods < 1) return "Put an adverb on the verb.";
      return null;
    },
  };
}

function predicatePatterns(): Record<string, Check> {
  const check = (role: "predicate-adjective" | "predicate-nominative", other: "predicate-adjective" | "predicate-nominative", name: string): Check => {
    return (_tokens, source) => {
      const nodes = source.nodes;
      if (!nodes) return "The diagram is missing.";
      const count = (wanted: string) => nodes.filter((node) => node.role === wanted).length;
      if (count(role) !== 1 || count(other) !== 0) return `Use exactly one ${name} and not the other predicate word.`;
      if (count("direct-object") !== 0) return "Do not use a direct object.";
      return null;
    };
  };
  return {
    "predicate-adjective": check("predicate-adjective", "predicate-nominative", "predicate adjective"),
    "predicate-nominative": check("predicate-nominative", "predicate-adjective", "predicate nominative"),
  };
}

function phrasePatterns(): Record<string, Check> {
  const check = (role: "verb" | "subject" | "direct-object", name: string): Check => {
    return (_tokens, source) => {
      const diagram = diagramOf(source);
      if (typeof diagram === "string") return diagram;
      const phrases = diagram.index.nodes.filter((node) => node.role === "preposition");
      if (phrases.length !== 1) return "Use exactly one prepositional phrase.";
      const parent = diagram.index.get(phrases[0].parent);
      if (parent?.role !== role) return `The prepositional phrase must describe the ${name}.`;
      return null;
    };
  };
  return {
    "phrase-on-verb": check("verb", "verb"),
    "phrase-on-subject": check("subject", "subject"),
    "phrase-on-object": check("direct-object", "direct object"),
  };
}

function indirectObjectPatterns(): Record<string, Check> {
  return Object.fromEntries(
    ["gave", "showed", "told", "brought", "sent", "handed"].map((verb) => [
      `verb-${verb}`,
      ((tokens: Token[], source: Source) => {
        const diagram = diagramOf(source);
        if (typeof diagram === "string") return diagram;
        const verbs = diagram.index.children(diagram.main.id, "verb");
        if (verbs.length !== 1 || nodeWord(tokens, verbs[0]) !== verb) return `The verb must be "${verb}".`;
        return null;
      }) satisfies Check,
    ]),
  );
}

function compoundPartPatterns(): Record<string, Check> {
  const counts = (source: Source) => {
    const diagram = diagramOf(source);
    if (typeof diagram === "string") return diagram;
    return {
      diagram,
      subjects: diagram.index.children(diagram.main.id, "subject").length,
      verbs: diagram.index.children(diagram.main.id, "verb").length,
      objects: diagram.index.children(diagram.main.id, "direct-object").length,
    };
  };

  return {
    "compound-subject": (tokens, source) => {
      const found = counts(source);
      if (typeof found === "string") return found;
      if (found.subjects !== 2 || found.verbs !== 1 || found.objects !== 0) {
        return "Use exactly two subjects, one verb, and no direct object.";
      }
      if (!joinedByAnd(found.diagram.index, found.diagram.main.id, "subject", tokens)) return 'Join the subjects with "and".';
      return null;
    },
    "compound-verb": (tokens, source) => {
      const found = counts(source);
      if (typeof found === "string") return found;
      if (found.subjects !== 1 || found.verbs !== 2 || found.objects !== 0) {
        return "Use exactly one subject, two verbs, and no direct object.";
      }
      if (!joinedByAnd(found.diagram.index, found.diagram.main.id, "verb", tokens)) return 'Join the verbs with "and".';
      return null;
    },
    "compound-object": (tokens, source) => {
      const found = counts(source);
      if (typeof found === "string") return found;
      if (found.subjects !== 1 || found.verbs !== 1 || found.objects !== 2) {
        return "Use exactly one subject, one verb, and two direct objects.";
      }
      if (!joinedByAnd(found.diagram.index, found.diagram.main.id, "direct-object", tokens)) {
        return 'Join the direct objects with "and".';
      }
      return null;
    },
  };
}

function compoundPredicatePatterns(): Record<string, Check> {
  return {
    "subject-and-verb": (_tokens, source) => {
      const diagram = diagramOf(source);
      if (typeof diagram === "string") return diagram;
      const { index, main } = diagram;
      const subjects = index.children(main.id, "subject");
      const verbs = index.children(main.id, "verb");
      if (subjects.length !== 2 || verbs.length !== 2) return "Use exactly two subjects and exactly two verbs.";
      const shared = index.children(main.id, "direct-object", "indirect-object", "predicate-adjective", "predicate-nominative");
      const hanging = verbs.some(
        (verb) => index.children(verb.id, "direct-object", "indirect-object", "predicate-adjective", "predicate-nominative", "preposition", "modifier").length > 0,
      );
      if (shared.length > 0 || hanging) return "Put nothing after the verbs: no object, predicate word, adverb, or prepositional phrase.";
      return null;
    },
    "shared-object": (_tokens, source) => {
      const diagram = diagramOf(source);
      if (typeof diagram === "string") return diagram;
      const { index, main } = diagram;
      const verbs = index.children(main.id, "verb");
      if (index.children(main.id, "subject").length !== 1 || verbs.length !== 2) return "Use one subject and exactly two verbs.";
      if (index.children(main.id, "direct-object").length !== 2) {
        return "The two verbs must share one compound direct object, with both objects parented to the clause.";
      }
      const sharedMod = index.children(main.id, "modifier").some((mod) => mod.modifies === "direct-object");
      if (!sharedMod) return "Include a modifier of the whole compound object, parented to the clause with modifies set to direct-object.";
      const perVerb = verbs.some((verb) => index.children(verb.id, "direct-object", "predicate-adjective", "predicate-nominative").length > 0);
      if (perVerb) return "Parent the shared object to the clause, not to one verb.";
      return null;
    },
    "per-verb": (_tokens, source) => {
      const diagram = diagramOf(source);
      if (typeof diagram === "string") return diagram;
      const { index, main } = diagram;
      const verbs = index.children(main.id, "verb");
      if (index.children(main.id, "subject").length !== 1 || verbs.length < 2 || verbs.length > 3) {
        return "Use one subject and two or three verbs.";
      }
      const shared = index.children(main.id, "direct-object", "indirect-object", "predicate-adjective", "predicate-nominative");
      if (shared.length > 0) return "Don't give the verbs one shared object. Parent each verb's own object, adverb, or phrase to that verb.";
      const withOwn = verbs.filter((verb) => index.children(verb.id, "direct-object", "modifier", "preposition").length > 0);
      if (withOwn.length < 2) return "At least two verbs need their own object, adverb, or prepositional phrase.";
      return null;
    },
  };
}

function compoundSentencePatterns(): Record<string, Check> {
  return Object.fromEntries(
    ["and", "but", "or"].map((word) => [
      `join-${word}`,
      ((tokens: Token[], source: Source) => {
        const diagram = diagramOf(source);
        if (typeof diagram === "string") return diagram;
        const coordinate = diagram.index.coordinateClause();
        const conj = coordinate && diagram.index.conjunction(coordinate.id, "clause");
        if (!conj || nodeWord(tokens, conj) !== word) return `Join the clauses with "${word}".`;
        return null;
      }) satisfies Check,
    ]),
  );
}

function complexPatterns(): Record<string, Check> {
  return Object.fromEntries(
    ["because", "when", "after", "before", "while", "until", "if", "since"].map((word) => [
      `subordinator-${word}`,
      ((tokens: Token[], source: Source) => {
        const diagram = diagramOf(source);
        if (typeof diagram === "string") return diagram;
        const subordinate = diagram.index.subordinateClause();
        const subordinator = subordinate && diagram.index.children(subordinate.id, "subordinator")[0];
        if (!subordinator || nodeWord(tokens, subordinator) !== word) return `Start the dependent clause with "${word}".`;
        const verbAt = Math.min(...diagram.index.children(diagram.main.id, "verb").flatMap((verb) => verb.words));
        if (subordinator.words[0] <= verbAt) return "Put the dependent clause after the main clause.";
        return null;
      }) satisfies Check,
    ]),
  );
}

function commandPatterns(): Record<string, Check> {
  const flags = (tokens: Token[], source: Source) => {
    if (!source.nodes) return "The diagram is missing.";
    return {
      implied: source.nodes.some((node) => node.implied === "you"),
      question: tokens.at(-1)?.text === "?",
      verbPhrase: source.nodes.some((node) => node.role === "verb" && node.words.length > 1),
    };
  };
  return {
    command: (tokens, source) => {
      const found = flags(tokens, source);
      if (typeof found === "string") return found;
      if (!found.implied || found.question || found.verbPhrase) return "Write a command with an understood you, and no helping verb or question mark.";
      return null;
    },
    question: (tokens, source) => {
      const found = flags(tokens, source);
      if (typeof found === "string") return found;
      if (!found.question || found.implied) return "Write a yes/no question that ends with a question mark.";
      return null;
    },
    "verb-phrase": (tokens, source) => {
      const found = flags(tokens, source);
      if (typeof found === "string") return found;
      if (!found.verbPhrase || found.question || found.implied) return "Write a statement whose verb is a helping verb plus a main verb, ending with a period.";
      return null;
    },
  };
}

const CHECKS: Record<string, Record<string, Check>> = {
  subject: subjectPatterns(),
  "nouns-verbs": nounVerbPatterns(),
  "adjectives-adverbs": adverbPatterns(),
  "phrases-clauses": clausePatterns(),
  "putting-it-together": clausePatterns(),
  "subject-verb-modifiers": subjectVerbPatterns(),
  "direct-objects": directObjectPatterns(),
  "predicate-adj-nom": predicatePatterns(),
  "prepositional-phrases": phrasePatterns(),
  "indirect-objects": indirectObjectPatterns(),
  "compound-parts": compoundPartPatterns(),
  "compound-predicates": compoundPredicatePatterns(),
  "compound-sentences": compoundSentencePatterns(),
  "complex-sentences": complexPatterns(),
  "commands-questions-verb-phrases": commandPatterns(),
};
