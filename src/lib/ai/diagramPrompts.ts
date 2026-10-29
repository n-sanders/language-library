import type { DiagramChapter, SentencePattern } from "@/content/books";
import { describeDiagram } from "@/lib/diagram/describe";
import { CLAUSE_KINDS, DIAGRAM_ROLES, JOINABLE_ROLES, ROLE_NAMES, type DiagramNode } from "@/lib/diagram/types";
import { gradeGuidance, gradeLabel } from "@/lib/grade";
import { matchingExamples, shapeLines } from "@/lib/patterns";
import { detokenize, tokenize } from "@/lib/tokenize";
import type { Token } from "@/lib/types";
import type { ChatMessage } from "./openrouter";

export function diagramSchema() {
  return {
    name: "diagram_sentence",
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["words", "nodes"],
      properties: {
        words: { type: "array", items: { type: "string" } },
        nodes: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["id", "role", "words", "parent", "clauseKind", "joins", "modifies", "implied"],
            properties: {
              id: { type: "string" },
              role: { type: "string", enum: [...DIAGRAM_ROLES] },
              words: { type: "array", items: { type: "integer" } },
              parent: { type: ["string", "null"] },
              clauseKind: { type: "string", enum: [...CLAUSE_KINDS, "none"] },
              joins: { type: "string", enum: [...JOINABLE_ROLES, "none"] },
              modifies: { type: "string", enum: [...JOINABLE_ROLES, "none"] },
              implied: { type: "boolean" },
            },
          },
        },
      },
    },
  };
}

/** The model's wire format: every field present, with "none"/false standing in for "not set". */
type WireNode = Omit<DiagramNode, "clauseKind" | "joins" | "modifies" | "implied"> & {
  clauseKind: string;
  joins: string;
  modifies: string;
  implied: boolean;
};

export function toWire(node: DiagramNode): WireNode {
  return {
    ...node,
    clauseKind: node.clauseKind ?? "none",
    joins: node.joins ?? "none",
    modifies: node.modifies ?? "none",
    implied: Boolean(node.implied),
  };
}

function exampleJson(sentence: string, nodes: DiagramNode[]): string {
  const words = tokenize(sentence).map((t) => t.text);
  return JSON.stringify({ words, nodes: nodes.map(toWire) });
}

const ROLE_RULES = [
  `- "clause": a baseline. Exactly one has clauseKind "main" and parent null. A second independent clause has clauseKind "coordinate" and parent null. A dependent (adverb) clause has clauseKind "subordinate" and its parent is the id of the main-clause VERB node it tells about. Clauses have words [].`,
  `- "subject" and "verb": parent is their clause id.`,
  `- "direct-object", "indirect-object", "predicate-adjective", "predicate-nominative": parent is the clause when there is one verb, or when every verb shares them. When each verb in a compound predicate has its own, parent is that verb's id. Never mix shared and per-verb objects in one clause.`,
  `- "modifier" (${ROLE_NAMES.modifier}): an article (a, an, the), adjective, or adverb. Parent is the word node it describes, including another modifier (for example "very" describing "big"). A word that describes every part of a compound instead parents to the clause or verb that owns those parts, and modifies is that role ("direct-object", "subject", ...).`,
  `- "preposition": parent is the word node the phrase describes. "prep-object": parent is its preposition. Modifiers of the object hang from the prep-object node.`,
  `- "conjunction": parent is the same node as the parts it joins, and joins is that role ("subject", "verb", "direct-object"...). For a compound sentence, parent is the coordinate clause and joins is "clause".`,
  `- "subordinator": the subordinating conjunction (because, when...). Parent is the subordinate clause.`,
  `- A command's understood subject is a "subject" node with implied true and words [].`,
  `- Only a verb node may hold more than one word (a helping verb plus main verb, like "is singing" or "Did ... sing"). Every other node holds exactly one word.`,
  `- Set clauseKind "none" on non-clause nodes, joins "none" on non-conjunction nodes, modifies "none" unless the modifier describes a whole compound, and implied false unless it is the understood "you".`,
];

export function diagramMessages(opts: {
  chapter: DiagramChapter;
  topic: string;
  gradeLevel: number;
  avoid: string[];
  pattern?: SentencePattern | null;
  previousError?: string;
}): ChatMessage[] {
  const { chapter, topic, gradeLevel, avoid, pattern, previousError } = opts;
  const samples = matchingExamples(chapter, pattern ?? null);

  const system = [
    "You write practice sentences for a children's homeschool grammar app and produce a precise Reed-Kellogg sentence diagram as the answer key.",
    "Grammar must follow standard US elementary and middle school Reed-Kellogg diagramming conventions.",
    "Content must be friendly, accurate, and appropriate for children. No violence, scary content, or brand names.",
    'Respond with JSON only: {"words": string[], "nodes": [...]}.',
    '"words" is the sentence split into tokens in order: every word is one entry, and every punctuation mark (comma, period, question mark, exclamation point) is its own entry.',
    'Each node\'s "words" lists 0-based indices into YOUR words array. Every word (not punctuation) must appear in exactly one node.',
    "",
    "Node roles:",
    ...ROLE_RULES,
  ].join("\n");

  const examples = samples.examples.map((e) => `Sentence: ${e.sentence}\n${exampleJson(e.sentence, e.nodes)}`).join("\n\n");

  const user = [
    `Topic: ${topic}`,
    `Student level: ${gradeLabel(gradeLevel)}. ${gradeGuidance(gradeLevel)} Keep it simple enough to diagram: at most about 12 words.`,
    `Chapter: ${chapter.title}. ${chapter.summary}`,
    "Write ONE sentence about the topic and diagram it.",
    "",
    "Rules for this chapter:",
    ...chapter.generationRules.map((r) => `- ${r}`),
    ...shapeLines(pattern ?? null),
    "- Avoid contractions, possessives, gerunds, infinitives, relative clauses (who, which, that), appositives, interjections, 'please', and sentences starting with 'There' or 'Here'.",
    "- Avoid multi-word names and words that could reasonably be diagrammed more than one way.",
    "",
    samples.formatOnly
      ? "The example below shows the JSON format only. Do not copy its sentence shape. Follow the sentence shape required above."
      : "Examples of the exact format:",
    examples,
    avoid.length ? `\nDo not reuse or closely copy any of these recent sentences:\n${avoid.map((s) => `- ${s}`).join("\n")}` : "",
    previousError ? `\nYour previous answer was rejected: ${previousError} Please fix this.` : "",
  ].join("\n");

  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

export function diagramHelperPrompt(opts: {
  chapter: DiagramChapter;
  tokens: Token[];
  nodes: DiagramNode[];
  gradeLevel: number;
  studentName: string;
  focus?: string;
  answerRevealed: boolean;
  /** Outline of the diagram the student has built. Omitted when no draft was sent. */
  studentLines?: string[];
}): string {
  const { chapter, tokens, nodes, gradeLevel, studentName, focus, answerRevealed, studentLines } = opts;
  const focusName = focus && focus in ROLE_NAMES ? ROLE_NAMES[focus as keyof typeof ROLE_NAMES] : undefined;
  const work = studentLines ?? [];
  const seesWork = work.length > 0;

  return [
    `You are Professor Hoot, a warm, patient grammar tutor helping ${studentName}, a ${gradeLabel(gradeLevel)} student, in a homeschool app.`,
    `They are diagramming sentences with the Reed-Kellogg method. This chapter is "${chapter.title}": ${chapter.summary}`,
    `The practice sentence is: "${detokenize(tokens)}"`,
    "In the app, the student picks diagram parts (baseline, modifier slant line, prepositional phrase, direct object, fork, and so on) from a list and drags words onto the lines. They never draw freehand.",
    !seesWork && focusName ? `Right now they have the ${focusName} selected.` : "",
    "",
    answerRevealed
      ? "Correct diagram (the student has already been shown the answer, so you may now explain it fully):"
      : "Correct diagram (SECRET — never reveal it directly):",
    ...describeDiagram(tokens, nodes).map((l) => `- ${l}`),
    "",
    ...(seesWork ? ["The student's diagram right now:", ...work.map((l) => `- ${l}`), ""] : []),
    "How to help:",
    "- Teach the steps: find the verb first ('What is happening?'), then the subject ('Who or what is doing it?'), then objects ('Whom or what did they ___?'), then the describing words and phrases.",
    "- Explain where each kind of word goes: subject and verb on the baseline split by a line that crosses it; a direct object after a short line that stops at the baseline; a predicate word after a line that slants back toward the subject; modifiers on slanted lines under the word they describe; a preposition on a slant with its object on a line below; an indirect object below the verb. When verbs share an object, their lines meet before it. When each verb has its own object, that object stays on that verb's line. A word that describes a whole compound sits on the stem before the split.",
    "- Ask one guiding question at a time and let the student think.",
    ...(seesWork
      ? [
          '- Use the correct diagram to judge, and the student\'s diagram to talk about their work. Name words they have already placed and lines that are still empty. "_" means the line is drawn with nothing on it.',
          "- Do not invent a placement that is not in the student's diagram.",
          ...(answerRevealed
            ? []
            : ["- A word on the wrong line may be called out as wrong. Do not read the correct diagram back or say which line that word belongs on."]),
          "- If the page is blank, start from the first step (find the verb) instead of commenting on placements.",
        ]
      : []),
    "- Never list the answer or say exactly where each word goes. You may point to a region of the sentence after they have tried.",
    "- If they share a guess, tell them kindly whether they're on the right track and why, without giving away the rest.",
    "- You may use a DIFFERENT example sentence to demonstrate a rule.",
    `- Use short sentences and words a ${gradeLabel(gradeLevel)} student understands. Keep replies under 80 words.`,
    "- Stay on grammar and this sentence. If asked about something else, gently steer back.",
    "- Be encouraging. Never make the student feel bad for being confused.",
  ]
    .filter(Boolean)
    .join("\n");
}
