import { EVALUATION_RULES, ROLE_BRIEF } from "./config.js";
import type { Framework } from "./context.js";
import type { StudentProfile } from "./types.js";

function frameworkInstructionParts(framework: Framework): string[] {
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
      `--- BEGIN ${d.id} v${d.version} - ${d.title} ---`,
      d.content,
      `--- END ${d.id} ---`,
      "",
    );
  }
  parts.push("=== END FRAMEWORK BUNDLE ===", "");
  parts.push(EVALUATION_RULES, "");
  return parts;
}

const analysisShapeHint = [
  "Response shape (the schema is enforced; this is what each field means):",
  "  - student_id: must equal the profile's id field verbatim.",
  "  - program: echo the profile's program field verbatim (BSCS / BSIT / BSCpE / unknown).",
  "  - summary: one to two sentences, framework-grounded overview.",
  "  - competencies: one entry per framework competency, with",
  "      name (verbatim), level (framework scale verbatim),",
  "      evidence (quotes/paraphrases from the profile),",
  "      citations (>=1 { doc, clause } pointing at actual bundle clauses),",
  "      confidence (high/medium/low), optional notes.",
  "  - strengths: clearest demonstrated capabilities, each with evidence.",
  "  - gaps: framework competencies with weak or missing evidence,",
  "      each with a concrete, actionable recommendation.",
];

const narrativeDirective = [
  "",
  "=== NARRATIVE MODE ===",
  "Produce a per-student markdown report from the structured assessment.",
  "Do not re-judge the student differently in the narrative; use the",
  "assessment's competency levels, strengths, and gaps as the source of truth.",
  "Render a grounded, cited, readable narrative.",
  "",
  "Required structure (these H2 headings, in this order, no others):",
  "  ## Profile Snapshot",
  "  ## Competency Assessment",
  "  ## Development Trajectory",
  "  ## Outlook & Next Steps",
  "",
  "Do not include a 'References' section. The runner appends one",
  "verbatim from the framework bundle; any References section you write",
  "will be discarded.",
  "",
  "Citation discipline (strict):",
  "  - Every substantive sentence must end with one or more inline",
  "    clause tags in square brackets, e.g. [ched-25:bscs-po-3], [cc2020:KA-SDF],",
  "    [sfia-9:PROG-3].",
  "  - Every clause must carry its full doc:clause form; never elide the",
  "    doc prefix. Wrong: [ched-25:bscs-po-3 bscs-po-6]. Right:",
  "    [ched-25:bscs-po-3 ched-25:bscs-po-6] or use two separate tags.",
  "  - Multiple clauses from different docs in one bracket are OK when",
  "    each carries its own doc: [ched-25:bscs-po-3 cc2020:KA-SDF].",
  "  - Use only clause IDs that appear verbatim in the framework bundle.",
  "  - Do not invent SFIA levels; use only levels 1-7, and reserve 4+",
  "    for clearly documented evidence of professional-authority work.",
  "  - A clause tag supports the sentence it terminates; it is not a",
  "    footnote-style reference. Do not use numbered footnotes.",
  "",
  "Tone rules:",
  "  - Address the student in second person ('you').",
  "  - Be specific and evidence-grounded; no generic career advice.",
  "  - No emoji. No placeholder text. No filler openings like 'In today's",
  "    fast-paced world'.",
];

// Static across all students in a run; cacheable.
export function buildSystemInstruction(framework: Framework): string {
  const parts = frameworkInstructionParts(framework);
  parts.push(...analysisShapeHint);
  return parts.join("\n");
}

// Combined per-student assessment and narrative pass. This replaces the
// previous separate narrative call now that the cohort pass has been removed.
export function buildAssessmentSystemInstruction(framework: Framework): string {
  const parts = frameworkInstructionParts(framework);
  parts.push(
    "Combined response shape (the schema is enforced):",
    "  - analysis: the structured assessment object with this shape:",
    ...analysisShapeHint.map((line) => `    ${line}`),
    "  - narrative: { student_id: string, narrative_markdown: string }",
    "    narrative.student_id must equal analysis.student_id and the profile id.",
    ...narrativeDirective,
  );
  return parts.join("\n");
}

// Per-student prompt for the combined assessment+narrative pass. Small
// on purpose so cache hits dominate the input-token bill when caching is active.
export function buildStudentPrompt(student: StudentProfile): string {
  return [
    "Analyze the following student profile against the framework bundle above,",
    "then produce the markdown narrative from that same structured assessment.",
    "Return one JSON object with top-level keys `analysis` and `narrative`.",
    "Every claim must be traceable to a specific element of this profile, and",
    "every competency must carry at least one valid { doc, clause } citation.",
    "The narrative must use the analysis as its source of truth and must not",
    "introduce different levels, strengths, or gaps.",
    "",
    "=== STUDENT PROFILE ===",
    JSON.stringify(student, null, 2),
    "=== END STUDENT PROFILE ===",
  ].join("\n");
}
