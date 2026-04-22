import { EVALUATION_RULES, ROLE_BRIEF } from "./config.js";
import type { Framework } from "./context.js";
import type { StudentProfile } from "./types.js";

// Static across all students in a run. This is what gets cached.
// Structure:
//   1. Role brief — who the assistant is and what it does
//   2. Skills framework (external context) — the ground truth for the analysis
//   3. Evaluation rules — how to apply the framework, enforced invariants
//   4. Output shape hint — reinforces the response schema in prose
export function buildSystemInstruction(framework: Framework): string {
  return [
    ROLE_BRIEF,
    "",
    "=== SKILLS FRAMEWORK (ground truth for this analysis) ===",
    framework.content,
    "=== END SKILLS FRAMEWORK ===",
    "",
    EVALUATION_RULES,
    "",
    "Response shape (the schema is enforced; this is what each field means):",
    "  - student_id: must equal the profile's id field verbatim.",
    "  - summary: one to two sentences, framework-grounded overview.",
    "  - competencies: one entry per framework competency, with",
    "      name (verbatim), level (framework scale verbatim),",
    "      evidence (quotes/paraphrases from the profile),",
    "      confidence (high/medium/low), optional notes.",
    "  - strengths: clearest demonstrated capabilities, each with evidence.",
    "  - gaps: framework competencies with weak or missing evidence,",
    "      each with a concrete, actionable recommendation.",
  ].join("\n");
}

// Per-student — the only thing that changes between calls. Kept small
// so cache hits dominate the token bill when caching is active.
export function buildStudentPrompt(student: StudentProfile): string {
  return [
    "Analyze the following student profile against the framework above.",
    "Every claim must be traceable to a specific element of this profile.",
    "",
    "=== STUDENT PROFILE ===",
    JSON.stringify(student, null, 2),
    "=== END STUDENT PROFILE ===",
  ].join("\n");
}
