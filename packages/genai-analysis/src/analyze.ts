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

export type AnalyzeOptions = {
  student: StudentProfile;
  framework: Framework;
  // If set, reuse a cache of the combined assessment system instruction.
  cachedContent?: string;
  temperature?: number;
};

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
      return JSON.parse(text) as StudentAssessmentResult;
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
