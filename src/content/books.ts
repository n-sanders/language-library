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

export type Chapter = {
  slug: string;
  title: string;
  summary: string;
  labels: LabelDef[];
  /** Extra rules the sentence generator must follow for this chapter. */
  generationRules: string[];
};

export type Book = {
  slug: string;
  title: string;
  subtitle: string;
  status: "available" | "coming-soon";
  spine: { color: string; accent: string; height: number; width: number };
  chapters: Chapter[];
};

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
    status: "available",
    spine: { color: "#1e3a8a", accent: "#fbbf24", height: 260, width: 64 },
    chapters: [
      {
        slug: "subject",
        title: "The Subject",
        summary: "Find who or what the sentence is about.",
        labels: [L.completeSubject, L.simpleSubject],
        generationRules: [
          "The sentence must be a single independent clause (no dependent clauses).",
          "The complete subject should have at least one describing word so it differs from the simple subject.",
          "Avoid compound subjects unless the grade level is 6 or higher.",
          "The simple subject is the single key noun or pronoun inside the complete subject.",
        ],
      },
      {
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
      },
      {
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
      },
      {
        slug: "phrases-clauses",
        title: "Phrases & Clauses",
        summary: "Prepositional phrases, dependent clauses, and the words that start them.",
        labels: [L.prepositionalPhrase, L.dependentClause, L.subordinatingConjunction],
        generationRules: [
          "The sentence must be complex: one independent clause plus exactly one dependent clause.",
          "The dependent clause must begin with a subordinating conjunction (because, when, although, if, since, after, before, while, until, unless).",
          "Include at least one prepositional phrase. A prepositional phrase is the preposition through its object, including describing words in between.",
          "The dependent clause span includes its subordinating conjunction and runs to the end of the clause.",
          "Do not use relative clauses (who, which, that) as the dependent clause.",
        ],
      },
      {
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
          "The dependent clause must begin with a subordinating conjunction (because, when, although, if, since, after, before, while, until, unless).",
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
      },
    ],
  },
  {
    slug: "spelling",
    title: "Spelling",
    subtitle: "Word lists and spelling practice",
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
