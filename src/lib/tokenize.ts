import type { Token } from "./types";

const TOKEN_RE = /[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*|[^\s\p{L}\p{N}]/gu;

export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  for (const match of text.matchAll(TOKEN_RE)) {
    const t = match[0];
    tokens.push({ text: t, isWord: /[\p{L}\p{N}]/u.test(t) });
  }
  return tokens;
}

export function normalizeWord(word: string): string {
  return word.toLowerCase().replace(/’/g, "'");
}

/** Joins tokens back into readable text, without spaces before punctuation. */
export function detokenize(tokens: Token[]): string {
  let out = "";
  for (const [i, t] of tokens.entries()) {
    const noSpace = i === 0 || (!t.isWord && /[.,!?;:)'"’”]/.test(t.text)) || /[("“]$/.test(out);
    out += (noSpace ? "" : " ") + t.text;
  }
  return out;
}
