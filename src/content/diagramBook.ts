import type { ClauseKind, DiagramFeature, DiagramNode, DiagramRole, JoinableRole } from "@/lib/diagram/types";
import type { Book, DiagramChapter, DiagramExample } from "./books";

function n(
  id: string,
  role: DiagramRole,
  parent: string | null,
  words: number[] = [],
  extra: { clauseKind?: ClauseKind; joins?: JoinableRole; implied?: "you"; modifies?: JoinableRole } = {},
): DiagramNode {
  return { id, role, parent, words, ...extra };
}

const main = () => n("c", "clause", null, [], { clauseKind: "main" });
const example = (sentence: string, nodes: DiagramNode[]): DiagramExample => ({ sentence, nodes });

const F1: DiagramFeature[] = ["modifier"];
const F2: DiagramFeature[] = [...F1, "direct-object"];
const F3: DiagramFeature[] = [...F2, "predicate-adjective", "predicate-nominative"];
const F4: DiagramFeature[] = [...F3, "prepositional-phrase"];
const F5: DiagramFeature[] = [...F4, "indirect-object"];
const F6: DiagramFeature[] = [...F5, "compound"];
const F6b: DiagramFeature[] = [...F6, "compound-predicate"];
const F7: DiagramFeature[] = [...F6, "coordinate-clause"];
const F8: DiagramFeature[] = [...F7, "subordinate-clause"];
const F9: DiagramFeature[] = [...F8, "implied-you", "question", "verb-phrase"];

const chapters: DiagramChapter[] = [
  {
    kind: "diagram",
    slug: "subject-verb-modifiers",
    title: "Subject, Verb & Modifiers",
    summary: "Put the subject and verb on the baseline, and hang articles, adjectives, and adverbs below.",
    features: F1,
    required: [["modifier"]],
    examples: [
      // The little bird sings sweetly .
      example("The little bird sings sweetly.", [
        main(),
        n("s", "subject", "c", [2]),
        n("v", "verb", "c", [3]),
        n("m1", "modifier", "s", [0]),
        n("m2", "modifier", "s", [1]),
        n("m3", "modifier", "v", [4]),
      ]),
    ],
    generationRules: [
      "Use only a subject, a one-word verb, and single-word modifiers (articles, adjectives, adverbs).",
      "The verb must be an action verb with no object.",
      "Include at least one adjective or article on the subject and at least one adverb on the verb.",
    ],
    patterns: [
      {
        id: "article-adverb-after",
        instruction:
          "Use an article and an adjective on the subject, one action verb, and a manner adverb after the verb, as in 'The little bird sings sweetly.' Do not place the adverb before the verb.",
      },
      {
        id: "adjective-adverb-after",
        instruction:
          "Use an adjective and no article on the subject, one action verb, and a manner adverb after the verb, as in 'Little birds sing sweetly.' Do not place the adverb before the verb.",
      },
      {
        id: "adverb-before",
        instruction:
          "Use one action verb with a manner adverb immediately before it, as in 'The little bird sweetly sings.' Also put an article or an adjective on the subject. Do not also put an adverb after the verb.",
      },
    ],
  },
  {
    kind: "diagram",
    slug: "direct-objects",
    title: "Direct Objects",
    summary: "Find who or what receives the action, and put it after the short line on the baseline.",
    features: F2,
    required: [["direct-object"]],
    examples: [
      // The bird ate the seed .
      example("The bird ate the seed.", [
        main(),
        n("s", "subject", "c", [1]),
        n("v", "verb", "c", [2]),
        n("o", "direct-object", "c", [4]),
        n("m1", "modifier", "s", [0]),
        n("m2", "modifier", "o", [3]),
      ]),
    ],
    generationRules: [
      "The sentence must have exactly one direct object.",
      "Put modifiers only where the sentence shape asks for them.",
    ],
    patterns: [
      {
        id: "object-modifier",
        instruction: "Use exactly one direct object that has a modifier, such as 'the seed'. Do not put an adverb on the verb.",
      },
      {
        id: "subject-adjective",
        instruction:
          "Put an adjective on the subject, and use exactly one direct object with no modifier of its own, such as 'The hungry bird ate seeds.' Do not put an adverb on the verb.",
      },
      {
        id: "verb-adverb",
        instruction: "Use exactly one direct object, and put an adverb on the verb, such as 'The bird quickly ate the seed.'",
      },
    ],
  },
  {
    kind: "diagram",
    slug: "predicate-adj-nom",
    title: "Predicate Adjectives & Nominatives",
    summary: "After a linking verb, a describing word or a renaming noun goes after the slanted line.",
    features: F3,
    required: [["predicate-adjective", "predicate-nominative"]],
    examples: [
      // The bird is happy .
      example("The bird is happy.", [
        main(),
        n("s", "subject", "c", [1]),
        n("v", "verb", "c", [2]),
        n("pa", "predicate-adjective", "c", [3]),
        n("m1", "modifier", "s", [0]),
      ]),
      // The bird is a singer .
      example("The bird is a singer.", [
        main(),
        n("s", "subject", "c", [1]),
        n("v", "verb", "c", [2]),
        n("pn", "predicate-nominative", "c", [4]),
        n("m1", "modifier", "s", [0]),
        n("m2", "modifier", "pn", [3]),
      ]),
    ],
    generationRules: [
      "Use a one-word linking verb (is, are, was, were, seems, looks, feels, becomes).",
      "Use the predicate word named in the sentence shape, and do not use the other one.",
      "Do not use a direct object.",
    ],
    patterns: [
      {
        id: "predicate-adjective",
        instruction: "Use a one-word linking verb and exactly one predicate adjective. Do not use a predicate nominative or a direct object.",
      },
      {
        id: "predicate-nominative",
        instruction: "Use a one-word linking verb and exactly one predicate nominative. Do not use a predicate adjective or a direct object.",
      },
    ],
  },
  {
    kind: "diagram",
    slug: "prepositional-phrases",
    title: "Prepositional Phrases",
    summary: "Hang the preposition on a slanted line and its object on a line below it.",
    features: F4,
    required: [["prepositional-phrase"]],
    examples: [
      // The bird sang in the tree .
      example("The bird sang in the tree.", [
        main(),
        n("s", "subject", "c", [1]),
        n("v", "verb", "c", [2]),
        n("p", "preposition", "v", [3]),
        n("po", "prep-object", "p", [5]),
        n("m1", "modifier", "s", [0]),
        n("m2", "modifier", "po", [4]),
      ]),
      // The bird in the tree sang .
      example("The bird in the tree sang.", [
        main(),
        n("s", "subject", "c", [1]),
        n("v", "verb", "c", [5]),
        n("p", "preposition", "s", [2]),
        n("po", "prep-object", "p", [4]),
        n("m1", "modifier", "s", [0]),
        n("m2", "modifier", "po", [3]),
      ]),
      // The bird ate the seed in the tree .
      example("The bird ate the seed in the tree.", [
        main(),
        n("s", "subject", "c", [1]),
        n("v", "verb", "c", [2]),
        n("o", "direct-object", "c", [4]),
        n("p", "preposition", "o", [5]),
        n("po", "prep-object", "p", [7]),
        n("m1", "modifier", "s", [0]),
        n("m2", "modifier", "o", [3]),
        n("m3", "modifier", "po", [6]),
      ]),
    ],
    generationRules: [
      "Include exactly one prepositional phrase, with exactly one object.",
      "The phrase must describe the word named in the sentence shape.",
    ],
    patterns: [
      {
        id: "phrase-on-verb",
        instruction: "Use exactly one prepositional phrase, and make it describe the verb, as in 'The bird sang in the tree.'",
      },
      {
        id: "phrase-on-subject",
        instruction: "Use exactly one prepositional phrase, and make it describe the subject, as in 'The bird in the tree sang.'",
      },
      {
        id: "phrase-on-object",
        instruction:
          "Use exactly one direct object and exactly one prepositional phrase that describes that object, as in 'The bird ate the seed in the tree.'",
      },
    ],
  },
  {
    kind: "diagram",
    slug: "indirect-objects",
    title: "Indirect Objects",
    summary: "Find to whom or for whom the action is done, and put it below the verb.",
    features: F5,
    required: [["indirect-object"], ["direct-object"]],
    examples: [
      // Mom gave the bird a seed .
      example("Mom gave the bird a seed.", [
        main(),
        n("s", "subject", "c", [0]),
        n("v", "verb", "c", [1]),
        n("io", "indirect-object", "c", [3]),
        n("o", "direct-object", "c", [5]),
        n("m1", "modifier", "io", [2]),
        n("m2", "modifier", "o", [4]),
      ]),
    ],
    generationRules: [
      "The sentence must have exactly one indirect object AND exactly one direct object.",
      "Use the verb named in the sentence shape.",
      "Do not use 'to' or 'for' before the indirect object.",
    ],
    patterns: ["gave", "showed", "told", "brought", "sent", "handed"].map((verb) => ({
      id: `verb-${verb}`,
      instruction: `Use the verb "${verb}". Keep exactly one indirect object and exactly one direct object, with no "to" or "for" before the indirect object.`,
    })),
  },
  {
    kind: "diagram",
    slug: "compound-parts",
    title: "Compound Subjects, Verbs & Objects",
    summary: "When two parts share a job, split the line into a fork with the conjunction on a dashed line.",
    features: F6,
    required: [["compound"]],
    examples: [
      // The bird and the squirrel ate .
      example("The bird and the squirrel ate.", [
        main(),
        n("s1", "subject", "c", [1]),
        n("s2", "subject", "c", [4]),
        n("k", "conjunction", "c", [2], { joins: "subject" }),
        n("v", "verb", "c", [5]),
        n("m1", "modifier", "s1", [0]),
        n("m2", "modifier", "s2", [3]),
      ]),
      // The bird sang and danced .
      example("The bird sang and danced.", [
        main(),
        n("s", "subject", "c", [1]),
        n("v1", "verb", "c", [2]),
        n("v2", "verb", "c", [4]),
        n("k", "conjunction", "c", [3], { joins: "verb" }),
        n("m1", "modifier", "s", [0]),
      ]),
      // The bird ate the seed and the nut .
      example("The bird ate the seed and the nut.", [
        main(),
        n("s", "subject", "c", [1]),
        n("v", "verb", "c", [2]),
        n("o1", "direct-object", "c", [4]),
        n("o2", "direct-object", "c", [7]),
        n("k", "conjunction", "c", [5], { joins: "direct-object" }),
        n("m1", "modifier", "s", [0]),
        n("m2", "modifier", "o1", [3]),
        n("m3", "modifier", "o2", [6]),
      ]),
    ],
    generationRules: [
      "Join the compound part named in the sentence shape with and.",
      "If the verbs are compound, do not use any direct object, indirect object, or predicate word.",
      "Keep it to one clause.",
    ],
    patterns: [
      {
        id: "compound-subject",
        instruction:
          "Use a compound subject: exactly two subjects joined by and, exactly one verb, and no direct object. Example shape: 'The bird and the squirrel ate.'",
      },
      {
        id: "compound-verb",
        instruction:
          "Use a compound verb: exactly one subject, exactly two verbs joined by and, and no direct object. Example shape: 'The bird sang and danced.'",
      },
      {
        id: "compound-object",
        instruction:
          "Use a compound direct object: exactly one subject, exactly one verb, and exactly two direct objects joined by and. Example shape: 'The bird ate the seed and the nut.'",
      },
    ],
  },
  {
    kind: "diagram",
    slug: "compound-predicates",
    title: "Compound Subjects & Predicates",
    summary: "A sentence can split in more than one place: two subjects and two verbs, verbs that share an object, or verbs that each take their own object.",
    features: F6b,
    required: [["compound-predicate"]],
    examples: [
      // Jake and Emma laughed and clapped .
      example("Jake and Emma laughed and clapped.", [
        main(),
        n("s1", "subject", "c", [0]),
        n("s2", "subject", "c", [2]),
        n("ks", "conjunction", "c", [1], { joins: "subject" }),
        n("v1", "verb", "c", [3]),
        n("v2", "verb", "c", [5]),
        n("kv", "conjunction", "c", [4], { joins: "verb" }),
      ]),
      // They washed and dried the sticky pots and greasy pans .
      example("They washed and dried the sticky pots and greasy pans.", [
        main(),
        n("s", "subject", "c", [0]),
        n("v1", "verb", "c", [1]),
        n("v2", "verb", "c", [3]),
        n("kv", "conjunction", "c", [2], { joins: "verb" }),
        n("o1", "direct-object", "c", [6]),
        n("o2", "direct-object", "c", [9]),
        n("ko", "conjunction", "c", [7], { joins: "direct-object" }),
        n("mthe", "modifier", "c", [4], { modifies: "direct-object" }),
        n("msticky", "modifier", "o1", [5]),
        n("mgreasy", "modifier", "o2", [8]),
      ]),
      // They mixed the dough quickly , put it into the oven , and waited .
      example("They mixed the dough quickly, put it into the oven, and waited.", [
        main(),
        n("s", "subject", "c", [0]),
        n("v1", "verb", "c", [1]),
        n("v2", "verb", "c", [6]),
        n("v3", "verb", "c", [13]),
        n("kv", "conjunction", "c", [12], { joins: "verb" }),
        n("o1", "direct-object", "v1", [3]),
        n("mthe", "modifier", "o1", [2]),
        n("mq", "modifier", "v1", [4]),
        n("o2", "direct-object", "v2", [7]),
        n("p", "preposition", "v2", [8]),
        n("po", "prep-object", "p", [10]),
        n("mthe2", "modifier", "po", [9]),
      ]),
    ],
    generationRules: [
      "Follow the sentence shape. It is the only compound pattern to use.",
      "One clause only. At most three verbs. Join each compound with a single and. Commas are punctuation and are not placed on the diagram.",
      "When the verbs share an object, the object and its conjunction parent to the clause. When each verb has its own object, that object parents to the verb.",
      "A word that modifies every part of a compound, such as 'the' in 'the sticky pots and greasy pans', is a modifier parented to the clause with modifies set to direct-object.",
      "Do not use a predicate adjective, predicate nominative, indirect object, dependent clause, or a second independent clause.",
    ],
    patterns: [
      {
        id: "subject-and-verb",
        instruction:
          "Use a compound subject and a compound verb, with nothing after the verbs. Join each pair with a single and. Example shape: 'Jake and Emma laughed and clapped.'",
      },
      {
        id: "shared-object",
        instruction:
          "Use one subject and a compound verb whose verbs share one compound direct object. Include a modifier of that whole object, such as 'the' in 'the sticky pots and greasy pans'. Parent the object, its conjunction, and that shared modifier to the clause.",
      },
      {
        id: "per-verb",
        instruction:
          "Use one subject and two or three verbs joined by a single and. Each verb that takes an object, adverb, or prepositional phrase has its own, parented to that verb. Do not give the verbs one shared object.",
      },
    ],
  },
  {
    kind: "diagram",
    slug: "compound-sentences",
    title: "Compound Sentences",
    summary: "Two complete sentences joined by and, but, or or get two baselines and a dashed step.",
    features: F7,
    required: [["coordinate-clause"]],
    examples: [
      // The bird sang , and the squirrel ran .
      example("The bird sang, and the squirrel ran.", [
        main(),
        n("s", "subject", "c", [1]),
        n("v", "verb", "c", [2]),
        n("m1", "modifier", "s", [0]),
        n("c2", "clause", null, [], { clauseKind: "coordinate" }),
        n("k", "conjunction", "c2", [4], { joins: "clause" }),
        n("s2", "subject", "c2", [6]),
        n("v2", "verb", "c2", [7]),
        n("m2", "modifier", "s2", [5]),
      ]),
    ],
    generationRules: [
      "Write two independent clauses joined by a comma and the coordinating conjunction named in the sentence shape.",
      "Each clause has its own subject and verb. Keep each clause short.",
      "Do not use a dependent clause.",
    ],
    patterns: ["and", "but", "or"].map((word) => ({
      id: `join-${word}`,
      instruction: `Join the two independent clauses with a comma and "${word}". Each clause has its own subject and verb. Do not use a dependent clause.`,
    })),
  },
  {
    kind: "diagram",
    slug: "complex-sentences",
    title: "Complex Sentences",
    summary: "A dependent clause gets its own baseline, linked to the verb by a dashed line with its conjunction.",
    features: F8,
    required: [["subordinate-clause"]],
    examples: [
      // The bird sang because it was happy .
      example("The bird sang because it was happy.", [
        main(),
        n("s", "subject", "c", [1]),
        n("v", "verb", "c", [2]),
        n("m1", "modifier", "s", [0]),
        n("d", "clause", "v", [], { clauseKind: "subordinate" }),
        n("b", "subordinator", "d", [3]),
        n("s2", "subject", "d", [4]),
        n("v2", "verb", "d", [5]),
        n("pa", "predicate-adjective", "d", [6]),
      ]),
    ],
    generationRules: [
      "Write one independent clause followed by one adverb clause that tells why, when, or where about the main verb.",
      "Start the dependent clause with the conjunction named in the sentence shape. Put it AFTER the main clause, with no comma.",
      "Do not use relative clauses (who, which, that) and do not add a second independent clause.",
    ],
    patterns: ["because", "when", "after", "before", "while", "until", "if", "since"].map((word) => ({
      id: `subordinator-${word}`,
      instruction: `Start the dependent clause with "${word}". Put that clause after the main clause, with no comma before it. Do not copy a different conjunction from the example.`,
    })),
  },
  {
    kind: "diagram",
    slug: "commands-questions-verb-phrases",
    title: "Commands, Questions & Verb Phrases",
    summary: "Diagram commands with (you), put questions back in statement order, and keep helping verbs with the verb.",
    features: F9,
    required: [["implied-you", "question", "verb-phrase"]],
    examples: [
      // Sing sweetly .
      example("Sing sweetly.", [
        main(),
        n("s", "subject", "c", [], { implied: "you" }),
        n("v", "verb", "c", [0]),
        n("m1", "modifier", "v", [1]),
      ]),
      // Did the bird sing ?
      example("Did the bird sing?", [
        main(),
        n("s", "subject", "c", [2]),
        n("v", "verb", "c", [0, 3]),
        n("m1", "modifier", "s", [1]),
      ]),
      // The bird is singing .
      example("The bird is singing.", [
        main(),
        n("s", "subject", "c", [1]),
        n("v", "verb", "c", [2, 3]),
        n("m1", "modifier", "s", [0]),
      ]),
    ],
    generationRules: [
      "Write the sentence kind named in the sentence shape.",
      "In a question, the helping verb and main verb both go in the verb node, and the question mark ends the sentence.",
      "Do not start a question with who, what, where, when, why, or how.",
      "For a command, the subject node has implied set to true and an empty words list.",
    ],
    patterns: [
      {
        id: "command",
        instruction:
          "Write a command with an understood you subject, ending with a period or an exclamation point. Do not write a question or a statement with a helping verb.",
      },
      {
        id: "question",
        instruction:
          "Write a yes/no question that starts with a helping verb (Did, Can, Will, Is, or Does) and ends with a question mark. Do not start with who, what, where, when, why, or how.",
      },
      {
        id: "verb-phrase",
        instruction:
          "Write a statement, ending with a period, whose verb is a helping verb plus a main verb, such as 'is singing' or 'will jump'. Do not write a command or a question.",
      },
    ],
  },
];

export const DIAGRAMMING_BOOK: Book = {
  slug: "sentence-diagramming",
  title: "Sentence Diagramming",
  subtitle: "Draw the shape of a sentence",
  kind: "diagram",
  status: "available",
  spine: { color: "#065f46", accent: "#fde68a", height: 250, width: 60 },
  chapters,
};
