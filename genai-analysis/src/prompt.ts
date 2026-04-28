import { EVALUATION_RULES, ROLE_BRIEF } from "./config.js";
import type { Framework } from "./context.js";
import type { AnalysisResult, StudentProfile } from "./types.js";

// Static across all students in a run — cacheable. Contains:
//   1. Role brief — who the assistant is and what it does
//   2. Framework bundle — each doc labelled with its id and version
//      so the model can reliably emit { doc, clause } citations
//   3. Evaluation rules — citation discipline + response invariants
//   4. Output shape hint — reinforces the response schema in prose
export function buildSystemInstruction(framework: Framework): string {
  const parts: string[] = [ROLE_BRIEF, ""];
  parts.push(
    `=== FRAMEWORK BUNDLE (version ${framework.bundleVersion}) ===`,
    "The analysis must be grounded in the documents below. Each doc starts",
    "with its header line `--- BEGIN <id> v<version> ---` and ends with",
    "`--- END <id> ---`. Cite clauses with { doc: \"<id>\", clause: \"<clause-id>\" };",
    "only use clauses that actually appear in these documents.",
    "",
  );
  for (const d of framework.docs) {
    parts.push(
      `--- BEGIN ${d.id} v${d.version} — ${d.title} ---`,
      d.content,
      `--- END ${d.id} ---`,
      "",
    );
  }
  parts.push("=== END FRAMEWORK BUNDLE ===", "");
  parts.push(EVALUATION_RULES, "");
  parts.push(
    "Response shape (the schema is enforced; this is what each field means):",
    "  - student_id: must equal the profile's id field verbatim.",
    "  - program: echo the profile's program field verbatim (BSCS / BSIT / BSCpE / unknown).",
    "  - summary: one to two sentences, framework-grounded overview.",
    "  - competencies: one entry per framework competency, with",
    "      name (verbatim), level (framework scale verbatim),",
    "      evidence (quotes/paraphrases from the profile),",
    "      citations (≥1 { doc, clause } pointing at actual bundle clauses),",
    "      confidence (high/medium/low), optional notes.",
    "  - strengths: clearest demonstrated capabilities, each with evidence.",
    "  - gaps: framework competencies with weak or missing evidence,",
    "      each with a concrete, actionable recommendation.",
  );
  return parts.join("\n");
}

// Per-student prompt (Pass 1). Small on purpose so cache hits dominate
// the input-token bill when caching is active.
export function buildStudentPrompt(student: StudentProfile): string {
  return [
    "Analyze the following student profile against the framework bundle above.",
    "Every claim must be traceable to a specific element of this profile,",
    "and every competency must carry at least one valid { doc, clause } citation.",
    "",
    "=== STUDENT PROFILE ===",
    JSON.stringify(student, null, 2),
    "=== END STUDENT PROFILE ===",
  ].join("\n");
}

// Pass 3 — narrative. System instruction for the narrative pass.
// It is structurally identical to the analysis system instruction
// (same ROLE_BRIEF, same framework bundle, same EVALUATION_RULES)
// so that both passes share a single context cache when caching is on.
// The only divergence is the instructions appended at the end, which
// switch the model from "emit structured JSON assessment" to
// "emit a markdown narrative that consumes an existing assessment".
export function buildNarrativeSystemInstruction(framework: Framework): string {
  const shared = buildSystemInstruction(framework);
  const narrativeDirective = [
    "",
    "=== NARRATIVE MODE ===",
    "For this call, you are producing a per-student markdown report from",
    "an already-completed structured assessment. Do NOT re-judge the student;",
    "reuse the assessment's competency levels, strengths, and gaps. Your job",
    "is to render a grounded, cited, readable narrative.",
    "",
    "Required structure (these H2 headings, in this order, no others):",
    "  ## Profile Snapshot",
    "  ## Competency Assessment",
    "  ## Development Trajectory",
    "  ## Anonymous Peer Comparison",
    "  ## Outlook & Next Steps",
    "",
    "Do NOT include a 'References' section. The runner appends one",
    "verbatim from the framework bundle; any References section you write",
    "will be discarded.",
    "",
    "Citation discipline (STRICT):",
    "  - Every substantive sentence must end with one or more inline",
    "    clause tags in square brackets, e.g. [ched-25:bscs-po-3], [cc2020:KA-SDF],",
    "    [sfia-9:PROG-3].",
    "  - EVERY clause must carry its full doc:clause form — never elide the",
    "    doc prefix. WRONG: [ched-25:bscs-po-3 bscs-po-6]. RIGHT:",
    "    [ched-25:bscs-po-3 ched-25:bscs-po-6] or use two separate tags.",
    "  - Multiple clauses from different docs in one bracket are OK when",
    "    each carries its own doc: [ched-25:bscs-po-3 cc2020:KA-SDF].",
    "  - Use only clause IDs that appear verbatim in the framework bundle.",
    "  - Do not invent SFIA levels — use only levels 1–7, and reserve 4+",
    "    for clearly documented evidence of professional-authority work.",
    "  - A clause tag supports the sentence it terminates; it is not a",
    "    footnote-style reference. Do not use numbered footnotes.",
    "",
    "Anonymity rules:",
    "  - Never name, describe, or allude to specific other students.",
    "  - Peer references use only the rank-band language from the provided",
    "    CohortComparison (bottom-quartile / below-median / above-median /",
    "    top-quartile) and the cohort size.",
    "",
    "Peer-comparison wording:",
    "  - The rank bands in CohortComparison are NOT random and NOT drawn",
    "    from an external population. They are computed deterministically",
    "    from the other students analyzed in the same run. Refer to that",
    "    group as 'your batch' or 'the batch of N students analyzed",
    "    alongside you' — never as a 'peer group', a 'national sample',",
    "    or anything that implies an external baseline.",
    "  - Example phrasing: 'Within the batch of 60 students analyzed",
    "    alongside you, you are in the top-quartile for Computing",
    "    Foundations [cc2020:KA-SDF].'",
    "",
    "Tone rules:",
    "  - Address the student in second person ('you').",
    "  - Be specific and evidence-grounded; no generic career advice.",
    "  - No emoji. No placeholder text. No filler openings like 'In today's",
    "    fast-paced world'.",
    "",
    "Response shape (enforced):",
    "  { student_id: string, narrative_markdown: string }",
  ].join("\n");
  return shared + narrativeDirective;
}

export type NarrativePromptInput = {
  student: StudentProfile;
  analysis: AnalysisResult;
};

// Per-student prompt for Pass 3. Embeds both the profile (source of
// evidence quotes) and the Pass 1 result (levels, strengths, gaps,
// and the cohort block) so the narrative rephrases rather than
// re-judges.
export function buildNarrativePrompt(input: NarrativePromptInput): string {
  const { student, analysis } = input;
  return [
    "Produce the markdown narrative for the following student.",
    "Use the profile as the source of quotable evidence, and the",
    "structured assessment as the source of truth for levels,",
    "strengths, gaps, and cohort standing. Every paragraph must",
    "contain at least one inline clause tag.",
    "",
    "=== STUDENT PROFILE ===",
    JSON.stringify(student, null, 2),
    "=== END STUDENT PROFILE ===",
    "",
    "=== STRUCTURED ASSESSMENT (Pass 1 + Pass 2) ===",
    JSON.stringify(analysis, null, 2),
    "=== END STRUCTURED ASSESSMENT ===",
  ].join("\n");
}
