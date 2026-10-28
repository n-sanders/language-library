import type { ClauseKind, DiagramFeature, DiagramNode, DiagramRole, JoinableRole } from "@/lib/diagram/types";
import type { Book, DiagramChapter, DiagramExample } from "./books";

function n(
  id: string,
  role: DiagramRole,
  parent: string | null,
  words: number[] = [],
  extra: { clauseKind?: ClauseKind; joins?: JoinableRole; implied?: "you" } = {},
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
      "The verb must be an action verb with no object, for example 'The happy puppy runs quickly.'",
      "Include at least one adjective or article on the subject and at least one adverb on the verb.",
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
      "Modifiers on the subject, verb, or direct object are welcome.",
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
      "Use exactly one predicate adjective OR exactly one predicate nominative, never both.",
      "Do not use a direct object.",
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
    ],
    generationRules: [
      "Include one or two prepositional phrases, each with exactly one object.",
      "Each prepositional phrase must clearly describe one word: the verb, the subject, or an object.",
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
      "The sentence must have exactly one indirect object AND exactly one direct object, like 'Grandpa gave the dog a bone.'",
      "Use a verb like gave, showed, told, brought, sent, made, or handed.",
      "Do not use 'to' or 'for' before the indirect object.",
    ],
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
    ],
    generationRules: [
      "Use exactly one compound part: two subjects, two verbs, or two direct objects joined by and, or, or but.",
      "If the verbs are compound, do not use any direct object, indirect object, or predicate word.",
      "Keep it to one clause.",
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
      "Write two independent clauses joined by a comma and one coordinating conjunction (and, but, or).",
      "Each clause has its own subject and verb. Keep each clause short.",
      "Do not use a dependent clause.",
    ],
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
      "Start the dependent clause with because, when, after, before, while, until, if, or since. Put it AFTER the main clause, with no comma.",
      "Do not use relative clauses (who, which, that) and do not add a second independent clause.",
    ],
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
      "Write ONE of these: a command with an understood 'you' subject (ending with a period or exclamation point), a yes/no question that starts with a helping verb (Did, Can, Will, Is, Does), or a statement with a helping verb plus a main verb (is singing, will jump, can swim).",
      "In a question, the helping verb and main verb both go in the verb node, and the question mark ends the sentence.",
      "Do not start a question with who, what, where, when, why, or how.",
      "For a command, the subject node has implied set to true and an empty words list.",
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
