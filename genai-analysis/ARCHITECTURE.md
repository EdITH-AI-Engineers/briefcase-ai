# genai-analysis — Architecture (Input · Process · Output)

This document is the authoritative reference for how `genai-analysis` turns student profiles into cited, framework-grounded assessments. If something here disagrees with the code, the code wins and this document should be updated.

- [Input](#input-i) — what comes into the pipeline
- [Process](#process-p) — the three-pass pipeline + evaluator
- [Output](#output-o) — artifacts produced on disk
- [Framework application](#framework-application) — which clauses feed which competencies
- [Traceability](#traceability) — from any sentence to its source

## Overview

```
  ┌──────────────┐    ┌────────────────────────────────────────────────────────┐
  │ profiles.json│───▶│ Pass 1  Pass 2  Pass 3                                 │
  └──────────────┘    │ analyze aggreg. narrate                                │
  ┌──────────────┐    │   │        │        │                                  │
  │ frameworks/  │───▶│   ▼        ▼        ▼                                  │
  │ (bundle)     │    │  JSON ─▶ cohort ─▶ markdown  + references appended     │
  └──────────────┘    └────────────────────────────────────────────────────────┘
                                              │
                                              ▼
                                    ┌───────────────────┐
                                    │ evaluate (offline)│── evaluation.{json,md}
                                    └───────────────────┘
```

The pipeline is **two LLM passes** (Pass 1 analyze, Pass 3 narrate) sandwiching a **deterministic cohort aggregation** (Pass 2). A separate **evaluator** consumes the finished run and emits objective quality metrics.

---

## Input (I)

### Student profile schema

Every input is a `StudentProfile` object (`src/types.ts`). The only required field is `id`; everything else is optional to accommodate sparse, partial, and rich portfolios alike.

```ts
type Program = "BSCS" | "BSIT" | "BSCpE" | "unknown";

type SkillLevel = "Beginner" | "Intermediate" | "Expert" | "Master";

type StudentProfile = {
  id: string;
  // Account metadata (not rendered on the public profile page)
  program?: Program;
  specialization?: string | null;   // null for year_level < 3
  year_level?: 1 | 2 | 3 | 4;
  // Personal Information section
  full_name?: string;
  headline?: string;                // optional one-line tagline
  short_biography?: string;         // first-person bio
  // Profile sections (names match the portal's section headings)
  skills?: { name: string; level: SkillLevel; percentage: number }[];
  work_experience?: { company: string; role: string; employment_type?: string | null; date_range: string; description?: string }[];
  honors_awards?: { title: string; recipient_status?: string | null; issuer: string; date: string }[];
  licenses_certifications?: { name: string; issuer: string; issue_date: string; expiry_date?: string | null }[];
  seminars_trainings?: { role?: string | null; title: string; issuer: string; date: string }[];
  organizations_memberships?: { organization: string; role: string; start_date: string; end_date?: string | null }[];
  [extra: string]: unknown;
};
```

### Realistic completeness distribution

The companion `synth-data-gen` package targets the following sparsity mix (encoded in its `CONTEXT`):

| Band | Share | Typical shape |
| --- | --- | --- |
| Sparse | ~20% | 2–5 skills, empty arrays elsewhere, possibly 1 organization membership, 1–2-sentence biography |
| Moderate | ~55% | 5–9 skills, 0–2 certifications, 0–1 award, 0–1 work experience, 1–2 organizations |
| Rich | ~20% | 8–14 skills, 2–4 certifications, 1–3 awards, 1–2 work experiences (OJT + part-time), 2–3 organizations |
| Outlier-rich | ~5% | External recognition, 3–4 certifications, multiple work experiences, leadership roles |

The analyzer does **not** upsell sparse profiles — when evidence is genuinely absent, the corresponding competency returns as `Not Demonstrated` with `confidence: "low"`.

### Program + specialization constraints

FEU Tech's verified specialization tracks (year ≥ 3 only):

- **BSCS** → Software Engineering | Data Science | Artificial Intelligence
- **BSIT** → Web and Mobile Application | Animation and Game Development | Business Analytics | Cybersecurity
- **BSCpE** → Internet of Things and Data Analytics | Network Administration and Cybersecurity

Year-1 and year-2 profiles carry `specialization: null`.

---

## Process (P)

### P.1 Framework loading

`src/context.ts#loadFramework(manifestPath)` reads `frameworks/manifest.json` and returns a `Framework` object containing:

- `bundleVersion` — e.g. `"1.3.0"`, frozen per run.
- `docs[]` — each with `id`, `version`, `title`, `url`, `content` (the raw paraphrased markdown).
- `references` — the exact text of `frameworks/references.md`, which is appended verbatim to every narrative.

The bundle in this repo (v1.3.0):

| Doc id | Source | Purpose |
| --- | --- | --- |
| `slate` | Internal | Fixed 7-competency rubric + 5-level proficiency scale |
| `ched-25` | CHED CMO 25 s.2015 (OCR-verified) | PH program outcomes for BSCS (CS01–CS10), BSIT (IT01–IT13), plus 5 common outcomes |
| `ched-87` | CHED CMO 87 s.2017 | PH program outcomes for BSCpE (ABET EC-2000 pattern, outcomes (a)–(l)) |
| `cc2020` | ACM/IEEE CC2020 | Knowledge areas (CS2013 codes), dispositions |
| `sfia-9` | SFIA Foundation | Professional skill codes + 7-level scale |

### P.2 Cache lifecycle

Each LLM pass creates its own Gemini context cache over its system instruction and deletes it in a `finally` block:

- Pass 1 cache = `ROLE_BRIEF` + framework bundle + `EVALUATION_RULES` + response-shape gloss (see `buildSystemInstruction`).
- Pass 3 cache = the same content + a `NARRATIVE MODE` block (see `buildNarrativeSystemInstruction`), so it cannot share Pass 1's cache.
- If the system instruction falls below 1024 tokens (`MIN_CACHE_TOKENS`), caching no-ops.
- On free-tier Gemini, `caches.create` fails with `RESOURCE_EXHAUSTED: limit=0` — the runner catches and proceeds without caching.

### P.3 Pass 1 — structured assessment

```
for each StudentProfile (up to ANALYSIS.concurrency in flight):
    system_instruction = cached_or_inline(framework)   # see P.2
    user_prompt        = buildStudentPrompt(student)   # profile JSON
    response_schema    = ANALYSIS_SCHEMA               # see below
    response           = gemini.generateContent(...)   # responseMimeType=json
    result             = JSON.parse(response.text)     # AnalysisResult
```

`ANALYSIS_SCHEMA` requires (`src/schema.ts`):

- `student_id`, `program`, `summary` (strings)
- `competencies[]` — exactly seven entries (enforced by `EVALUATION_RULES`), each with:
  - `name` (verbatim from the slate)
  - `level` ∈ {`Emerging`, `Developing`, `Proficient`, `Advanced`, `Not Demonstrated`}
  - `evidence[]` — quotes/paraphrases from the profile
  - `citations[]` — ≥ 1 `{doc, clause}` pairs pointing at actual bundle clauses
  - `confidence` ∈ {`high`, `medium`, `low`}, optional `notes`
- `strengths[]`, `gaps[]`

Retry policy (`src/retry.ts`): 408 / 425 / 429 / 500 / 502 / 503 / 504 + network resets retry up to 5 times with exponential backoff (1.5s → 24s with jitter). Non-transient errors abort the run with partial results preserved.

### P.4 Pass 2 — cohort aggregation (deterministic)

`src/cohort.ts#aggregateCohort(results)` maps each level to a numeric score:

```
Not Demonstrated -> 0   Emerging -> 1   Developing -> 2   Proficient -> 3   Advanced -> 4
```

For each of the 7 competency names it collects every student's score, sorts, and assigns a rank band per student:

- cohort size ≥ 5: **quartile** band (`bottom-quartile` | `below-median` | `above-median` | `top-quartile`).
- cohort size < 5: **two-way** split (`below-median` | `above-median`).

Each `AnalysisResult.cohort` is then `{ size, per_competency: [{name, rank_band}, ...] }`.

### P.5 Pass 3 — markdown narrative

```
for each StudentProfile (up to ANALYSIS.concurrency in flight):
    system_instruction = cached_or_inline(narrative_framework)   # see P.2
    user_prompt        = buildNarrativePrompt(student, analysis) # both JSONs
    response_schema    = NARRATIVE_SCHEMA
    response           = gemini.generateContent(...)
    { narrative_markdown } = JSON.parse(response.text)
    write(narratives/<id>.md, narrative_markdown + references)
```

The narrative system instruction mandates:

- Exactly these five H2 sections, in this order: `Profile Snapshot`, `Competency Assessment`, `Development Trajectory`, `Anonymous Peer Comparison`, `Outlook & Next Steps`.
- No `References` section (the runner appends `frameworks/references.md` verbatim — the model's output is discarded if it tries).
- Every substantive sentence ends with one or more inline clause tags like `[ched-25:bscs-po-3]`, `[cc2020:KA-SDF]`, `[sfia-9:PROG-3]`. Multiple tags inside one bracket separated by a space are acceptable.
- Anonymous peer language only — rank-band words ("top quartile", "bottom quartile") and the cohort size; never names or descriptors of other students.
- Second-person tone addressed to the student; no emoji, filler, or footnote-numbered references.

### P.6 Evaluator (offline, deterministic)

`npm run evaluate -- output/run-<stamp>` runs `src/evaluate/index.ts` against a finished run and emits `evaluation.json` + `evaluation.md`. No LLM calls.

**Structured metrics** (on `analyses.json`):

| Metric | Rule | Expected |
| --- | --- | --- |
| `citationValidityRate` | Fraction of `{doc, clause}` pairs whose clause appears verbatim in the named framework doc (SFIA: skill-code present). | 1.00 |
| `evidenceInProfileRate` | Fraction of `evidence` strings with ≥ `evidenceOverlapThreshold` (0.40) token-overlap vs. the serialized profile. Threshold is paraphrase-tolerant: direct quotes score near 1.0; reasonable paraphrases pass 0.40. | ≥ 0.70 |
| `competencyCoverageRate` | Fraction of students whose `competencies` exactly matches the 7-item slate (name + order). | 1.00 |
| `programSlateConsistencyRate` | Fraction of students whose CHED citations use the CHED doc matching their program (BSCS/BSIT → `ched-25`; BSCpE → `ched-87`). | ≥ 0.90 |

**Narrative metrics** (on `narratives/<id>.md`):

| Metric | Rule | Expected |
| --- | --- | --- |
| `sectionStructureComplianceRate` | Fraction of narratives with the 5 required H2 sections present and in order. | 1.00 |
| `citationValidityRate` | Same clause-existence check on inline tags. | 1.00 |
| `taggedSentenceRate` | Mean across narratives of (sentences with ≥ 1 clause tag) / (total sentences). | ≥ 0.70 |
| `groundedness` | Token-set overlap ratio: fraction of profile value tokens echoed in narrative. (ROUGE-L F1 is sensitive to candidate/reference length mismatch — for much-longer narratives vs. short profile values it under-reports; overlap ratio stays stable.) Summary: mean, stdev, min, max. | mean ≥ 0.25 |
| `frameworkAlignment` (ROUGE-L) | Per tagged sentence, F1 of LCS between sentence text and its cited clause's bullet text. Summary over all tagged sentences. | mean ≥ 0.10 |

**Cohort metrics** (on `cohort.json` + `analyses.json`):

- `bandDistribution` — fraction in each of the four quartile bands across all students × competencies.
- `programBreakdown` — per-program mean level score (0–4).
- `suspiciousPrograms` — programs whose mean score < 0.5 (usually indicates calibration drift).

**Per-student flags** (non-fatal per student; recorded for triage):

- `invalid_citation_structured` / `invalid_citation_narrative` — clause doesn't resolve.
- `evidence_not_in_profile` — evidence string lacks sufficient profile overlap.
- `missing_competency` — slate coverage broken.
- `wrong_program_clause` — e.g. BSCpE student cited `bscs-po-3`.
- `missing_section` — required narrative section absent.
- `low_tagged_sentence_rate` / `low_groundedness` / `low_framework_alignment`.

ROUGE-L implementation: word-level LCS (space-separated, alphanumerics lowercased). Pure TS, O(n·m) time, no external dependency. See `src/evaluate/metrics.ts`.

### Concurrency

`ANALYSIS.concurrency` (default `4`) caps the number of in-flight LLM calls per pass. Order is preserved via index-based assignment into a pre-allocated array. Each call is independent (retries are per-call; the shared state is the cache name, read-only to workers), so raising concurrency is safe; throughput scales sub-linearly until the provider rate-limits.

---

## Output (O)

Every run of `npm run analyze` produces:

```
genai-analysis/output/run-<YYYYMMDD-HHMMSS>/
  analyses.json     # [AnalysisResult]
  cohort.json       # { [student_id]: CohortComparison }
  narratives/
    <student_id>.md # markdown narrative + appended References
  manifest.json     # run metadata + framework bundle provenance
```

Running `npm run evaluate -- output/run-<stamp>` additionally writes:

```
output/run-<stamp>/
  evaluation.json   # structured metrics + per-student flags
  evaluation.md     # human-readable report
```

### analyses.json

```jsonc
[
  {
    "student_id": "a9b7c6d5-...",
    "program": "BSCS",
    "summary": "Maria Elena ... 4th-year BSCS ...",
    "competencies": [
      {
        "name": "Computing Foundations",
        "level": "Proficient",
        "evidence": ["Algorithm Visualizer project", "Google Data Analytics certificate"],
        "citations": [
          { "doc": "cc2020", "clause": "KA-AL" },
          { "doc": "sfia-9", "clause": "PROG-3" }
        ],
        "confidence": "high"
      },
      // ... 6 more slate competencies
    ],
    "strengths": [...],
    "gaps": [...],
    "cohort": {
      "size": 60,
      "per_competency": [
        { "name": "Computing Foundations", "rank_band": "above-median" },
        // ...
      ]
    }
  }
]
```

Stability: the 7 slate competency names and the level-scale vocabulary do not change within a bundle version; cross-run diffs are meaningful.

### cohort.json

Shape: `{ [student_id]: { size: number; per_competency: { name, rank_band }[] } }`.

### narratives/&lt;id&gt;.md

```markdown
## Profile Snapshot
...sentences ending with clause tags [cc2020:DISP-SELF].

## Competency Assessment
...

## Development Trajectory
...

## Anonymous Peer Comparison
Within your cohort of 60 students, you are in the top-quartile for Computing Foundations [cc2020:KA-SDF].

## Outlook & Next Steps
...

---

## References
<verbatim frameworks/references.md>
```

Stability: the References footer is byte-identical across every narrative in a run.

### manifest.json

```jsonc
{
  "runId": "run-20260423-...",
  "startedAt": "...",
  "finishedAt": "...",
  "status": "success" | "partial" | "failed",
  "model": "gemini-3.1-flash-lite-preview",
  "profilesPath": "/abs/path/to/profiles.json",
  "framework": {
    "manifestPath": "/abs/path/to/frameworks/manifest.json",
    "bundleVersion": "1.3.0",
    "docs": [{ "id", "version", "title", "url" }, ...]
  },
  "requestedProfiles": 60,
  "completedAnalyses": 60,
  "completedNarratives": 60,
  "cohortSize": 60,
  "temperature": 0.3,
  "narrativeTemperature": 0.5,
  "features": { "flex": true, "concurrency": 4, "analysisCache": {...}, "narrativeCache": {...} }
}
```

### evaluation.json

Shape defined in `src/evaluate/types.ts` (`EvaluationResult`). Includes the `thresholds` used, both structured and narrative metric groups, cohort-level distribution, and a `perStudent[]` array of flags.

---

## Framework application

Each of the 7 slate competencies draws citations from specific clause families. Preferred-citation discipline is enforced by `EVALUATION_RULES`.

| Competency | CC2020 / SFIA vocabulary | BSCS & BSIT → `ched-25` | BSCpE → `ched-87` |
| --- | --- | --- | --- |
| 1. Computing Foundations | `KA-SDF`, `KA-AL`, `KA-DS`, `PROG-<lvl>` | `bscs-po-1`, `bscs-po-3`, `bsit-po-1` | `bscpe-po-a`, `bscpe-po-e` |
| 2. Systems & Infrastructure | `KA-SF`, `KA-AR`, `KA-OS`, `KA-NC`, `KA-PBD`, `DESN`, `SINT`, `ITOP`, `NTDS` | `bscs-po-5`, `bsit-po-5`, `bsit-po-6` | `bscpe-po-c`, `bscpe-po-k`, `bscpe-sp-iot`, `bscpe-sp-net` |
| 3. Data & Information Management | `KA-IM`, `KA-DSA`, `DATM`, `DTAN`, `DBAD`, `DATS` | `bscs-po-2`, `bsit-po-4` | `bscpe-po-b`, `bscpe-sp-iot` |
| 4. Security, Ethics & Professional Responsibility | `KA-IAS`, `KA-SEC`, `KA-SP`, `DISP-PROF`, `DISP-RESP`, `SCTY`, `PENT` | `bscs-po-4`, `bscs-po-9`, `bsit-po-11`, `bsit-po-12`, `common-po-4` | `bscpe-po-f`, `bscpe-po-h` |
| 5. Professional Communication | `KA-HCI`, `DISP-COLLAB` | `bscs-po-8`, `bsit-po-10`, `common-po-2` | `bscpe-po-g` |
| 6. Collaboration & Teamwork | `DISP-COLLAB`, `DISP-RSPV`, `DISP-ADAPT`, `ETDL`, `LEDA`, `PRMG` | `bscs-po-7`, `bsit-po-8`, `common-po-3` | `bscpe-po-d`, `bscpe-po-l` |
| 7. Self-Directed Learning & Innovation | `DISP-SELF`, `DISP-PROAC`, `DISP-INV`, `DISP-PASS`, `INOV`, `EMRG`, `RSCH` | `bscs-po-10`, `bsit-po-13`, `common-po-1` | `bscpe-po-i`, `bscpe-po-j` |

---

## Traceability

A single narrative sentence traces end-to-end:

```
"You demonstrate Proficient capability in Computing Foundations, evidenced
by your Algorithm Visualizer project [cc2020:KA-AL sfia-9:PROG-3]."
                                      └────────────┘ └────────────┘
                                       tag #1         tag #2
```

1. Evaluator parses `[cc2020:KA-AL sfia-9:PROG-3]` → two `{doc, clause}` pairs.
2. Looks up `cc2020` in `manifest.json` → `frameworks/cc2020.md`.
3. Finds `KA-AL` at the "Algorithms & Complexity" bullet → treats that bullet text as the reference for framework-alignment ROUGE-L.
4. `references.md` entry #3 resolves `cc2020` to the canonical ACM/IEEE CC2020 PDF URL, visible at the bottom of every narrative.
5. `analyses.json` for the same student carries the same `{doc, clause}` pair under the `Computing Foundations` competency, closing the loop between structured JSON and prose.

A broken citation (e.g. `[cc2020:KA-BOGUS]`) fails at step 3 — the evaluator raises `invalid_citation_narrative` and `citationValidityRate` drops below 1.0, failing the overall run.
