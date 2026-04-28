import type {
  AnalysisResult,
  CohortComparison,
  RankBand,
} from "./types.js";

// The fixed slate every analysis must cover (defined in
// frameworks/assessment-slate.md). Aggregation walks this list rather
// than each student's returned competencies so that a rare short-
// result doesn't produce ragged cohort arrays.
const SLATE_COMPETENCIES = [
  "Computing Foundations",
  "Systems & Infrastructure",
  "Data & Information Management",
  "Security, Ethics & Professional Responsibility",
  "Professional Communication",
  "Collaboration & Teamwork",
  "Self-Directed Learning & Innovation",
] as const;

// Numeric order for the framework's proficiency scale. Unknown levels
// fall to 0 — defensive: the model should be using verbatim levels,
// but we do not want to crash aggregation on a typo.
const LEVEL_ORDER: Record<string, number> = {
  "Not Demonstrated": 0,
  "Emerging": 1,
  "Developing": 2,
  "Proficient": 3,
  "Advanced": 4,
};

function levelScore(level: string): number {
  return LEVEL_ORDER[level] ?? 0;
}

function rankBand(
  score: number,
  sortedScores: number[],
  twoWayOnly: boolean,
): RankBand {
  // Percentile rank: fraction of the cohort with a strictly lower score.
  const below = sortedScores.filter((s) => s < score).length;
  const pct = sortedScores.length === 0 ? 0 : below / sortedScores.length;
  if (twoWayOnly) {
    return pct < 0.5 ? "below-median" : "above-median";
  }
  if (pct < 0.25) return "bottom-quartile";
  if (pct < 0.5) return "below-median";
  if (pct < 0.75) return "above-median";
  return "top-quartile";
}

// Groups competency scores across the cohort, then per student emits
// a rank band for each competency. For cohort size < 5 we degrade to a
// two-way split (below-/above-median) because quartiles are not
// informative below that size.
export function aggregateCohort(
  results: AnalysisResult[],
): Map<string, CohortComparison> {
  const out = new Map<string, CohortComparison>();
  const size = results.length;
  if (size === 0) return out;
  const twoWayOnly = size < 5;

  // Index each student's competency levels by name, so we can look up
  // a specific slate entry even if the result's competencies array
  // deviates in order or length. Missing entries score 0 and will
  // produce a rank band against the cohort (typically bottom).
  const studentLevel = new Map<string, Map<string, number>>();
  for (const r of results) {
    const byName = new Map<string, number>();
    for (const c of r.competencies) byName.set(c.name, levelScore(c.level));
    studentLevel.set(r.student_id, byName);
  }

  // For each slate competency, gather every student's score and sort.
  const sortedByName = new Map<string, number[]>();
  for (const name of SLATE_COMPETENCIES) {
    const scores: number[] = [];
    for (const r of results) scores.push(studentLevel.get(r.student_id)?.get(name) ?? 0);
    scores.sort((a, b) => a - b);
    sortedByName.set(name, scores);
  }

  for (const r of results) {
    const levels = studentLevel.get(r.student_id);
    const per_competency = SLATE_COMPETENCIES.map((name) => {
      const sorted = sortedByName.get(name) ?? [];
      const band = rankBand(levels?.get(name) ?? 0, sorted, twoWayOnly);
      return { name, rank_band: band };
    });
    out.set(r.student_id, { size, per_competency });
  }
  return out;
}
