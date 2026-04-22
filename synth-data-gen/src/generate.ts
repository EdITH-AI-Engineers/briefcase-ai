import { GoogleGenAI } from "@google/genai";
import {
  COLUMNS,
  CONTEXT,
  GENERATION,
  MIN_CACHE_TOKENS,
  MODEL,
  type ColumnSpec,
} from "./config.js";
import { buildBatchSchema } from "./schema.js";
import { withRetry } from "./retry.js";

export type Profile = Record<string, unknown>;

export type BatchCallback = (
  batch: Profile[],
  batchIndex: number,
) => Promise<void> | void;

type GenerateOptions = {
  columns?: Record<string, ColumnSpec>;
  context?: string;
  count: number;
  temperature?: number;
  seedHint?: string;
  cachedContent?: string;
};

export type RunFeatures = {
  flex: boolean;
  cache: { used: false } | { used: true; name: string; tokens: number };
};

let _client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (!_client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set.");
    _client = new GoogleGenAI({ apiKey });
  }
  return _client;
}

function buildSystemInstruction(
  columns: Record<string, ColumnSpec>,
  context: string,
): string {
  const columnList = Object.entries(columns)
    .map(([n, s]) => `  - ${n}: ${s.description}`)
    .join("\n");
  return [
    context,
    "",
    "Fields to populate (the response schema is enforced; these descriptions are the ground truth):",
    columnList,
    "",
    "Hard rules for every response:",
    "  - Every row must be distinct. Rotate countries, ages, occupations aggressively.",
    "  - Do NOT repeat names, emails, or ids within a batch.",
    "  - Keep each row internally plausible (income plausible for occupation/country).",
    "  - Return a JSON array conforming to the enforced schema, nothing else.",
  ].join("\n");
}

function buildBatchPrompt(count: number, seedHint?: string): string {
  const lines = [`Produce exactly ${count} user profiles now.`];
  if (seedHint) lines.push(`Diversity hint for this batch: ${seedHint}`);
  return lines.join("\n");
}

export async function createSharedCache(
  columns: Record<string, ColumnSpec>,
  context: string,
): Promise<RunFeatures["cache"]> {
  const ai = getClient();
  const systemInstruction = buildSystemInstruction(columns, context);

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

  const cache = await withRetry(() =>
    ai.caches.create({
      model: MODEL,
      config: {
        systemInstruction,
        ttl: `${GENERATION.cacheTtlSeconds}s`,
      },
    }),
  );
  const name = cache.name;
  if (!name) throw new Error("Cache created but no name returned.");
  console.log(
    `  cache created: ${name} (${tokens} tokens, ttl ${GENERATION.cacheTtlSeconds}s)`,
  );
  return { used: true, name, tokens };
}

export async function deleteSharedCache(name: string): Promise<void> {
  const ai = getClient();
  await ai.caches.delete({ name });
  console.log(`  cache deleted: ${name}`);
}

export async function generateBatch(opts: GenerateOptions): Promise<Profile[]> {
  const columns = opts.columns ?? COLUMNS;
  const context = opts.context ?? CONTEXT;
  const temperature = opts.temperature ?? GENERATION.temperature;

  const ai = getClient();
  const schema = buildBatchSchema(columns);

  const config: Record<string, unknown> = {
    responseMimeType: "application/json",
    responseSchema: schema,
    temperature,
  };
  if (opts.cachedContent) {
    config.cachedContent = opts.cachedContent;
  } else {
    config.systemInstruction = buildSystemInstruction(columns, context);
  }
  if (GENERATION.useFlex) config.serviceTier = "flex";

  const response = await withRetry(
    () =>
      ai.models.generateContent({
        model: MODEL,
        contents: buildBatchPrompt(opts.count, opts.seedHint),
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

  const parsed = JSON.parse(text) as Profile[];
  if (!Array.isArray(parsed)) {
    throw new Error("Model did not return a JSON array.");
  }
  return parsed;
}

const DIVERSITY_SEEDS = [
  "lean toward Southeast Asia and West Africa",
  "lean toward Latin America and Eastern Europe",
  "lean toward Nordic countries and Central Asia",
  "lean toward South Asia and the Middle East",
  "lean toward Oceania and Southern Africa",
  "lean toward East Asia and the Caribbean",
];

export async function generateDataset(
  total: number = GENERATION.totalRows,
  batchSize: number = GENERATION.batchSize,
  opts: {
    columns?: Record<string, ColumnSpec>;
    context?: string;
    temperature?: number;
    onBatch?: BatchCallback;
    onFeatures?: (features: RunFeatures) => void;
  } = {},
): Promise<Profile[]> {
  const columns = opts.columns ?? COLUMNS;
  const context = opts.context ?? CONTEXT;

  let cacheState: RunFeatures["cache"] = { used: false };
  if (GENERATION.useCache) {
    try {
      cacheState = await createSharedCache(columns, context);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`  cache setup failed, continuing without it: ${msg}`);
    }
  }

  const features: RunFeatures = {
    flex: GENERATION.useFlex,
    cache: cacheState,
  };
  opts.onFeatures?.(features);

  const cachedContent = cacheState.used ? cacheState.name : undefined;
  const out: Profile[] = [];
  let batchIdx = 0;

  try {
    while (out.length < total) {
      const remaining = total - out.length;
      const count = Math.min(batchSize, remaining);
      const seedHint = DIVERSITY_SEEDS[batchIdx % DIVERSITY_SEEDS.length];

      const batch = await generateBatch({
        columns,
        context,
        temperature: opts.temperature,
        count,
        seedHint,
        cachedContent,
      });
      out.push(...batch);
      batchIdx += 1;
      console.log(
        `  batch ${batchIdx}: +${batch.length} rows (total ${out.length}/${total})`,
      );
      if (opts.onBatch) await opts.onBatch(batch, batchIdx);
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

  return out.slice(0, total);
}
