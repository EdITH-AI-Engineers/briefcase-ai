# genai-analysis

Evaluates self-reported Filipino CS / IT / Computer Engineering undergraduate student profiles against a frozen, citable, multi-document skills framework. Each per-student LLM call now returns both the structured JSON assessment and the markdown narrative, so there is no separate cohort pass or second narrative pass.

Structured output uses Gemini `responseSchema`, context caching, flex-tier inference, and bounded concurrency. The offline evaluator scores citation validity, evidence groundedness, framework alignment, narrative section structure, and related quality checks.

## Setup

```bash
npm install
cp .env.example .env   # set GEMINI_API_KEY
```

## Run

```bash
# 1. Generate synthetic profiles (in ../synth-data-gen), if needed
cd ../synth-data-gen && npm run generate

# 2. Analyze + narrate in one per-student pass
cd ../genai-analysis && npm run analyze

# 3. Evaluate the run
npm run evaluate -- output/run-<stamp>
```

`npm run analyze` writes:

- `output/run-<stamp>/analyses.json` - structured JSON assessments, one per student
- `output/run-<stamp>/narratives/<student_id>.md` - markdown report with inline clause tags and appended references
- `output/run-<stamp>/manifest.json` - run metadata and framework provenance

## Configuration

See [`src/config.ts`](./src/config.ts) for the full knob list.

| Key | Purpose |
| --- | --- |
| `ANALYSIS.concurrency` | In-flight per-student LLM calls |
| `ANALYSIS.temperature` | Combined assessment+narrative response temperature |
| `ANALYSIS.useFlex` | Gemini flex-tier inference |
| `ANALYSIS.useCache` | Gemini context caching |
| `ANALYSIS.frameworkManifestPath` | Framework bundle manifest to load |

## File Map

```text
src/
  types.ts              # StudentProfile, AnalysisResult, NarrativeResult
  config.ts             # ANALYSIS knobs, ROLE_BRIEF, EVALUATION_RULES
  context.ts            # framework bundle loader
  prompt.ts             # combined assessment+narrative system instruction
  schema.ts             # ANALYSIS_SCHEMA + STUDENT_ASSESSMENT_SCHEMA
  narrative-schema.ts   # nested narrative shape
  client.ts             # shared GoogleGenAI singleton
  retry.ts              # transient-error retry with exponential backoff
  cache.ts              # combined-pass cache creation/deletion
  analyze.ts            # analyzeStudent combined per-student call
  runner.ts             # bounded-concurrency dataset loop + cache lifecycle
  index.ts              # analyze entry point
  evaluate/             # offline quality evaluator
frameworks/
  manifest.json         # doc registry + bundleVersion
  references.md         # stable bibliographic appendix
  assessment-slate.md   # 7-competency rubric + proficiency scale
  ched-cmo-25-s2015.md  # BSCS + BSIT outcomes
  ched-cmo-87-s2017.md  # BSCpE outcomes
  cc2020.md             # CC2020 KAs + dispositions
  sfia-9.md             # paraphrased SFIA 9 skills + canonical URLs
```
