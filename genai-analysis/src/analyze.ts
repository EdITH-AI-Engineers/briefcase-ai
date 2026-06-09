import { getClient } from "./client.js";
import { ANALYSIS, MODEL } from "./config.js";
import type { Framework } from "./context.js";
import {
  buildAssessmentSystemInstruction,
  buildStudentPrompt,
} from "./prompt.js";
import { withRetry } from "./retry.js";
import { STUDENT_ASSESSMENT_SCHEMA } from "./schema.js";
import type { StudentAssessmentResult, StudentProfile } from "./types.js";

type AnyRecord = Record<string, unknown>;

export type AnalyzeOptions = {
  student: StudentProfile;
  framework: Framework;
  // If set, reuse a cache of the combined assessment system instruction.
  cachedContent?: string;
  temperature?: number;
};

function isRecord(value: unknown): value is AnyRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeProgram(
  value: unknown,
): StudentAssessmentResult["analysis"]["program"] | null {
  if (typeof value !== "string") return null;

  const normalized = value.replace(/[^a-z0-9]/gi, "").toUpperCase();
  if (!normalized || normalized === "UNKNOWN") return "unknown";
  if (normalized.startsWith("BSCS")) return "BSCS";
  if (normalized.startsWith("BSIT")) return "BSIT";
  if (normalized.startsWith("BSCPE")) return "BSCpE";
  return null;
}

function parseStudentAssessmentResult(text: string): StudentAssessmentResult {
  const parsed = JSON.parse(text) as unknown;
  if (!isRecord(parsed) || !isRecord(parsed.analysis) || !isRecord(parsed.narrative)) {
    throw new SyntaxError("Model response did not include analysis and narrative objects.");
  }

  const { analysis, narrative } = parsed;
  const program = normalizeProgram(analysis.program);
  if (
    !hasText(analysis.student_id) ||
    !program ||
    !hasText(analysis.summary) ||
    !Array.isArray(analysis.competencies) ||
    !Array.isArray(analysis.strengths) ||
    !Array.isArray(analysis.gaps)
  ) {
    throw new SyntaxError("Model response analysis object is missing required fields.");
  }
  if (!hasText(narrative.student_id) || !hasText(narrative.narrative_markdown)) {
    throw new SyntaxError("Model response narrative object is missing required fields.");
  }

  analysis.program = program;
  return parsed as StudentAssessmentResult;
}

// Combined per-student pass: structured assessment plus markdown narrative.
// This replaces the old split flow after the cohort pass was removed.
export async function analyzeStudent(
  opts: AnalyzeOptions,
): Promise<StudentAssessmentResult> {
  const ai = getClient();

  const config: Record<string, unknown> = {
    responseMimeType: "application/json",
    responseSchema: STUDENT_ASSESSMENT_SCHEMA,
    temperature: opts.temperature ?? ANALYSIS.temperature,
  };
  if (opts.cachedContent) {
    config.cachedContent = opts.cachedContent;
  } else {
    config.systemInstruction = buildAssessmentSystemInstruction(opts.framework);
  }
  if (ANALYSIS.useFlex) config.serviceTier = "flex";

  // Wrap both the network call and JSON parse: a truncated or malformed
  // response body surfaces as SyntaxError from JSON.parse, which retry.ts
  // classifies as transient so the call is retried.
  return await withRetry(
    async () => {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: buildStudentPrompt(opts.student),
        config,
      });
      const text = response.text;
      if (!text) throw new Error("Empty response from model.");
      return parseStudentAssessmentResult(text);
    },
    {
      onRetry: (err, attempt, delayMs) => {
        const status = (err as { status?: number }).status;
        const kind =
          err instanceof SyntaxError ? "malformed-json" : `status=${status ?? "?"}`;
        const secs = (delayMs / 1000).toFixed(1);
        console.warn(`  transient error (${kind}), retry ${attempt} in ${secs}s`);
      },
    },
  );
}
