import { COMPLEMENT_ROLES, DiagramIndex, inSentenceOrder } from "./tree";
import type { DiagramNode, DraftNode, JoinableRole } from "./types";

export type Seg = { x1: number; y1: number; x2: number; y2: number; dashed?: boolean };

/** A drop target. (x, y) is its bottom-left corner on the line; it is rotated `angle` degrees about that corner. */
export type Slot = { nodeId: string; x: number; y: number; w: number; angle: number };

export type DiagramLayout = { segs: Seg[]; slots: Slot[]; width: number; height: number };

export const WORD_H = 28;
const SLANT_DEG = 60;
const COS = Math.cos((SLANT_DEG * Math.PI) / 180);
const SIN = Math.sin((SLANT_DEG * Math.PI) / 180);
const CHAR_W = 9;
const EMPTY_W = 84;
const GAP = 14;
/** Distance along a slant before its word starts, so the word doesn't cross the line it hangs from. */
const SLANT_INSET = 18;
const PAD = 24;

/** Width a slot needs for the given words (rendered as chips). */
export function slotWidth(texts: string[]): number {
  if (texts.length === 0) return EMPTY_W;
  return Math.max(EMPTY_W, texts.reduce((sum, t) => sum + t.length * CHAR_W + 22, 0) + 8);
}

type Ext = { right: number; bottom: number; top: number };
type Pos = { x: number; y: number };

type Ctx = {
  index: DiagramIndex<DraftNode>;
  widthOf: (node: DraftNode) => number;
  /** Indirect objects hang from their clause's first verb. */
  ioFor: Map<string, DraftNode[]>;
  /** Verbs that a clause connector starts from get extra room before their modifiers. */
  connectorVerbs: Set<string>;
  segs: Seg[];
  slots: Slot[];
  pos: Map<string, Pos>;
  depth: number;
};

const scratch = (ctx: Ctx): Ctx => ({ ...ctx, segs: [], slots: [], pos: new Map() });

function seg(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, dashed = false) {
  ctx.segs.push({ x1, y1, x2, y2, dashed });
}

function slot(ctx: Ctx, nodeId: string, x: number, y: number, w: number, angle: number) {
  ctx.slots.push({ nodeId, x, y, w: Math.max(w, 24), angle });
}

const guard = (ctx: Ctx) => ctx.depth < 40;

function layoutHead(ctx: Ctx, head: DraftNode, x: number, y: number, opts: { minW?: number; drawLine: boolean; lead?: number; inset?: number }) {
  ctx.pos.set(head.id, { x, y });
  const tw = ctx.widthOf(head);
  const inset = opts.inset ?? 4;
  let cx = x + inset + (opts.lead ?? 12);
  let right = x + inset + tw;
  let bottom = y;
  let lastStart = x;

  const hanging = [...(ctx.ioFor.get(head.id) ?? []), ...inSentenceOrder(ctx.index.children(head.id, "modifier", "preposition"))];
  if (guard(ctx)) {
    ctx.depth++;
    for (const child of hanging) {
      const r =
        child.role === "modifier"
          ? layoutSlant(ctx, child, cx, y)
          : child.role === "indirect-object"
            ? layoutIndirect(ctx, child, cx, y)
            : layoutPrep(ctx, child, cx, y);
      lastStart = cx;
      right = Math.max(right, r.right);
      bottom = Math.max(bottom, r.bottom);
      cx = r.right + GAP;
    }
    ctx.depth--;
  }

  const lineEnd = Math.max(x + inset + tw, x + (opts.minW ?? 0), lastStart + 28);
  if (opts.drawLine) seg(ctx, x, y, lineEnd, y);
  slot(ctx, head.id, x + inset, y, tw - 4, 0);
  return { right: Math.max(right, lineEnd), bottom, top: y - WORD_H, lineEnd };
}

function layoutSlant(ctx: Ctx, mod: DraftNode, sx: number, sy: number): Ext {
  const tw = ctx.widthOf(mod);
  const subs = inSentenceOrder(ctx.index.children(mod.id, "modifier"));
  const base = tw + SLANT_INSET + 8;
  const len = base + subs.length * 40;
  const ex = sx + len * COS;
  const ey = sy + len * SIN;
  seg(ctx, sx, sy, ex, ey);
  slot(ctx, mod.id, sx + SLANT_INSET * COS, sy + SLANT_INSET * SIN, tw, SLANT_DEG);

  let right = ex;
  let bottom = ey;
  if (guard(ctx)) {
    ctx.depth++;
    subs.forEach((sub, i) => {
      const d = base + 8 + i * 40;
      const px = sx + d * COS;
      const py = sy + d * SIN;
      seg(ctx, px, py, px + 18, py);
      const r = layoutSlant(ctx, sub, px + 18, py);
      right = Math.max(right, r.right);
      bottom = Math.max(bottom, r.bottom);
    });
    ctx.depth--;
  }
  return { right, bottom, top: sy };
}

function layoutPrep(ctx: Ctx, prep: DraftNode, sx: number, sy: number): Ext {
  const tw = ctx.widthOf(prep);
  const len = Math.max(tw + SLANT_INSET + 12, 70);
  const ex = sx + len * COS;
  const ey = sy + len * SIN;
  seg(ctx, sx, sy, ex, ey);
  slot(ctx, prep.id, sx + SLANT_INSET * COS, sy + SLANT_INSET * SIN, tw, SLANT_DEG);

  const [object] = ctx.index.children(prep.id, "prep-object");
  if (!object || !guard(ctx)) {
    seg(ctx, ex, ey, ex + EMPTY_W, ey);
    return { right: ex + EMPTY_W, bottom: ey, top: sy };
  }
  ctx.depth++;
  const r = layoutHead(ctx, object, ex, ey, { drawLine: true, inset: 18 });
  ctx.depth--;
  return { right: Math.max(ex, r.right), bottom: Math.max(ey, r.bottom), top: sy };
}

function layoutIndirect(ctx: Ctx, io: DraftNode, sx: number, sy: number): Ext {
  const len = 60;
  const ex = sx + len * COS;
  const ey = sy + len * SIN;
  seg(ctx, sx, sy, ex, ey);
  ctx.depth++;
  const r = layoutHead(ctx, io, ex, ey, { drawLine: true, inset: 18 });
  ctx.depth--;
  return { right: Math.max(ex, r.right), bottom: Math.max(ey, r.bottom), top: sy };
}

type Placed = Ext & { lineEnd: number };

/** Modifiers that describe every member of a compound owned by `parentId`. */
function sharedMods(ctx: Ctx, parentId: string, role: JoinableRole): DraftNode[] {
  return inSentenceOrder(ctx.index.children(parentId, "modifier").filter((m) => m.modifies === role));
}

/** Slant modifiers down from a baseline stem. Returns the stem's far end. */
function layoutStemMods(ctx: Ctx, mods: DraftNode[], x: number, y: number): Placed {
  if (mods.length === 0) return { right: x, bottom: y, top: y - WORD_H, lineEnd: x };
  let cx = x + 12;
  let right = x;
  let bottom = y;
  if (guard(ctx)) {
    ctx.depth++;
    for (const mod of mods) {
      const r = layoutSlant(ctx, mod, cx, y);
      right = Math.max(right, r.right);
      bottom = Math.max(bottom, r.bottom);
      cx = r.right + GAP;
    }
    ctx.depth--;
  }
  const lineEnd = Math.max(right, cx);
  seg(ctx, x, y, lineEnd, y);
  return { right: lineEnd, bottom, top: y - WORD_H, lineEnd };
}

/** Indirect objects hanging from a single stem after a closed verb fork. */
function layoutStemIndirects(ctx: Ctx, ios: DraftNode[], x: number, y: number): Placed {
  let cx = x + 18;
  let right = x;
  let bottom = y;
  if (guard(ctx)) {
    ctx.depth++;
    for (const io of ios) {
      const r = layoutIndirect(ctx, io, cx, y);
      right = Math.max(right, r.right);
      bottom = Math.max(bottom, r.bottom);
      cx = r.right + GAP;
    }
    ctx.depth--;
  }
  const lineEnd = Math.max(right, cx);
  seg(ctx, x, y, lineEnd, y);
  return { right: lineEnd, bottom, top: y - WORD_H, lineEnd };
}

/** Complements that belong to one clause or one verb, drawn to the right of `x`. */
function layoutComplementRun(ctx: Ctx, ownerId: string, x: number, y: number): Placed {
  let cur = x;
  let bottom = y;
  let top = y - WORD_H;
  for (const role of COMPLEMENT_ROLES) {
    const items = inSentenceOrder(ctx.index.children(ownerId, role));
    if (items.length === 0) continue;
    let start = cur;
    if (role === "direct-object") {
      seg(ctx, cur, y - 34, cur, y);
    } else {
      seg(ctx, cur, y - 34, cur + 16, y);
      seg(ctx, cur, y, cur + 16, y);
      start = cur + 16;
    }
    const stem = layoutStemMods(ctx, sharedMods(ctx, ownerId, role), start, y);
    bottom = Math.max(bottom, stem.bottom);
    top = Math.min(top, stem.top);
    const group = layoutGroup(ctx, items, stem.lineEnd, y, {
      rightTines: false,
      conj: ctx.index.conjunction(ownerId, role),
    });
    bottom = Math.max(bottom, group.bottom);
    top = Math.min(top, group.top);
    cur = group.right;
  }
  return { right: cur, bottom, top, lineEnd: cur };
}

function layoutOne(
  ctx: Ctx,
  member: DraftNode,
  x: number,
  y: number,
  opts: { drawLine: boolean; lead?: number; minW?: number; withComplements?: boolean },
): Placed {
  const head = layoutHead(ctx, member, x, y, { drawLine: opts.drawLine, lead: opts.lead, minW: opts.minW });
  if (!opts.withComplements) return head;
  const rest = layoutComplementRun(ctx, member.id, head.lineEnd, y);
  return {
    right: Math.max(head.right, rest.right),
    bottom: Math.max(head.bottom, rest.bottom),
    top: Math.min(head.top, rest.top),
    lineEnd: Math.max(head.lineEnd, rest.lineEnd),
  };
}

/**
 * One baseline position: a single word, or a fork for a compound part.
 * A closed fork (`rightTines`) meets again on the right. An open fork stays split.
 * The conjunction sits on the horizontal tines beside the hinge: before the words when
 * the lines meet on the left, and after the words when they meet on the right.
 */
function layoutGroup(
  ctx: Ctx,
  members: DraftNode[],
  x: number,
  y: number,
  opts: { rightTines: boolean; conj?: DraftNode; withComplements?: boolean },
): Ext {
  if (members.length === 0) return { right: x + 12, bottom: y, top: y - WORD_H };

  const leadFor = (m: DraftNode) => (ctx.connectorVerbs.has(m.id) ? 44 : 12);

  if (members.length === 1) {
    const r = layoutOne(ctx, members[0], x, y, { drawLine: false, lead: leadFor(members[0]), withComplements: opts.withComplements });
    const right = opts.withComplements ? Math.max(r.lineEnd, r.right) : r.right + 10;
    seg(ctx, x, y, right, y);
    return { right, bottom: r.bottom, top: r.top };
  }

  const measured = members.map((m) => {
    const r = layoutOne(scratch(ctx), m, 0, 0, { drawLine: true, lead: leadFor(m), withComplements: opts.withComplements });
    return { w: r.lineEnd, depth: r.bottom };
  });
  const ys = [0];
  for (let i = 1; i < members.length; i++) ys.push(ys[i - 1] + measured[i - 1].depth + WORD_H + 40);
  const span = ys[ys.length - 1] - ys[0];
  const bw = opts.rightTines ? Math.max(...measured.map((s) => s.w)) : 0;
  const conjW = opts.conj ? Math.min(ctx.widthOf(opts.conj), 72) : 0;
  // Keep the split from turning into a hairline when a tine has a tall phrase hanging under it.
  const forkIn = Math.max(56, Math.round(span * 0.42));
  const leftGap = opts.conj && !opts.rightTines ? conjW + 22 : 0;
  const rightGap = opts.conj && opts.rightTines ? conjW + 22 : 0;
  const forkOut = opts.rightTines ? Math.max(40, Math.round(span * 0.16)) : 0;
  const wordX = x + forkIn + leftGap;
  const shift = y - (ys[0] + ys[ys.length - 1]) / 2;
  const rows = ys.map((v) => v + shift);

  let bottom = y;
  let right = x;
  members.forEach((m, i) => {
    const by = rows[i];
    seg(ctx, x, y, x + forkIn, by);
    if (leftGap) seg(ctx, x + forkIn, by, wordX, by);
    const r = layoutOne(ctx, m, wordX, by, {
      drawLine: true,
      lead: leadFor(m),
      minW: opts.rightTines ? bw : undefined,
      withComplements: opts.withComplements,
    });
    if (opts.rightTines) {
      const joinAt = wordX + bw + rightGap;
      const tipX = joinAt + forkOut;
      if (r.lineEnd < joinAt) seg(ctx, r.lineEnd, by, joinAt, by);
      seg(ctx, joinAt, by, tipX, y);
      right = tipX;
    } else {
      right = Math.max(right, r.right, r.lineEnd);
    }
    bottom = Math.max(bottom, r.bottom);
  });

  if (opts.conj) {
    const gapStart = opts.rightTines ? wordX + bw : x + forkIn;
    const cx = gapStart + conjW + 12;
    const mid = (rows[0] + rows[1]) / 2 + WORD_H / 2;
    seg(ctx, cx, rows[0], cx, rows[rows.length - 1], true);
    slot(ctx, opts.conj.id, gapStart + 8, mid, conjW, 0);
  }

  return { right, bottom, top: rows[0] - WORD_H };
}

function layoutClause(ctx: Ctx, clause: DraftNode, x: number, y: number): Ext {
  const { index } = ctx;
  const parts = (role: DiagramNode["role"]) => inSentenceOrder(index.children(clause.id, role));
  const conj = (role: JoinableRole) => index.conjunction(clause.id, role);

  const subjects = parts("subject");
  const verbs = parts("verb");
  let top = y - WORD_H;
  let bottom = y;
  const track = (e: Ext) => {
    top = Math.min(top, e.top);
    bottom = Math.max(bottom, e.bottom);
  };

  const s = layoutGroup(ctx, subjects, x, y, { rightTines: subjects.length > 1, conj: conj("subject") });
  track(s);
  let cur = s.right;
  const subjectStem = layoutStemMods(ctx, sharedMods(ctx, clause.id, "subject"), cur, y);
  track(subjectStem);
  cur = subjectStem.lineEnd;

  seg(ctx, cur, y - 34, cur, y + 24);

  const clauseIos = inSentenceOrder(index.children(clause.id, "indirect-object"));
  const sharedFollows =
    verbs.length > 1 && (clauseIos.length > 0 || COMPLEMENT_ROLES.some((role) => index.children(clause.id, role).length > 0));
  const perVerb = verbs.some((verb) => COMPLEMENT_ROLES.some((role) => index.children(verb.id, role).length > 0));

  if (!sharedFollows) {
    const verbStem = layoutStemMods(ctx, sharedMods(ctx, clause.id, "verb"), cur, y);
    track(verbStem);
    cur = verbStem.lineEnd;
  }

  const v = layoutGroup(ctx, verbs, cur, y, {
    rightTines: sharedFollows,
    conj: conj("verb"),
    withComplements: !sharedFollows && (perVerb || verbs.length > 1),
  });
  track(v);
  cur = v.right;

  if (sharedFollows) {
    const verbStem = layoutStemMods(ctx, sharedMods(ctx, clause.id, "verb"), cur, y);
    track(verbStem);
    cur = verbStem.lineEnd;
    if (clauseIos.length) {
      const hung = layoutStemIndirects(ctx, clauseIos, cur, y);
      track(hung);
      cur = hung.lineEnd;
    }
  }

  if (sharedFollows) {
    seg(ctx, cur, y, cur + 36, y);
    cur += 36;
  }
  const comps = layoutComplementRun(ctx, clause.id, cur, y);
  track(comps);
  return { right: comps.right, bottom, top };
}

/** How far right of a clause's start its connector should land: just past the first verb's word. */
function verbLanding(ctx: Ctx, clause: DraftNode, verb: DraftNode | undefined): number {
  if (!verb) return 0;
  const trial = scratch(ctx);
  layoutClause(trial, clause, 0, 0);
  return (trial.pos.get(verb.id)?.x ?? 0) + ctx.widthOf(verb) + 2;
}

/** Lays out a whole Reed-Kellogg diagram. `widthOf` gives each slot's width for the words in it. */
export function layoutDiagram(nodes: DraftNode[], widthOf: (node: DraftNode) => number): DiagramLayout {
  const index = new DiagramIndex(nodes);
  const main = index.mainClause();
  if (!main) return { segs: [], slots: [], width: 0, height: 0 };

  const ioFor = new Map<string, DraftNode[]>();
  for (const clause of nodes.filter((n) => n.role === "clause")) {
    const verbs = inSentenceOrder(index.children(clause.id, "verb"));
    const clauseIos = inSentenceOrder(index.children(clause.id, "indirect-object"));
    const shared =
      verbs.length > 1 &&
      (clauseIos.length > 0 || COMPLEMENT_ROLES.some((role) => index.children(clause.id, role).length > 0));
    // A shared indirect object hangs from the stem after the verb lines meet. One verb keeps it underneath.
    if (!shared && verbs[0] && clauseIos.length) ioFor.set(verbs[0].id, clauseIos);
    for (const verb of verbs) {
      const own = inSentenceOrder(index.children(verb.id, "indirect-object"));
      if (own.length) ioFor.set(verb.id, [...(ioFor.get(verb.id) ?? []), ...own]);
    }
  }

  const sub = index.subordinateClause();
  const coord = index.coordinateClause();
  const [mainVerb] = inSentenceOrder(index.children(main.id, "verb"));
  const connectorVerbs = new Set<string>();
  if (sub?.parent) connectorVerbs.add(sub.parent);
  if (coord && mainVerb) connectorVerbs.add(mainVerb.id);

  const ctx: Ctx = { index, widthOf, ioFor, connectorVerbs, segs: [], slots: [], pos: new Map(), depth: 0 };
  const m = layoutClause(ctx, main, 40, 0);
  let bottom = m.bottom;

  if (sub) {
    const host = ctx.pos.get(sub.parent ?? "") ?? (mainVerb ? ctx.pos.get(mainVerb.id) : undefined);
    if (host) {
      const y2 = bottom + 100;
      const from = { x: host.x + 22, y: host.y };
      const [subVerb] = inSentenceOrder(index.children(sub.id, "verb"));
      // Land just past the dependent verb's word, with a steep line that stays clear of the main verb's modifiers.
      const landOffset = verbLanding(ctx, sub, subVerb);
      const landX = from.x + (y2 - from.y) * 0.4;
      const c = layoutClause(ctx, sub, landX - landOffset, y2);
      const to = (subVerb && ctx.pos.get(subVerb.id)) ?? { x: landX, y: y2 };
      const end = { x: to.x + (subVerb ? ctx.widthOf(subVerb) + 2 : 0), y: to.y };
      seg(ctx, from.x, from.y, end.x, end.y, true);
      const [subordinator] = index.children(sub.id, "subordinator");
      if (subordinator) {
        const angle = (Math.atan2(end.y - from.y, end.x - from.x) * 180) / Math.PI;
        const rad = (angle * Math.PI) / 180;
        const len = Math.hypot(end.x - from.x, end.y - from.y);
        const d = Math.min(SLANT_INSET + 6, len * 0.2);
        slot(ctx, subordinator.id, from.x + d * Math.cos(rad), from.y + d * Math.sin(rad), widthOf(subordinator), angle);
      }
      bottom = c.bottom;
    }
  }

  if (coord && mainVerb) {
    const from = ctx.pos.get(mainVerb.id);
    if (from) {
      const y2 = bottom + 120;
      const vx = from.x + 22;
      const ym = bottom + 56;
      const [conjunction] = index.children(coord.id, "conjunction").filter((k) => k.joins === "clause");
      const stepW = Math.max(conjunction ? widthOf(conjunction) + 12 : 0, 72);
      const [coordVerb] = inSentenceOrder(index.children(coord.id, "verb"));
      // Place the second clause so the step's dashed line drops straight onto its verb line, past the verb's word.
      const c = layoutClause(ctx, coord, vx + stepW - verbLanding(ctx, coord, coordVerb), y2);
      const to = (coordVerb && ctx.pos.get(coordVerb.id)) ?? { x: vx + stepW, y: y2 };
      const landX = Math.max(vx + stepW, to.x + (coordVerb ? ctx.widthOf(coordVerb) + 2 : 0));
      seg(ctx, vx, from.y, vx, ym, true);
      seg(ctx, vx, ym, vx + stepW, ym);
      if (conjunction) slot(ctx, conjunction.id, vx + 6, ym, stepW - 12, 0);
      seg(ctx, vx + stepW, ym, landX, to.y, true);
      bottom = c.bottom;
    }
  }

  return normalize(ctx.segs, ctx.slots);
}

function slotCorners(s: Slot): Pos[] {
  const rad = (s.angle * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);
  const nx = dy * WORD_H;
  const ny = -dx * WORD_H;
  return [
    { x: s.x, y: s.y },
    { x: s.x + s.w * dx, y: s.y + s.w * dy },
    { x: s.x + nx, y: s.y + ny },
    { x: s.x + s.w * dx + nx, y: s.y + s.w * dy + ny },
  ];
}

function normalize(segs: Seg[], slots: Slot[]): DiagramLayout {
  const points: Pos[] = [
    ...segs.flatMap((s) => [
      { x: s.x1, y: s.y1 },
      { x: s.x2, y: s.y2 },
    ]),
    ...slots.flatMap(slotCorners),
  ];
  const minX = Math.min(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y));
  const maxX = Math.max(...points.map((p) => p.x));
  const maxY = Math.max(...points.map((p) => p.y));
  const ox = PAD - minX;
  const oy = PAD - minY;
  return {
    segs: segs.map((s) => ({ ...s, x1: s.x1 + ox, x2: s.x2 + ox, y1: s.y1 + oy, y2: s.y2 + oy })),
    slots: slots.map((s) => ({ ...s, x: s.x + ox, y: s.y + oy })),
    width: Math.ceil(maxX - minX + PAD * 2),
    height: Math.ceil(maxY - minY + PAD * 2),
  };
}
