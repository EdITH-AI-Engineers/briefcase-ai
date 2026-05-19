# synth-data-gen

Synthetic **student-profile** generator using Google's Gemini models via `@google/genai`. Produces schema-enforced JSON — each profile has id, full name, self-authored description, skills, certifications, awards, education, projects, and experience — batches requests, checkpoints after every batch, and tears down any caches it creates.

Downstream consumer: [`genai-analysis`](../genai-analysis) evaluates these profiles against an external skills framework. Column names in `src/config.ts` are kept in sync with `StudentProfile` in `genai-analysis/src/types.ts` — the two packages are contract-coupled.

## Prerequisites

- Node.js 20+
- A Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)

## Setup

```
npm install
cp .env.example .env
# then edit .env and set GEMINI_API_KEY
```

## Run

```
npm run generate
```

Output lands in `output/run-<YYYYMMDD-HHMMSS>/`:

- `profiles.json` — the generated rows (written incrementally after every batch)
- `manifest.json` — run metadata: status, row counts, model, features used (flex/cache), timestamps, and the `CONTEXT` prompt used

Every run gets its own folder; nothing is ever overwritten. A crash mid-run leaves whatever batches had already completed on disk, plus a manifest with `status: "partial"` and the error message.

## Configuration

All knobs live in [`src/config.ts`](./src/config.ts). Edit them freely — no code changes elsewhere needed.

### `COLUMNS`

One entry per field in the output. Each column has a `type` (from the `Type` enum — `STRING`, `INTEGER`, `BOOLEAN`, `ARRAY`, etc.), a `description` (the ground truth the model is told to follow), and optional `enum` / `nullable` / `items`. Add, remove, rename freely — the schema is rebuilt from this object.

### `CONTEXT`

Free-form grounding brief — what kind of dataset, what to emphasize, what to avoid. Swap it entirely to generate a different domain.

### `GENERATION`

| Key | Meaning |
| --- | --- |
| `batchSize` | Rows per model call |
| `totalRows` | Target size for the dataset |
| `temperature` | Sampling temperature (higher = more diverse) |
| `outputDir` | Base directory for runs |
| `useFlex` | Enable flex-tier inference — 50% cheaper, 1–15 min latency, best-effort availability |
| `useCache` | Enable context caching for the shared system instruction |
| `cacheTtlSeconds` | How long to keep the cache alive (deleted on run exit regardless) |

### `MODEL`

Pinned to `gemini-3.1-flash-lite-preview`. Swap to any model the SDK accepts.

## How it works

1. `src/schema.ts` builds a Gemini `Schema` from `COLUMNS` and passes it as `responseSchema`. The model is forced to return JSON matching that shape.
2. `src/generate.ts` splits the prompt into a static `systemInstruction` (cacheable) and a per-batch `contents` with a rotating diversity hint to fight mode collapse.
3. If `useCache` is on and the system instruction is ≥ 1024 tokens (Gemini's floor for flash-tier caching), a cache is created and reused across all batches. Below the floor, caching is skipped with a warning — not an error.
4. Transient errors (429, 500, 502, 503, 504, network resets) retry with exponential backoff up to 5 times. Non-transient errors fail fast.
5. After every successful batch, `output/run-*/profiles.json` is rewritten with the full result so far.
6. The cache, if any, is deleted on run exit — no storage bill beyond the run.

## File map

```
src/
  config.ts    # columns, context, generation toggles — edit this to change the dataset
  schema.ts    # COLUMNS -> Gemini Schema
  generate.ts  # client, prompt assembly, cache lifecycle, batch loop
  retry.ts     # transient-error detection and exponential backoff
  index.ts     # entry point: run folder, checkpointing, manifest
```
