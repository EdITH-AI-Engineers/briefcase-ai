import { analyzeStudent } from "./analyze.js";
import {
  createSharedCache,
  deleteSharedCache,
  type CacheState,
} from "./cache.js";
import { ANALYSIS } from "./config.js";
import type { Framework } from "./context.js";
import type { AnalysisResult, StudentProfile } from "./types.js";

export type AnalyzeCallback = (
  result: AnalysisResult,
  index: number,
  student: StudentProfile,
) => Promise<void> | void;

export type RunFeatures = {
  flex: boolean;
  cache: CacheState;
};

export type RunnerOptions = {
  profiles: StudentProfile[];
  framework: Framework;
  onAnalyze?: AnalyzeCallback;
  onFeatures?: (features: RunFeatures) => void;
};

export async function analyzeDataset(
  opts: RunnerOptions,
): Promise<AnalysisResult[]> {
  let cacheState: CacheState = { used: false };
  if (ANALYSIS.useCache) {
    try {
      cacheState = await createSharedCache(opts.framework);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`  cache setup failed, continuing without it: ${msg}`);
    }
  }

  opts.onFeatures?.({ flex: ANALYSIS.useFlex, cache: cacheState });
  const cachedContent = cacheState.used ? cacheState.name : undefined;

  const results: AnalysisResult[] = [];
  try {
    for (let i = 0; i < opts.profiles.length; i++) {
      const student = opts.profiles[i];
      const t0 = Date.now();
      const result = await analyzeStudent({
        student,
        framework: opts.framework,
        cachedContent,
      });
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      results.push(result);
      const label = student.full_name ?? student.id;
      console.log(
        `  ${i + 1}/${opts.profiles.length}: ${label} (${elapsed}s)`,
      );
      if (opts.onAnalyze) await opts.onAnalyze(result, i, student);
    }
  } finally {
    if (cacheState.used) {
      try {
        await deleteSharedCache(cacheState.name);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`  cache delete failed: ${msg}`);
      }
    }
  }

  return results;
}
