import type { DiagramFeature, DiagramNode } from "@/lib/diagram/types";
import { DIAGRAMMING_BOOK } from "./diagramBook";

export type LabelDef = {
  id: string;
  name: string;
  /** Short kid-friendly definition shown in the palette and given to the AI. */
  description: string;
  /** "word" labels tag single words (possibly several); "phrase" labels tag runs of words. */
  kind: "word" | "phrase";
  /** Tailwind-friendly hex color used for highlights. */
  color: string;
};

export type SentencePattern = {
  id: string;
  /** Required shape added to the generator prompt for this step of the session. */
  instruction: string;
  /** Grades below this never see the pattern. Omit to offer it at every grade. */
  minGrade?: number;
};

type ChapterBase = {
  slug: string;
  title: string;
  summary: string;
  /** Extra rules the sentence generator must follow for this chapter. */
  generationRules: string[];
  /** Session rotation. Each new sentence requires the next pattern. */
  patterns?: SentencePattern[];
};

const CLAUSE_SHAPES: { position: "after" | "before"; word: string }[] = [
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

function clausePatterns(reminder: string): SentencePattern[] {
  return CLAUSE_SHAPES.map(({ position, word }) => ({
    id: `${position}-${word}`,
    instruction:
      position === "after"
        ? `Put the independent clause first. End the sentence with a dependent clause that begins with "${word}". ${reminder}`
        : `Start the sentence with a dependent clause that begins with "${word}", then finish with the independent clause. ${reminder}`,
  }));
}

export type TaggingChapter = ChapterBase & {
  kind: "tagging";
  labels: LabelDef[];
};

export type DiagramExample = { sentence: string; nodes: DiagramNode[] };

export type DiagramChapter = ChapterBase & {
  kind: "diagram";
  /** Hand-diagrammed sample sentences shown in the "See an example" card. */
  examples: DiagramExample[];
  /** Diagram elements this chapter may use (earlier chapters' elements included). */
  features: DiagramFeature[];
  /** Each group lists alternatives; every generated sentence must use at least one feature from each group. */
  required: DiagramFeature[][];
};

export type Chapter = TaggingChapter | DiagramChapter;

export type Book = {
  slug: string;
  title: string;
  subtitle: string;
  kind: "tagging" | "diagram";
  status: "available" | "coming-soon";
  spine: { color: string; accent: string; height: number; width: number };
  chapters: Chapter[];
};

export const isDiagramChapter = (chapter: Chapter): chapter is DiagramChapter => chapter.kind === "diagram";
export const isTaggingChapter = (chapter: Chapter): chapter is TaggingChapter => chapter.kind === "tagging";

const L = {
  completeSubject: {
    id: "complete-subject",
    name: "Complete subject",
    description: "All the words that tell who or what the sentence is about.",
    kind: "phrase",
    color: "#2563eb",
  },
  simpleSubject: {
    id: "simple-subject",
    name: "Simple subject",
    description: "The main noun or pronoun inside the complete subject, without describing words.",
    kind: "word",
    color: "#dc2626",
  },
  noun: {
    id: "noun",
    name: "Noun",
    description: "A person, place, thing, or idea. Don't tag pronouns like he, she, or it.",
    kind: "word",
    color: "#2563eb",
  },
  verb: {
    id: "verb",
    name: "Verb",
    description: "An action or being word. Include helping verbs like is, was, or will.",
    kind: "word",
    color: "#16a34a",
  },
  adjective: {
    id: "adjective",
    name: "Adjective",
    description: "Describes a noun: what kind, which one, or how many. Skip a, an, and the.",
    kind: "word",
    color: "#9333ea",
  },
  adverb: {
    id: "adverb",
    name: "Adverb",
    description: "Describes a verb, adjective, or adverb: how, when, where, or how much.",
    kind: "word",
    color: "#ea580c",
  },
  prepositionalPhrase: {
    id: "prepositional-phrase",
    name: "Prepositional phrase",
    description: "Starts with a preposition (in, on, under, after...) and ends with its noun or pronoun.",
    kind: "phrase",
    color: "#0891b2",
  },
  dependentClause: {
    id: "dependent-clause",
    name: "Dependent clause",
    description: "A group of words with a subject and verb that can't stand alone as a sentence.",
    kind: "phrase",
    color: "#c026d3",
  },
  subordinatingConjunction: {
    id: "subordinating-conjunction",
    name: "Subordinating conjunction",
    description: "The word that starts a dependent clause, like because, when, although, or if.",
    kind: "word",
    color: "#ca8a04",
  },
} satisfies Record<string, LabelDef>;

export const BOOKS: Book[] = [
  {
    slug: "sentence-parts",
    title: "Parts of a Sentence",
    subtitle: "Find the pieces that build a sentence",
    kind: "tagging",
    status: "available",
    spine: { color: "#1e3a8a", accent: "#fbbf24", height: 260, width: 64 },
    chapters: [
      {
        kind: "tagging",
        slug: "subject",
        title: "The Subject",
        summary: "Find who or what the sentence is about.",
        labels: [L.completeSubject, L.simpleSubject],
        generationRules: [
          "The sentence must be a single independent clause (no dependent clauses).",
          "The complete subject should have at least one describing word so it differs from the simple subject.",
          "Use exactly one simple subject unless the sentence shape asks for a compound subject.",
        ],
        patterns: [
          {
            id: "article-adjective",
            instruction:
              "The complete subject is an article (a, an, or the), one adjective, and one noun, in that order, such as 'The little otter'. Tag only that noun as the simple subject. Do not use a compound subject or a prepositional phrase.",
          },
          {
            id: "adjective-noun",
            instruction:
              "The complete subject is one adjective and one noun, with no article, such as 'Hungry otters'. Tag only that noun as the simple subject. Do not use a compound subject or a prepositional phrase.",
          },
          {
            id: "subject-phrase",
            instruction:
              "The complete subject is an article, one noun, and a short prepositional phrase using in, on, under, or with, such as 'The otter in the river'. Tag only the noun before the preposition as the simple subject. Do not use a compound subject.",
          },
          {
            id: "compound-subject",
            minGrade: 6,
            instruction:
              "Use a compound subject: exactly two nouns joined by and, such as 'The otter and the heron'. Tag each noun as a simple subject, and include and inside the complete subject. Do not add a prepositional phrase.",
          },
        ],
      },
      {
        kind: "tagging",
        slug: "nouns-verbs",
        title: "Nouns & Verbs",
        summary: "Spot the naming words and the action words.",
        labels: [L.noun, L.verb],
        generationRules: [
          "Include at least two nouns and at least one verb.",
          "Tag common and proper nouns only. Do not tag pronouns or possessive pronouns as nouns.",
          "Tag every verb word, including helping verbs (for example 'was running' is two verb words).",
          "Avoid gerunds, infinitives, and nouns used as adjectives, which confuse young learners.",
        ],
        patterns: [
          {
            id: "two-common",
            instruction:
              "Use exactly two common nouns and exactly one verb word. Do not use a name, a helping verb, or a prepositional phrase. Example shape: 'The otter ate a fish.'",
          },
          {
            id: "proper-noun",
            instruction:
              "Include a proper noun that is not the first word of the sentence, such as the name Emma. Use exactly one verb word and no prepositional phrase.",
          },
          {
            id: "helping-verb",
            instruction:
              "Use a helping verb and a main verb as two separate verb words, such as 'was eating' or 'will find'. Use common nouns only, with no names and no prepositional phrase.",
          },
          {
            id: "prep-noun",
            instruction:
              "Include a prepositional phrase whose object is a noun, so the sentence has at least three nouns. Use exactly one verb word and no names. Example shape: 'The otter found a shell on the rock.'",
          },
        ],
      },
      {
        kind: "tagging",
        slug: "adjectives-adverbs",
        title: "Adjectives & Adverbs",
        summary: "Find the words that describe.",
        labels: [L.adjective, L.adverb],
        generationRules: [
          "Include at least one adjective and at least one adverb.",
          "Do not tag the articles a, an, or the as adjectives.",
          "Do not tag possessive nouns or possessive pronouns as adjectives.",
          "Avoid words that could reasonably be read as either part of speech.",
        ],
        patterns: [
          {
            id: "manner-after",
            instruction:
              "Use exactly one manner adverb after the verb, such as 'quietly' or 'slowly'. Do not use a time adverb such as yesterday, today, tomorrow, soon, now, later, always, often, sometimes, or never, and do not place the adverb before the verb.",
          },
          {
            id: "time-adverb",
            instruction:
              "Use exactly one time adverb, chosen from yesterday, today, tomorrow, soon, now, later, always, often, sometimes, or never.",
          },
          {
            id: "adverb-before",
            instruction:
              "Place exactly one manner adverb immediately before the verb, such as 'quickly swims'. Do not use a time adverb such as yesterday, soon, or often.",
          },
        ],
      },
      {
        kind: "tagging",
        slug: "phrases-clauses",
        title: "Phrases & Clauses",
        summary: "Prepositional phrases, dependent clauses, and the words that start them.",
        labels: [L.prepositionalPhrase, L.dependentClause, L.subordinatingConjunction],
        generationRules: [
          "The sentence must be complex: one independent clause plus exactly one dependent clause.",
          "The dependent clause must begin with the subordinating conjunction named in the sentence shape.",
          "Include at least one prepositional phrase. A prepositional phrase is the preposition through its object, including describing words in between.",
          "The dependent clause span includes its subordinating conjunction and runs to the end of the clause.",
          "Do not use relative clauses (who, which, that) as the dependent clause.",
        ],
        patterns: clausePatterns("Also include a prepositional phrase."),
      },
      {
        kind: "tagging",
        slug: "putting-it-together",
        title: "Putting It All Together",
        summary: "Find every part you've learned in one sentence.",
        labels: [
          { ...L.completeSubject, color: "#dc2626" },
          L.noun,
          L.verb,
          L.adjective,
          L.adverb,
          L.prepositionalPhrase,
          L.dependentClause,
        ],
        generationRules: [
          "The sentence must be complex: one independent clause plus exactly one dependent clause.",
          "The dependent clause must begin with the subordinating conjunction named in the sentence shape.",
          "Do not use relative clauses (who, which, that) as the dependent clause.",
          "Tag the complete subject of the independent clause only, not the subject inside the dependent clause. It must have at least one describing word.",
          "Include at least two nouns, at least one adjective, at least one adverb, and at least one prepositional phrase.",
          "Tag every noun and every verb in the whole sentence, including those inside the dependent clause and phrases. Include helping verbs; do not tag pronouns as nouns.",
          "Do not tag the articles a, an, or the as adjectives, and do not tag possessives as adjectives.",
          "A prepositional phrase is the preposition through its object, including describing words in between.",
          "The dependent clause span includes its subordinating conjunction and runs to the end of the clause.",
          "Avoid gerunds, infinitives, nouns used as adjectives, and words that could reasonably be read as more than one part of speech.",
          "Keep the sentence short enough to read comfortably: about 12 to 20 words.",
        ],
        patterns: clausePatterns("Keep the nouns, adjective, adverb, prepositional phrase, and complete subject this chapter requires."),
      },
    ],
  },
  DIAGRAMMING_BOOK,
  {
    slug: "spelling",
    title: "Spelling",
    subtitle: "Word lists and spelling practice",
    kind: "tagging",
    status: "coming-soon",
    spine: { color: "#166534", accent: "#fde68a", height: 230, width: 56 },
    chapters: [],
  },
];

export function getBook(slug: string): Book | undefined {
  return BOOKS.find((b) => b.slug === slug);
}

export function getChapter(bookSlug: string, chapterSlug: string): { book: Book; chapter: Chapter } | undefined {
  const book = getBook(bookSlug);
  const chapter = book?.chapters.find((c) => c.slug === chapterSlug);
  return book && chapter ? { book, chapter } : undefined;
}

export function chapterTitle(bookSlug: string, chapterSlug: string): string {
  const found = getChapter(bookSlug, chapterSlug);
  return found ? `${found.book.title}: ${found.chapter.title}` : `${bookSlug}/${chapterSlug}`;
}
