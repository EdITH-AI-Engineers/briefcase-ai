import { analyzeStudent, narrateStudent } from "./analyze.js";
import {
  createAnalysisCache,
  createNarrativeCache,
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

export type NarrateCallback = (
  studentId: string,
  narrativeMarkdown: string,
  index: number,
) => Promise<void> | void;

export type RunFeatures = {
  flex: boolean;
  concurrency: number;
  analysisCache: CacheState;
  narrativeCache?: CacheState;
};

// Bounded-concurrency map that preserves input order. Runs up to
// `limit` promises in flight; each worker pulls the next index from a
// shared counter. The per-item callback is invoked in completion
// order (not input order), which is expected by the callers (they use
// the callback only for checkpoint writes — order does not matter for
// that). The returned array is in input order.
async function mapBounded<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
  onEach?: (result: R, index: number, item: T) => Promise<void> | void,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  const n = items.length;
  const cap = Math.max(1, Math.min(limit, n));
  let next = 0;

  async function worker() {
    while (true) {
      const i = next++;
      if (i >= n) return;
      const item = items[i];
      const r = await fn(item, i);
      results[i] = r;
      if (onEach) await onEach(r, i, item);
    }
  }

  const workers = Array.from({ length: cap }, () => worker());
  await Promise.all(workers);
  return results;
}

export type AnalyzeRunnerOptions = {
  profiles: StudentProfile[];
  framework: Framework;
  onAnalyze?: AnalyzeCallback;
  onFeatures?: (features: RunFeatures) => void;
};

export async function analyzeDataset(
  opts: AnalyzeRunnerOptions,
): Promise<AnalysisResult[]> {
  let cacheState: CacheState = { used: false };
  if (ANALYSIS.useCache) {
    try {
      cacheState = await createAnalysisCache(opts.framework);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`  analysis cache setup failed, continuing without it: ${msg}`);
    }
  }

  opts.onFeatures?.({
    flex: ANALYSIS.useFlex,
    concurrency: ANALYSIS.concurrency,
    analysisCache: cacheState,
  });
  const cachedContent = cacheState.used ? cacheState.name : undefined;

  const total = opts.profiles.length;
  let completed = 0;
  try {
    const results = await mapBounded(
      opts.profiles,
      ANALYSIS.concurrency,
      async (student) => {
        const t0 = Date.now();
        const result = await analyzeStudent({
          student,
          framework: opts.framework,
          cachedContent,
        });
        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
        completed += 1;
        const label = student.full_name ?? student.id;
        console.log(`  analyze ${completed}/${total}: ${label} (${elapsed}s)`);
        return result;
      },
      async (result, index, student) => {
        if (opts.onAnalyze) await opts.onAnalyze(result, index, student);
      },
    );
    return results;
  } finally {
    if (cacheState.used) {
      try {
        await deleteSharedCache(cacheState.name);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`  analysis cache delete failed: ${msg}`);
      }
    }
  }
}

export type NarrateRunnerOptions = {
  profiles: StudentProfile[];
  analyses: AnalysisResult[];
  framework: Framework;
  onNarrate?: NarrateCallback;
  onFeatures?: (features: { narrativeCache: CacheState }) => void;
};

export async function narrateDataset(opts: NarrateRunnerOptions): Promise<void> {
  let cacheState: CacheState = { used: false };
  if (ANALYSIS.useCache) {
    try {
      cacheState = await createNarrativeCache(opts.framework);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`  narrative cache setup failed, continuing without it: ${msg}`);
    }
  }

  opts.onFeatures?.({ narrativeCache: cacheState });
  const cachedContent = cacheState.used ? cacheState.name : undefined;

  const byId = new Map<string, AnalysisResult>();
  for (const a of opts.analyses) byId.set(a.student_id, a);

  const total = opts.profiles.length;
  let completed = 0;
  try {
    await mapBounded(
      opts.profiles,
      ANALYSIS.concurrency,
      async (student) => {
        const analysis = byId.get(student.id);
        if (!analysis) {
          completed += 1;
          console.warn(
            `  narrate ${completed}/${total}: no analysis for ${student.id}, skipping`,
          );
          return null as unknown as { id: string; markdown: string };
        }
        const t0 = Date.now();
        const result = await narrateStudent({
          student,
          analysis,
          framework: opts.framework,
          cachedContent,
        });
        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
        completed += 1;
        const label = student.full_name ?? student.id;
        console.log(`  narrate ${completed}/${total}: ${label} (${elapsed}s)`);
        return { id: result.student_id, markdown: result.narrative_markdown };
      },
      async (r, index) => {
        if (r && opts.onNarrate) await opts.onNarrate(r.id, r.markdown, index);
      },
    );
  } finally {
    if (cacheState.used) {
      try {
        await deleteSharedCache(cacheState.name);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`  narrative cache delete failed: ${msg}`);
      }
    }
  }
}
