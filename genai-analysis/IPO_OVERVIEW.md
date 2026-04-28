# Student Competency Analysis — IPO Overview

**Purpose.** This document explains, at a high level, how the `genai-analysis` pipeline turns a student profile into a cited, framework-grounded competency assessment. It is written for reviewers and stakeholders; a separate `ARCHITECTURE.md` in the repo covers the same flow at implementation depth.

**One-sentence summary.** We take a student's self-reported profile, ask a large language model to assess it against a frozen bundle of academic and professional skills frameworks, deterministically aggregate the cohort, generate a per-student narrative report with inline citations, and then run an offline evaluator that verifies every citation resolves, every piece of evidence appears in the profile, and the prose stays grounded in the facts we were given.

---

## 1. The pipeline at a glance

```
  INPUT                    PROCESS                             OUTPUT
  ─────                    ───────                             ──────
  profiles.json  ┐   ┌─► Pass 1: Analyze (LLM)   ──► analyses.json
                 │   │   Pass 2: Aggregate (code) ──► cohort.json
  frameworks/    ┴──►┤   Pass 3: Narrate (LLM)   ──► narratives/<id>.md
  (5-doc bundle)     │                                (+ References footer)
                     └─► Offline Evaluator (code)──► evaluation.{json,md}
```

Two model passes sandwich one deterministic aggregation step. A fourth, entirely offline step measures quality of the output. No step calls the open web — the model sees only the profile and the bundled framework text we hand it.

---

## 2. Input — what goes in

### 2.1 Student profile

Every analysis consumes one `StudentProfile` object. The shape mirrors the six rendered sections of the FEU Tech student portal so the pipeline accepts the same profile data a student sees on their own account page. The only required field is `id`; every other field is optional so the pipeline can handle sparse first-year profiles and rich fourth-year portfolios with the same logic.

**Account metadata** (not rendered on the public profile page; read from the enrollment record):

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string (UUID) | Required. Used as the narrative filename. |
| `program` | `BSCS` / `BSIT` / `BSCpE` / `unknown` | FEU Tech offers these three undergraduate computing programs. |
| `specialization` | string / null | `null` for year levels 1–2; an enum value for year 3–4. |
| `year_level` | 1 – 4 | Anchors realistic expectations. |

**Visible profile sections** (match the portal layout one-to-one):

| Section | Field | Shape |
| --- | --- | --- |
| Personal Information | `full_name` | string |
| Personal Information | `headline` | string / null — one-line tagline |
| Personal Information | `short_biography` | string — first-person bio |
| Skills | `skills` | `{name, level, percentage}[]` — level is Beginner / Intermediate / Expert / Master; percentage is 0–100 |
| Work Experience | `work_experience` | `{company, role, employment_type?, date_range, description}[]` |
| Honors & Awards | `honors_awards` | `{title, recipient_status?, issuer, date}[]` |
| Licenses & Certifications | `licenses_certifications` | `{name, issuer, issue_date, expiry_date?}[]` |
| Seminars & Trainings | `seminars_trainings` | `{role?, title, issuer, date}[]` |
| Organizations & Memberships | `organizations_memberships` | `{organization, role, start_date, end_date?}[]` |

### 2.2 Expected sparsity mix

The companion `synth-data-gen` package produces profiles in this distribution, chosen to approximate a real FEU Tech batch:

| Band | Share | Typical shape |
| --- | --- | --- |
| Sparse | ~20% | 2–5 skills, empty arrays elsewhere, possibly 1 org membership — mostly year 1–2 |
| Moderate | ~55% | 5–9 skills, 0–2 certs, 1–2 org memberships, 0–1 work experience |
| Rich | ~20% | 8–14 skills, 2–4 certs, OJT + side engagement, officer role in an org |
| Outlier-rich | ~5% | External honors, speaker-level seminar, multiple officer roles, professional-body memberships |

The analyzer is calibrated not to upsell thin profiles — sparse students produce honest "Not Demonstrated" ratings on competencies with no evidence.

### 2.3 Framework bundle (the ground truth)

A second input to every run is a bundle of five frozen framework documents under `frameworks/`. The bundle is versioned (`manifest.json`, currently **v1.3.0**) and embedded verbatim in the model's system prompt, so every citation the model can make is drawn from text it has actually seen.

| Doc ID | Source | Canonical + stable mirror | Role in the pipeline |
| --- | --- | --- | --- |
| `slate` | Internal (this bundle) | — | Defines the seven competencies and the five-level proficiency scale used in every assessment. |
| `ched-25` | CHED CMO No. 25, s.2015 | ched.gov.ph path (Cloudflare-restricted) + Wayback stable mirror (2022-08-13 snapshot, OCR'd) | Philippine program outcomes for **BSCS** (CS01–CS10) and **BSIT** (IT01–IT13), plus 5 common outcomes §6.1(a)–(e). |
| `ched-87` | CHED CMO No. 87, s.2017 | ched.gov.ph path (Cloudflare-restricted) + Wayback stable mirror (2022-08-13 snapshot, OCR'd) | Philippine program outcomes for **BSCpE** (ABET EC-2000 pattern, outcomes (a)–(l)). |
| `cc2020` | ACM/IEEE-CS/AAAI Computing Curricula 2020 | acm.org canonical PDF | International knowledge areas (CS2013 codes such as `KA-SDF`, `KA-SEC`) and CC2020 dispositions (`DISP-*`). |
| `sfia-9` | SFIA Foundation, SFIA v9 (Oct 2024) | sfia-online.org/en/sfia-9 | Professional skill codes (e.g., `PROG`, `DATM`, `SCTY`) on a seven-level responsibility scale. |

Both CHED PDFs are rasterized at 300 DPI and OCR'd via tesseract 5; raw OCR text lives at `../evaluation-frameworks/ocr/` (outside the analysis package so it can't accidentally be fed back into the LLM context). v1.3.0 is the first bundle in which the CMO 25 paraphrases are OCR-verified line-by-line — earlier versions followed the widely-circulated CHED-PSG template, which we discovered introduced outcomes (BSCS po-11 … po-14) that do not actually exist in CMO 25. Those have been removed.

Canonical CHED URLs are currently blocked by a Cloudflare bot-challenge; the bundle carries Internet Archive Wayback snapshots as stable mirrors, and the references footer of every narrative exposes both URLs.

### 2.4 The seven competencies (the rubric)

Every student is rated on exactly these seven, in this order:

1. Computing Foundations
2. Systems & Infrastructure
3. Data & Information Management
4. Security, Ethics & Professional Responsibility
5. Professional Communication
6. Collaboration & Teamwork
7. Self-Directed Learning & Innovation

Each competency is assigned one of five levels: **Emerging · Developing · Proficient · Advanced · Not Demonstrated**. "Not Demonstrated" is reserved for genuine absence of evidence; "Advanced" is reserved for repeated or externally recognized evidence. The scale is defined in `frameworks/assessment-slate.md`.

---

## 3. Process — what happens between input and output

### 3.1 Pass 1 — Structured assessment (LLM)

For each student, the model receives:

- A **cached system instruction** that carries the role brief, the entire five-document framework bundle, and the evaluation rules (citation discipline, level scale, slate names, program-to-CHED-doc mapping).
- A **user prompt** containing just that student's profile JSON.
- A **response schema** that constrains the model to emit strict JSON.

The model returns one `AnalysisResult` per student containing:
- a short `summary`,
- exactly seven `competencies`, each with a level, an `evidence` list of direct or paraphrased quotes from the profile, and at least one `{doc, clause}` citation,
- a `strengths` list (2–4 entries) and a `gaps` list (1–3 entries, each with an actionable recommendation).

Citation discipline (enforced in the system instruction and later re-checked by the evaluator):

- **BSCS** students cite `ched-25:bscs-po-*` and `ched-25:common-po-*`.
- **BSIT** students cite `ched-25:bsit-po-*` and `ched-25:common-po-*`.
- **BSCpE** students cite `ched-87:bscpe-po-a` through `bscpe-po-l` (letter-labeled, per the CMO) and the institutional `bscpe-sp-*` specialization tags. They never cite `ched-25` — the CMOs are program-specific.
- `cc2020:KA-*` and `cc2020:DISP-*` are program-agnostic knowledge and disposition codes.
- `sfia-9:<CODE>-<level>` is the professional-skill vocabulary.

Temperature is `0.3` (conservative, low-creativity). Retries on transient errors (408/425/429/5xx and JSON-parse failures) use exponential backoff up to five attempts.

### 3.2 Pass 2 — Cohort aggregation (deterministic, no LLM)

Pure TypeScript. For each of the seven competencies, we map every student's level to a score (`Not Demonstrated → 0`, `Emerging → 1`, `Developing → 2`, `Proficient → 3`, `Advanced → 4`), sort the cohort, and assign each student a rank band:

- Cohort size ≥ 5 → quartiles (`bottom-quartile`, `below-median`, `above-median`, `top-quartile`).
- Cohort size < 5 → two-way split (`below-median`, `above-median`).

The result is attached to each student's analysis under a `cohort` field. Because this step is deterministic, the same input always produces the same peer comparison — the model never makes up ranks.

**What the "cohort" actually is.** The rank band a student is assigned is computed *only* against the other students processed in the same `npm run analyze` call — the exact set of profiles read from the `profiles.json` file fed to that run. There is no external baseline, no synthetic reference population, and no historical pool. Run the pipeline on 60 profiles and the cohort is those 60 profiles; run it on 3 profiles and the cohort is those 3 (and the splitter switches to the two-way form automatically). This is why the narrative phrases peer comparison as "the batch of N students analyzed alongside you" rather than "your peers" — the former is accurate about the comparison set, the latter would imply an external population that does not exist.

### 3.3 Pass 3 — Narrative generation (LLM)

For each student, the model receives:

- A **cached system instruction** — the same framework bundle plus a narrative-mode block that mandates exactly five H2 sections in this order: **Profile Snapshot**, **Competency Assessment**, **Development Trajectory**, **Anonymous Peer Comparison**, **Outlook & Next Steps**.
- A **user prompt** with both the student's profile JSON and the Pass 1 analysis JSON.
- A **response schema** constraining the output to a single `narrative_markdown` string.

Narrative rules the model must follow:

- Every substantive sentence ends with one or more inline clause tags, e.g. `[ched-25:bscs-po-3]` or `[cc2020:KA-AL sfia-9:PROG-3]`. Multiple tags inside one bracket are separated by a space; the doc prefix is never elided.
- Peer comparison uses only rank-band language and the cohort size — never names or descriptors of other students.
- No `References` section is written by the model; the runner appends `frameworks/references.md` verbatim after the model's output, so the references footer is byte-identical across every narrative in a run.
- Second-person tone addressed to the student, no emoji, no footnote-style references.

Temperature is `0.5` (slightly warmer, for readable prose) but still low enough to resist fabrication.

### 3.4 Offline evaluator (deterministic, no LLM)

Run with `npm run evaluate -- output/run-<stamp>`. It opens a finished run and measures, without any model call:

| Side | Metric | What it measures | Target |
| --- | --- | --- | --- |
| Structured | `citationValidityRate` | Every `{doc, clause}` pair resolves to a clause that actually appears in the named framework doc. | 1.00 |
| Structured | `evidenceInProfileRate` | Every evidence string has ≥ 0.40 token-overlap with the student's profile (paraphrase-tolerant). | ≥ 0.70 |
| Structured | `competencyCoverageRate` | Each student's `competencies` array is exactly the 7-item slate, same names and order. | 1.00 |
| Structured | `programSlateConsistencyRate` | CHED citations use the doc that matches the student's program (BSCS/BSIT → `ched-25`; BSCpE → `ched-87`). | ≥ 0.90 |
| Narrative | `sectionStructureComplianceRate` | Narrative has the five required H2 sections, in order. | 1.00 |
| Narrative | `citationValidityRate` | Same clause-existence check applied to inline tags. | 1.00 |
| Narrative | `taggedSentenceRate` | Fraction of sentences ending with at least one clause tag, averaged across narratives. | ≥ 0.70 |
| Narrative | `groundedness` (overlap ratio) | Fraction of profile-value tokens that reappear in the narrative. | mean ≥ 0.25 |
| Narrative | `frameworkAlignment` (ROUGE-L) | For each tagged sentence, LCS-based F1 against the cited clause's bullet text. | mean ≥ 0.10 |
| Cohort | `bandDistribution`, `programBreakdown`, `suspiciousPrograms` | Health checks on the quartile distribution and per-program means. | roughly uniform |

The evaluator emits `evaluation.json` (structured) and `evaluation.md` (human-readable). Failures are surfaced per-student as `flags`, e.g. `invalid_citation_narrative`, `evidence_not_in_profile`, `wrong_program_clause`, `low_groundedness`. No LLM is ever in the loop at this stage — every verdict is reproducible.

### 3.5 Operational notes

- **Concurrency.** Default four in-flight LLM calls per pass, ordered by index so output stays deterministic. A 60-profile run completes in ~10–15 minutes on Gemini flex tier.
- **Caching.** Each pass creates its own Gemini context cache over the system instruction, deleted in a `finally` block. On free-tier accounts without cache quota, the runner transparently falls back to inline system instructions.
- **Model.** Google `gemini-3.1-flash-lite-preview` with structured-output (JSON schema) enforcement. Flex tier (50% cost, 1–15-minute latency tolerance) is the default.
- **Retry safety.** Every network or parse failure retries; non-transient failures abort the run while preserving all completed work. Run state is captured in `manifest.json`.

---

## 4. Output — what comes out

Every `npm run analyze` run produces:

```
output/run-<YYYYMMDD-HHMMSS>/
  analyses.json       Structured per-student assessment (JSON array)
  cohort.json         Per-student rank band per competency
  narratives/
    <student_id>.md   Per-student markdown report + References footer
  manifest.json       Run metadata: model, bundle version, timings, counts
```

A subsequent `npm run evaluate -- output/run-<stamp>` adds:

```
  evaluation.json     All metrics + per-student flags
  evaluation.md       Human-readable evaluation report
```

### 4.1 What a narrative looks like

Each `narratives/<id>.md` is a self-contained report. Structure:

```
## Profile Snapshot
<one paragraph orientation>

## Competency Assessment
<one paragraph per competency, sentences ending in clause tags>

## Development Trajectory
<trajectory commentary>

## Anonymous Peer Comparison
Within your cohort of N students, you are in the top-quartile for …

## Outlook & Next Steps
<actionable recommendations>

---

## References
<verbatim frameworks/references.md — the four canonical sources with
both canonical and Wayback-mirror URLs>
```

Stability guarantees:
- The seven competency names and the five-level scale do not change within a bundle version — cross-run diffs are meaningful.
- The References footer is byte-identical across every narrative in a run.
- Filenames use the authoritative profile `id` (not the model's echoed `student_id`), so there is no path-injection risk.

---

## 5. Grounding and traceability

Every claim in a narrative traces to a specific line of a specific framework document:

```
"You demonstrate Proficient capability in Computing Foundations, evidenced
 by your Algorithm Visualizer project [cc2020:KA-AL sfia-9:PROG-3]."
                                        └──────┬──────┘ └──────┬──────┘
                                                tag #1          tag #2
```

1. The evaluator parses the bracket into two `{doc, clause}` pairs.
2. It looks up `cc2020` in `manifest.json` → loads `frameworks/cc2020.md` → finds `KA-AL` at the "Algorithms & Complexity" bullet. That bullet is the reference text for framework-alignment ROUGE-L.
3. The References footer of the narrative — identical to `frameworks/references.md` — resolves `cc2020` to the canonical ACM/IEEE CC2020 PDF URL.
4. The matching `analyses.json` record for the same student carries the same `{doc, clause}` pair under `Computing Foundations`, closing the loop between structured JSON and prose.

If the model ever invents a clause (e.g. `[cc2020:KA-BOGUS]`), step 2 fails and the evaluator raises `invalid_citation_narrative`, dropping `citationValidityRate` below 1.0 and failing the run.

---

## 6. Why we trust the output

| Concern | How we address it |
| --- | --- |
| **Citation hallucination** | Every clause id is verified to exist in the bundle — both at the JSON level and at the inline-tag level. Target is 1.0; any miss is surfaced as a flag. |
| **Evidence fabrication** | Every `evidence` string is token-matched against the profile (≥ 0.40 overlap, paraphrase-tolerant). Invented quotes are flagged. |
| **Slate drift** | `competencyCoverageRate` requires exactly the seven slate names in order. Missing, renamed, or extra competencies are caught deterministically. |
| **Prose that wanders** | `groundedness` measures how much of the profile actually appears in the narrative; sub-0.25 is flagged. `frameworkAlignment` measures how close each tagged sentence is to its cited clause. |
| **Program / doc mismatch** | BSCpE citations from `ched-25`, or BSCS/BSIT citations from `ched-87`, are flagged as `wrong_program_clause`. |
| **Peer-comparison fabrication** | Rank bands come from deterministic code (Pass 2). The model receives them as input and can only echo, not invent. |
| **Reference broken or moved** | Every reference in the footer carries both the canonical publisher URL and a Wayback stable-mirror URL. Readers can verify either. |
| **Framework text drift** | The bundle is versioned (`bundleVersion`). Each run's `manifest.json` captures which bundle it used. Narratives from an older bundle can still be traced to the exact paraphrases that were visible at generation time. |

---

## 7. Honest limitations

These are known and intentional — they bound the guarantees above and should travel with any use of the output.

- **CMO 25 paraphrases are OCR-verified** (tesseract 5, raw text at `evaluation-frameworks/ocr/`) but are still paraphrases, not verbatim quotations. For accreditation-level citation, retrieve the original PDF and reproduce the exact clause text.
- **CMO 87 paraphrases** are cross-checked against both text-layer extraction and OCR; they remain paraphrases.
- **CC2020 knowledge-area codes** (`KA-*`) are CS2013 codes that CC2020 adopts; we label them as CC2020-citations for convenience but they are technically shared with CS2013.
- **Dispositions (`DISP-*`)** are this bundle's synthetic short tokens for CC2020's 11 named dispositions — the tokens themselves are not CC2020's own vocabulary.
- **SFIA descriptors are paraphrased** under the SFIA Personal User Licence; per-skill canonical URLs (`sfia-online.org/en/sfia-9/skills/<CODE>`) remain authoritative.
- **The profile data is synthetic** at present. The pipeline does not know whether a student is real; grounding is only as honest as the profile it is given.
- **Narratives can drift in pronoun usage** (a known style artifact; does not affect citations) and under-represent rare outlier-rich students relative to their actual achievements. Both are documented and bounded by the evaluator rather than silently accepted.
- **The cohort is the batch, not a national sample.** See §3.2. This is not a defect, but it is a limitation worth stating — "top-quartile" in a 60-profile run is top-quartile in that 60, not in a Philippine-wide or institution-wide population.

---

## 8. Frameworks: why these four, and what we considered instead

### 8.1 Why the current four

- **CHED CMO 25 (2015) and CHED CMO 87 (2017)** are the authoritative Philippine government policy documents defining program outcomes for BSCS / BSIT / BSIS and BSCpE respectively. They are the same documents used in every Philippine higher-education institution for OBE curriculum mapping and PACUCOA/AACCUP accreditation, and are the only framework in the bundle with legal force over Philippine undergraduate computing programs.
- **ACM/IEEE-CS/AAAI Computing Curricula 2020** is the most recent international baccalaureate computing curriculum report, used worldwide for program design and benchmarking. It supplies knowledge-area codes (CS2013-derived) and disposition names that map cleanly onto individual student evidence.
- **SFIA version 9 (October 2024)** is the de-facto industry skills framework for ICT professionals, used by governments and employers globally for role design and skills assessment. It gives us a seven-level professional-responsibility scale that the five-level academic slate can map to.

These are credible, widely-accepted references in the Philippine setting: CHED CMOs are legally mandated, CC2020 is the reference point for OBE-alignment papers published by Philippine universities, and SFIA is named in the Philippine government's Department of ICT capability frameworks.

### 8.2 What we considered and rejected

Several Philippine-context frameworks were evaluated as additions or replacements and not included. The reasoning for each:

| Framework considered | What it is | Why not included |
| --- | --- | --- |
| **DICT National ICT Competency Standard (NICS)** | DICT-published end-user / teacher ICT competency tiers | NICS is calibrated for general ICT literacy (Basic, Advanced, Teacher, Professional). Its "Professional" tier exists but is thin and aimed at workplace ICT use, not undergraduate computing-program outcomes. CHED CMO + SFIA together already cover professional-skill calibration at higher resolution. Adding NICS would duplicate SFIA coverage without adding traceability. |
| **DICT Philippine Digital Workforce Competency Framework** | A DICT-led industry-facing framework | Drafted for workforce planning at the sector level, not for individual competency assessment of students. Adds sector taxonomy, not per-skill evidence. |
| **PSITE / PSITS program standards** | Philippine Society of IT Educators / Philippine Society of IT Students statements | Non-regulatory, largely aligned to the CHED CMOs they were drafted to support; would add rhetoric but not independent clauses. |
| **PTC-ACBET** *(Philippine Technological Council — Accreditation and Certification Board for Engineering & Technology)* | ABET-equivalent engineering accreditation outcomes for BSCpE | Effectively the same outcomes already in CMO 87 (both follow ABET EC-2000 (a)–(k)). The 12th outcome in CMO 87 is CHED's addition; PTC-ACBET would add nothing beyond that. |
| **AACCUP / PACUCOA institutional accreditation criteria** *(including what is sometimes loosely called "AAP" criteria)* | Institutional-level accreditation rubrics | These govern institution-level quality (faculty, facilities, governance), not per-student competency outcomes. Out of scope for per-student analysis. |

**Conclusion.** The current four-document bundle is adequate for the task. Adding DICT or institutional-accreditation frameworks would grow the system prompt without improving per-student grounding. If a future requirement brings in sector-level or institutional-level analysis (not per-student), NICS or AACCUP would become relevant and could be added as additional docs without restructuring the pipeline.

---

## 9. Summary for a reviewer

- **Inputs.** A JSON profile per student + a versioned, verifiable bundle of four academic/professional frameworks.
- **Process.** Two LLM passes (structured assessment, then narrative) separated by deterministic cohort aggregation, plus an offline deterministic evaluator.
- **Outputs.** A structured JSON dataset, a deterministic peer-comparison map, one grounded markdown narrative per student, and a full set of quality metrics.
- **Trustworthiness.** Every citation is checked to resolve; every evidence string is checked against the profile; every narrative is checked for grounding and structure; broken references surface as machine-readable flags. The model is constrained to quoting clauses it has actually been shown, never to search the web.

The end product is a per-student skills report that a student, advisor, or reviewer can read top-to-bottom and, at the bottom, click through to the exact CHED / ACM / SFIA source behind every claim.
