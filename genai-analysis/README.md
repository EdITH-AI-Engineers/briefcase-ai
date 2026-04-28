# genai-analysis

Evaluates self-reported Filipino CS / IT / Computer Engineering undergraduate student profiles against a frozen, citable, multi-document skills framework (CHED CMO 25 s.2015 + CHED CMO 87 s.2017 + ACM/IEEE CC2020 + SFIA 9). Produces structured JSON assessments and per-student markdown narratives where every claim traces to a specific framework clause, plus an offline evaluator that scores the run on citation validity, evidence groundedness, and cohort health.

Same model as `synth-data-gen`: `gemini-3.1-flash-lite-preview`. Structured output via `responseSchema`, context caching, flex-tier inference, bounded concurrency.

**For the full Input-Process-Output reference, see [ARCHITECTURE.md](./ARCHITECTURE.md).**

## Prerequisites

- Node.js 20+
- A Gemini API key (`.env` → `GEMINI_API_KEY`)
- A `synth-data-gen` run on disk, or any JSON array of `StudentProfile` objects with `program ∈ {BSCS, BSIT, BSCpE}`.

## Setup

```
npm install
cp .env.example .env   # set GEMINI_API_KEY
```

A frozen framework bundle (v1.1.0) ships in [`frameworks/`](./frameworks/). Swap or extend by editing `frameworks/manifest.json` and bumping `bundleVersion` (see [`frameworks/README.md`](./frameworks/README.md)).

## Run

Three commands, in order:

```bash
# 1. Generate synthetic profiles (in ../synth-data-gen)
cd ../synth-data-gen && npm run generate

# 2. Analyze + narrate
cd ../genai-analysis && npm run analyze

# 3. Evaluate the run
npm run evaluate -- output/run-<stamp>
```

`npm run analyze` output:

- `output/run-<stamp>/analyses.json` — structured JSON, one entry per student, with citations
- `output/run-<stamp>/cohort.json` — per-student quartile rank bands per competency
- `output/run-<stamp>/narratives/<student_id>.md` — 5-section markdown report with inline clause tags, References appended verbatim
- `output/run-<stamp>/manifest.json` — run metadata, framework bundle provenance

`npm run evaluate` output (written into the same run folder):

- `evaluation.json` — objective metrics: `citationValidityRate`, `evidenceInProfileRate`, `competencyCoverageRate`, `sectionStructureComplianceRate`, `taggedSentenceRate`, ROUGE-L `groundedness` and `frameworkAlignment`, cohort band distribution, per-student flags.
- `evaluation.md` — human-readable summary. Exits non-zero when any threshold fails.

## Framework bundle (v1.1.0)

| Doc id | Source | Covers |
| --- | --- | --- |
| `slate` | internal | Fixed 7-competency rubric + 5-level proficiency scale |
| `ched-25` | [CHED CMO 25 s.2015](https://ched.gov.ph/wp-content/uploads/2017/10/CMO-no.-25-s.-2015.pdf) | BSCS, BSIT program outcomes |
| `ched-87` | [CHED CMO 87 s.2017](https://ched.gov.ph/wp-content/uploads/2018/04/CMO-87-s.-2017-BS-Computer-Engineering.pdf) | BSCpE program outcomes (Washington-Accord-aligned) |
| `cc2020` | [ACM/IEEE CC2020](https://www.acm.org/binaries/content/assets/education/curricula-recommendations/cc2020.pdf) | Knowledge areas, dispositions |
| `sfia-9` | [SFIA Foundation](https://sfia-online.org/en/sfia-9) | Professional skill codes, responsibility scale |

Citations in output take the form `[doc:clause]`, e.g. `[ched-87:bscpe-po-5]`, `[cc2020:KA-SDF]`, `[sfia-9:PROG-3]`. The evaluator verifies every tag resolves to an actual clause in the named doc.

## Configuration

See [`src/config.ts`](./src/config.ts) for the full knob list. Notable ones:

| Key | Default | Purpose |
| --- | --- | --- |
| `ANALYSIS.concurrency` | 4 | In-flight LLM calls per pass (each call is independent) |
| `ANALYSIS.temperature` | 0.3 | Pass 1 — structured, near-deterministic |
| `ANALYSIS.narrativeTemperature` | 0.5 | Pass 3 — slight variety for prose |
| `ANALYSIS.useFlex` | true | flex-tier inference (50% cheaper, 1–15 min latency) |
| `ANALYSIS.useCache` | true | Gemini context caching |
| `ANALYSIS.frameworkManifestPath` | `frameworks/manifest.json` | The bundle to load |

## Notes

- **Free-tier caching:** Gemini's free tier allocates 0 tokens of cache storage for this model, so `caches.create` fails with `RESOURCE_EXHAUSTED`; the runner catches and proceeds without caching. Paid tier gets the 50% cached-input discount.
- **SFIA licensing:** SFIA 9 descriptors in the bundle are paraphrased with canonical per-skill URLs. Used under the SFIA Personal User Licence. See [`frameworks/sfia-9.md`](./frameworks/sfia-9.md) and [SFIA's licence page](https://sfia-online.org/en/about-sfia/licensing-sfia/personal-user-licence).
- **No real student data:** this package is designed for synthetic profiles today. For real data, add an input-validation layer first.

## File map

```
src/
  types.ts              # StudentProfile, AnalysisResult, Citation, CohortComparison
  config.ts             # ANALYSIS knobs, ROLE_BRIEF, EVALUATION_RULES
  context.ts            # framework bundle loader
  prompt.ts             # system instructions + per-student prompts (Pass 1 + Pass 3)
  schema.ts             # ANALYSIS_SCHEMA
  narrative-schema.ts   # NARRATIVE_SCHEMA
  cohort.ts             # aggregateCohort (Pass 2, pure TS)
  client.ts             # shared GoogleGenAI singleton
  retry.ts              # transient-error retry w/ exponential backoff
  cache.ts              # per-pass cache creation/deletion
  analyze.ts            # analyzeStudent (Pass 1) + narrateStudent (Pass 3)
  runner.ts             # bounded-concurrency dataset loops + cache lifecycle
  index.ts              # analyze entry point
  evaluate/
    types.ts            # EvaluationResult, Thresholds
    metrics.ts          # ROUGE-L, tokenizer, summary stats
    validators.ts       # framework loader, citation/section/evidence checks
    report.ts           # evaluateRun + renderMarkdown
    index.ts            # evaluate entry point
frameworks/
  manifest.json         # doc registry + bundleVersion
  references.md         # stable bibliographic appendix
  assessment-slate.md   # 7-competency rubric + proficiency scale
  ched-cmo-25-s2015.md  # BSCS + BSIT outcomes
  ched-cmo-87-s2017.md  # BSCpE outcomes
  cc2020.md             # CC2020 KAs + dispositions
  sfia-9.md             # paraphrased SFIA 9 skills + canonical URLs
```
