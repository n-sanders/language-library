import { BOOKS } from "../src/content/books";
import { DIAGRAMMING_BOOK } from "../src/content/diagramBook";
import { hasPatternChecker, patternFor, patternMismatch } from "../src/lib/patterns";
import { tokenize } from "../src/lib/tokenize";
import { layoutDiagram, slotWidth } from "../src/lib/diagram/layout";
import { skeletonFor } from "../src/lib/diagram/skeleton";
import { applyElement, availableElements } from "../src/lib/diagram/draft";
import { stockDiagram } from "../src/lib/diagram/stock";
import { validateDiagram } from "../src/lib/diagram/validate";
import type { DiagramNode, DraftNode } from "../src/lib/diagram/types";

const chapter = DIAGRAMMING_BOOK.chapters.find((item) => item.slug === "compound-predicates");
if (!chapter || chapter.kind !== "diagram") throw new Error("missing chapter");

for (const bookChapter of DIAGRAMMING_BOOK.chapters) {
  if (bookChapter.kind !== "diagram") continue;
  for (const example of bookChapter.examples) {
    validateDiagram(bookChapter, tokenize(example.sentence), example.nodes);
  }
}

function layoutOf(sentence: string, nodes: DiagramNode[]) {
  const tokens = tokenize(sentence);
  const text = (node: DraftNode) => node.words.map((i) => tokens[i]?.text ?? "").filter(Boolean);
  return {
    tokens,
    layout: layoutDiagram(nodes, (node) => slotWidth(text(node))),
  };
}

function slotByWord(sentence: string, nodes: DiagramNode[], word: string) {
  const { tokens, layout } = layoutOf(sentence, nodes);
  const index = tokens.findIndex((token) => token.text === word);
  const node = nodes.find((item) => item.words.includes(index));
  const slot = layout.slots.find((item) => item.nodeId === node?.id);
  if (!slot || !node) throw new Error(`no slot for ${word}`);
  return { slot, node, layout, tokens };
}

const [jake, washed, mixed] = chapter.examples;

{
  const laughed = slotByWord(jake.sentence, jake.nodes, "laughed");
  const clapped = slotByWord(jake.sentence, jake.nodes, "clapped");
  const emma = slotByWord(jake.sentence, jake.nodes, "Emma");
  const jakeSlot = slotByWord(jake.sentence, jake.nodes, "Jake");
  if (Math.abs(laughed.slot.y - clapped.slot.y) < 20) throw new Error("verb fork did not split");
  if (Math.abs(jakeSlot.slot.y - emma.slot.y) < 20) throw new Error("subject fork did not split");
  const rightOf = (word: string) => {
    const found = slotByWord(jake.sentence, jake.nodes, word);
    return found.slot.x + found.slot.w;
  };
  const maxVerbX = Math.max(rightOf("laughed"), rightOf("clapped"));
  const closing = laughed.layout.segs.filter((seg) => seg.x2 > maxVerbX - 8 && Math.abs(seg.y1 - seg.y2) > 20);
  if (closing.length) throw new Error("verb fork closed even though nothing follows");
  const subjectClose = jakeSlot.layout.segs.some(
    (seg) => seg.x1 > emma.slot.x && seg.x2 > emma.slot.x && Math.abs(seg.y1 - seg.y2) > 20 && seg.x2 > seg.x1,
  );
  if (!subjectClose) throw new Error("subject fork did not meet again");
}

{
  const pots = slotByWord(washed.sentence, washed.nodes, "pots");
  const pans = slotByWord(washed.sentence, washed.nodes, "pans");
  const the = slotByWord(washed.sentence, washed.nodes, "the");
  const dried = slotByWord(washed.sentence, washed.nodes, "dried");
  if (Math.abs(pots.slot.y - pans.slot.y) < 20) throw new Error("object fork did not split");
  if (the.slot.x > pots.slot.x) throw new Error("'the' is not on the stem before the object fork");
  const verbClose = dried.layout.segs.some((seg) => seg.x1 > dried.slot.x && seg.x2 > dried.slot.x && Math.abs(seg.y1 - seg.y2) > 20);
  if (!verbClose) throw new Error("shared verb fork did not meet before the object");
}

{
  const dough = slotByWord(mixed.sentence, mixed.nodes, "dough");
  const it = slotByWord(mixed.sentence, mixed.nodes, "it");
  const waited = slotByWord(mixed.sentence, mixed.nodes, "waited");
  const mixedSlot = slotByWord(mixed.sentence, mixed.nodes, "mixed");
  const put = slotByWord(mixed.sentence, mixed.nodes, "put");
  if (dough.slot.x < mixedSlot.slot.x || Math.abs(dough.slot.y - mixedSlot.slot.y) > 8) {
    throw new Error("dough is not on mixed's line");
  }
  if (it.slot.x < put.slot.x || Math.abs(it.slot.y - put.slot.y) > 8) throw new Error("it is not on put's line");
  if (new Set([mixedSlot.slot.y, put.slot.y, waited.slot.y]).size < 3) throw new Error("the three verbs are not on separate lines");
  const oven = slotByWord(mixed.sentence, mixed.nodes, "oven");
  if (oven.slot.y <= put.slot.y) throw new Error("the oven phrase does not hang under put");
}

{
  const skeleton = skeletonFor("supported", mixed.nodes);
  const roles = skeleton.map((node) => `${node.role}:${node.parent}`);
  if (!roles.includes("subject:c") || !roles.includes("verb:c") || !roles.includes("direct-object:v1")) {
    throw new Error(`supported skeleton was ${roles.join(", ")}`);
  }
  if (skeleton.some((node) => node.role === "conjunction" || node.role === "preposition")) {
    throw new Error("supported skeleton included a fork or phrase");
  }
}

{
  const skeleton = skeletonFor("supported", mixed.nodes);
  const verb = skeleton.find((node) => node.role === "verb");
  const buttons = availableElements(skeleton, verb!.id, chapter.features, "supported").map((item) => item.label);
  if (!buttons.includes("Compound verb, share the object") || !buttons.includes("Compound verb, this verb keeps its line")) {
    throw new Error(`supported verb buttons were ${buttons.join(" | ")}`);
  }
  const kept = applyElement(skeleton, verb!.id, "compound-keep");
  const dough = kept.nodes.find((node) => node.words.length === 0 && node.role === "direct-object");
  if (dough?.parent !== verb!.id) throw new Error("keeping the line moved the object off the first verb");
  const added = kept.nodes.filter((node) => node.role === "verb");
  if (added.length !== 2) throw new Error("compound-keep did not add a second verb");
  const bare = added.find((node) => node.id !== verb!.id);
  const onBare = applyElement(kept.nodes, bare!.id, "direct-object");
  const secondObject = onBare.nodes.find((node) => node.role === "direct-object" && node.parent === bare!.id);
  if (!secondObject) throw new Error("the new verb did not receive its own object");
  const phrase = applyElement(onBare.nodes, bare!.id, "prepositional-phrase");
  if (!phrase.nodes.some((node) => node.role === "preposition" && node.parent === bare!.id)) {
    throw new Error("the prepositional phrase was not hung on the selected verb");
  }
}

{
  const base = skeletonFor("independent", mixed.nodes);
  const started = applyElement(base, null, "baseline").nodes;
  const verb = started.find((node) => node.role === "verb");
  const forked = applyElement(started, verb!.id, "compound");
  const again = applyElement(forked.nodes, verb!.id, "compound");
  const buttons = availableElements(again.nodes, verb!.id, chapter.features, "independent").map((item) => item.id);
  if (!buttons.includes("direct-object") || !buttons.includes("shared-direct-object")) {
    throw new Error(`open fork buttons were ${buttons.join(", ")}`);
  }
  const withObject = applyElement(again.nodes, verb!.id, "direct-object");
  const object = withObject.nodes.find((node) => node.role === "direct-object");
  if (object?.parent !== verb!.id) throw new Error("direct object was not attached to the selected verb");
}

{
  const first = stockDiagram(chapter, []);
  const second = stockDiagram(chapter, [first.sentence]);
  const third = stockDiagram(chapter, [first.sentence, second.sentence]);
  const fourth = stockDiagram(chapter, [first.sentence, second.sentence, third.sentence]);
  const sentences = [first, second, third].map((item) => item.sentence);
  if (new Set(sentences).size !== 3) throw new Error(`stock did not cycle unique samples: ${sentences.join(" | ")}`);
  if (fourth.sentence !== first.sentence) throw new Error("stock did not start over");
  if (first.model !== "stock") throw new Error("stock model name missing");
}

{
  const simple = DIAGRAMMING_BOOK.chapters[0];
  if (simple.kind !== "diagram") throw new Error("first chapter is not a diagram");
  const example = simple.examples[0];
  const bird = slotByWord(example.sentence, example.nodes, "bird");
  const sings = slotByWord(example.sentence, example.nodes, "sings");
  if (Math.abs(bird.slot.y - sings.slot.y) > 2) throw new Error("a simple subject and verb are not on one line");
}

for (const book of BOOKS) {
  for (const bookChapter of book.chapters) {
    for (const pattern of bookChapter.patterns ?? []) {
      if (!hasPatternChecker(bookChapter.slug, pattern.id)) {
        throw new Error(`no checker for ${bookChapter.slug}/${pattern.id}`);
      }
    }
    if (bookChapter.kind !== "diagram") continue;
    for (const example of bookChapter.examples) {
      const tokens = tokenize(example.sentence);
      const hits = (bookChapter.patterns ?? []).filter(
        (pattern) => patternMismatch(bookChapter, pattern, tokens, { nodes: example.nodes }) === null,
      );
      if (hits.length !== 1) {
        const names = hits.map((hit) => hit.id).join(", ") || "nothing";
        throw new Error(`${bookChapter.slug} "${example.sentence}" matched ${names}`);
      }
    }
  }
}

const subject = BOOKS.flatMap((book) => book.chapters).find((bookChapter) => bookChapter.slug === "subject");
if (!subject) throw new Error("missing subject chapter");
const patternId = (grade: number, step: number) => patternFor(subject, grade, step)?.id;
const grade5 = [0, 1, 2, 3].map((step) => patternId(5, step));
if (grade5.join(",") !== "article-adjective,adjective-noun,subject-phrase,article-adjective") {
  throw new Error(`grade 5 rotation was ${grade5.join(",")}`);
}
const grade6 = [0, 1, 2, 3, 4].map((step) => patternId(6, step));
if (grade6.join(",") !== "article-adjective,adjective-noun,subject-phrase,compound-subject,article-adjective") {
  throw new Error(`grade 6 rotation was ${grade6.join(",")}`);
}

console.log("compound diagram checks passed");
