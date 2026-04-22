import { getClient } from "./client.js";
import { ANALYSIS, MIN_CACHE_TOKENS, MODEL } from "./config.js";
import type { Framework } from "./context.js";
import { buildSystemInstruction } from "./prompt.js";
import { withRetry } from "./retry.js";

export type CacheState =
  | { used: false }
  | { used: true; name: string; tokens: number };

export async function createSharedCache(
  framework: Framework,
): Promise<CacheState> {
  const ai = getClient();
  const systemInstruction = buildSystemInstruction(framework);

  const { totalTokens } = await ai.models.countTokens({
    model: MODEL,
    contents: systemInstruction,
  });
  const tokens = totalTokens ?? 0;

  if (tokens < MIN_CACHE_TOKENS) {
    console.warn(
      `  cache skipped: systemInstruction is ${tokens} tokens, below ${MIN_CACHE_TOKENS}-token minimum for ${MODEL}`,
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
          `  cache create transient error (status=${status ?? "?"}), retry ${attempt} in ${secs}s`,
        );
      },
    },
  );
  const name = cache.name;
  if (!name) throw new Error("Cache created but no name returned.");
  console.log(
    `  cache created: ${name} (${tokens} tokens, ttl ${ANALYSIS.cacheTtlSeconds}s)`,
  );
  return { used: true, name, tokens };
}

export async function deleteSharedCache(name: string): Promise<void> {
  const ai = getClient();
  await ai.caches.delete({ name });
  console.log(`  cache deleted: ${name}`);
}
