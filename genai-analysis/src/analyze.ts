import { GoogleGenAI } from "@google/genai";
import { ANALYSIS, MODEL } from "./config.js";
import type { Framework } from "./context.js";
import { buildStudentPrompt, buildSystemInstruction } from "./prompt.js";
import { ANALYSIS_SCHEMA } from "./schema.js";
import type { AnalysisResult, StudentProfile } from "./types.js";

let _client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (!_client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set.");
    _client = new GoogleGenAI({ apiKey });
  }
  return _client;
}

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

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: buildStudentPrompt(opts.student),
    config,
  });

  const text = response.text;
  if (!text) throw new Error("Empty response from model.");

  return JSON.parse(text) as AnalysisResult;
}
