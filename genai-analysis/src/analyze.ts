import { getClient } from "./client.js";
import { ANALYSIS, MODEL } from "./config.js";
import type { Framework } from "./context.js";
import { NARRATIVE_SCHEMA } from "./narrative-schema.js";
import {
  buildNarrativePrompt,
  buildNarrativeSystemInstruction,
  buildStudentPrompt,
  buildSystemInstruction,
} from "./prompt.js";
import { withRetry } from "./retry.js";
import { ANALYSIS_SCHEMA } from "./schema.js";
import type {
  AnalysisResult,
  NarrativeResult,
  StudentProfile,
} from "./types.js";

export type AnalyzeOptions = {
  student: StudentProfile;
  framework: Framework;
  // If set, reuse a cache of the system instruction built from `framework`.
  cachedContent?: string;
  temperature?: number;
};

// Pass 1 — structured, citation-bearing JSON assessment.
// Composition:
//   - config.responseSchema      -> structured JSON output (ANALYSIS_SCHEMA)
//   - config.cachedContent       -> reuse cached framework bundle if available
//   - config.systemInstruction   -> framework bundle + rules inline if no cache
//   - contents                   -> the student profile (includes `program`)
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

  // Wrap both the network call AND the JSON parse: a truncated or
  // malformed response body surfaces as a SyntaxError from JSON.parse,
  // which retry.ts classifies as transient so the call is retried.
  return await withRetry(
    async () => {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: buildStudentPrompt(opts.student),
        config,
      });
      const text = response.text;
      if (!text) throw new Error("Empty response from model.");
      return JSON.parse(text) as AnalysisResult;
    },
    {
      onRetry: (err, attempt, delayMs) => {
        const status = (err as { status?: number }).status;
        const kind = err instanceof SyntaxError ? "malformed-json" : `status=${status ?? "?"}`;
        const secs = (delayMs / 1000).toFixed(1);
        console.warn(`  transient error (${kind}), retry ${attempt} in ${secs}s`);
      },
    },
  );
}

export type NarrateOptions = {
  student: StudentProfile;
  analysis: AnalysisResult;
  framework: Framework;
  // Cache name for the narrative system instruction. The narrative
  // system instruction differs from the analysis one (it appends a
  // NARRATIVE MODE block), so narrative and analysis cannot share a
  // cache. Pass undefined to skip caching.
  cachedContent?: string;
  temperature?: number;
};

// Pass 3 — per-student markdown narrative built on top of the Pass 1
// result. Uses the narrative system instruction and schema. If
// `cachedContent` is supplied it must point at a cache created from
// `buildNarrativeSystemInstruction(framework)`.
export async function narrateStudent(
  opts: NarrateOptions,
): Promise<NarrativeResult> {
  const ai = getClient();

  const config: Record<string, unknown> = {
    responseMimeType: "application/json",
    responseSchema: NARRATIVE_SCHEMA,
    temperature: opts.temperature ?? ANALYSIS.narrativeTemperature,
  };
  if (opts.cachedContent) {
    config.cachedContent = opts.cachedContent;
  } else {
    config.systemInstruction = buildNarrativeSystemInstruction(opts.framework);
  }
  if (ANALYSIS.useFlex) config.serviceTier = "flex";

  return await withRetry(
    async () => {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: buildNarrativePrompt({
          student: opts.student,
          analysis: opts.analysis,
        }),
        config,
      });
      const text = response.text;
      if (!text) throw new Error("Empty narrative response from model.");
      return JSON.parse(text) as NarrativeResult;
    },
    {
      onRetry: (err, attempt, delayMs) => {
        const status = (err as { status?: number }).status;
        const kind = err instanceof SyntaxError ? "malformed-json" : `status=${status ?? "?"}`;
        const secs = (delayMs / 1000).toFixed(1);
        console.warn(`  narrative transient error (${kind}), retry ${attempt} in ${secs}s`);
      },
    },
  );
}
