import type { StatsSummary } from "./types.js";

// Word-level tokenizer: lowercases, splits on non-alphanumeric. Good
// enough for narrative-vs-profile overlap; matches how most ROUGE
// implementations treat sentences when stopword / stemmer behaviors
// are not configured.
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

// Longest Common Subsequence length, O(n*m) time, O(min(n,m)) space.
// Deterministic — same inputs always produce the same score.
export function lcsLength(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  const prev = new Int32Array(shorter.length + 1);
  const curr = new Int32Array(shorter.length + 1);
  for (let i = 1; i <= longer.length; i++) {
    for (let j = 1; j <= shorter.length; j++) {
      if (longer[i - 1] === shorter[j - 1]) {
        curr[j] = prev[j - 1] + 1;
      } else {
        curr[j] = Math.max(prev[j], curr[j - 1]);
      }
    }
    prev.set(curr);
    curr.fill(0);
  }
  return prev[shorter.length];
}

export type RougeLScore = {
  precision: number;
  recall: number;
  f1: number;
};

// ROUGE-L (Lin 2004) between a candidate and a reference string.
// Precision = LCS / |candidate|; recall = LCS / |reference|; F1 the
// harmonic mean. Returns zeros on empty input (no error thrown).
export function rougeL(candidate: string, reference: string): RougeLScore {
  const c = tokenize(candidate);
  const r = tokenize(reference);
  const lcs = lcsLength(c, r);
  const precision = c.length === 0 ? 0 : lcs / c.length;
  const recall = r.length === 0 ? 0 : lcs / r.length;
  const f1 =
    precision + recall === 0
      ? 0
      : (2 * precision * recall) / (precision + recall);
  return { precision, recall, f1 };
}

// Token-overlap ratio: fraction of unique candidate tokens that
// appear anywhere in the reference. Coarser than ROUGE — useful for
// the "evidence appears in profile" check where we just want to know
// whether the evidence string is grounded at all, not how well it
// aligns word-by-word.
export function overlapRatio(candidate: string, reference: string): number {
  const c = new Set(tokenize(candidate));
  if (c.size === 0) return 0;
  const r = new Set(tokenize(reference));
  let hits = 0;
  for (const t of c) if (r.has(t)) hits += 1;
  return hits / c.size;
}

export function summarize(values: number[]): StatsSummary {
  if (values.length === 0) {
    return { count: 0, mean: 0, stdev: 0, min: 0, max: 0 };
  }
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return {
    count: values.length,
    mean,
    stdev: Math.sqrt(variance),
    min: Math.min(...values),
    max: Math.max(...values),
  };
}
