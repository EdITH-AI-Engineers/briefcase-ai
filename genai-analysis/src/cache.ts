import { getClient } from "./client.js";
import { ANALYSIS, MIN_CACHE_TOKENS, MODEL } from "./config.js";
import type { Framework } from "./context.js";
import {
  buildNarrativeSystemInstruction,
  buildSystemInstruction,
} from "./prompt.js";
import { withRetry } from "./retry.js";

export type CacheState =
  | { used: false }
  | { used: true; name: string; tokens: number };

async function createCache(
  systemInstruction: string,
  label: string,
): Promise<CacheState> {
  const ai = getClient();

  const { totalTokens } = await ai.models.countTokens({
    model: MODEL,
    contents: systemInstruction,
  });
  const tokens = totalTokens ?? 0;

  if (tokens < MIN_CACHE_TOKENS) {
    console.warn(
      `  ${label} cache skipped: systemInstruction is ${tokens} tokens, below ${MIN_CACHE_TOKENS}-token minimum for ${MODEL}`,
    );
    return { used: false };
  }

  const cache = await withRetry(
    () =>
      ai.caches.create({
        model: MODEL,
        config: {
          systemInstruction,
          ttl: `${ANALYSIS.cacheTtlSeconds}s`,
        },
      }),
    {
      retries: 1,
      onRetry: (err, attempt, delayMs) => {
        const status = (err as { status?: number }).status;
        const secs = (delayMs / 1000).toFixed(1);
        console.warn(
          `  ${label} cache create transient error (status=${status ?? "?"}), retry ${attempt} in ${secs}s`,
        );
      },
    },
  );
  const name = cache.name;
  if (!name) throw new Error(`${label} cache created but no name returned.`);
  console.log(
    `  ${label} cache created: ${name} (${tokens} tokens, ttl ${ANALYSIS.cacheTtlSeconds}s)`,
  );
  return { used: true, name, tokens };
}

export async function createAnalysisCache(
  framework: Framework,
): Promise<CacheState> {
  return createCache(buildSystemInstruction(framework), "analysis");
}

export async function createNarrativeCache(
  framework: Framework,
): Promise<CacheState> {
  return createCache(buildNarrativeSystemInstruction(framework), "narrative");
}

export async function deleteSharedCache(name: string): Promise<void> {
  const ai = getClient();
  await ai.caches.delete({ name });
  console.log(`  cache deleted: ${name}`);
}
