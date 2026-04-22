import { getClient } from "./client.js";
import { ANALYSIS, MODEL } from "./config.js";
import type { Framework } from "./context.js";
import { buildStudentPrompt, buildSystemInstruction } from "./prompt.js";
import { withRetry } from "./retry.js";
import { ANALYSIS_SCHEMA } from "./schema.js";
import type { AnalysisResult, StudentProfile } from "./types.js";

export type AnalyzeOptions = {
  student: StudentProfile;
  framework: Framework;
  // If set, reuse a cache of the system instruction built from `framework`.
  cachedContent?: string;
  temperature?: number;
};

// Single-student analysis. Composition is:
//   - config.responseSchema      -> structured JSON output
//   - config.cachedContent       -> reuse cached framework+rules if available
//   - config.systemInstruction   -> framework+rules inline if no cache
//   - contents                   -> the student profile (the only thing that varies)
//   - config.serviceTier="flex"  -> 50% off, best-effort latency
export async function analyzeStudent(
  opts: AnalyzeOptions,
): Promise<AnalysisResult> {
  const ai = getClient();

  const config: Record<string, unknown> = {
    responseMimeType: "application/json",
    responseSchema: ANALYSIS_SCHEMA,
    temperature: opts.temperature ?? ANALYSIS.temperature,
  };
  if (opts.cachedContent) {
    config.cachedContent = opts.cachedContent;
  } else {
    config.systemInstruction = buildSystemInstruction(opts.framework);
  }
  if (ANALYSIS.useFlex) config.serviceTier = "flex";

  const response = await withRetry(
    () =>
      ai.models.generateContent({
        model: MODEL,
        contents: buildStudentPrompt(opts.student),
        config,
      }),
    {
      onRetry: (err, attempt, delayMs) => {
        const status = (err as { status?: number }).status;
        const secs = (delayMs / 1000).toFixed(1);
        console.warn(
          `  transient error (status=${status ?? "?"}), retry ${attempt} in ${secs}s`,
        );
      },
    },
  );

  const text = response.text;
  if (!text) throw new Error("Empty response from model.");

  return JSON.parse(text) as AnalysisResult;
}
