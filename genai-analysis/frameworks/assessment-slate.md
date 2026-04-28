# Student assessment slate (derived from CHED CMO 25 s.2015, CHED CMO 87 s.2017, CC2020, and SFIA 9)

This file defines the **fixed list of competencies** every student in this bundle is assessed against, plus the proficiency scale. The competencies are derived from and map to clauses in the other framework documents. Do not add, remove, or rename competencies mid-run — the cohort aggregation (`src/cohort.ts`) groups students by exact competency name.

## Proficiency scale (use these level names verbatim)

Every competency must be assigned exactly one of:

- **Emerging** — beginning to demonstrate the skill, usually in guided or scaffolded contexts.
- **Developing** — applies the skill in familiar situations, with occasional guidance.
- **Proficient** — consistently applies the skill independently in routine academic or work contexts.
- **Advanced** — applies the skill reliably in novel or complex contexts, including teaching, leading, or external-facing work.
- **Not Demonstrated** — no evidence of this competency appears in the student's profile.

Reserve **Not Demonstrated** for true absence of evidence; do not use it as a polite "not strong." Reserve **Advanced** for repeated or externally recognized evidence (published work, multi-semester capstone leadership, documented professional impact, etc.).

## The seven competencies (use these names verbatim)

Every analysis must return exactly these seven entries in the `competencies` array, in this order. Do not invent additional competencies. Do not merge two of these into one.

### 1. Computing Foundations

Fluency with programming, algorithms, data structures, discrete mathematics, and core computing theory. Evidence comes from skills entries naming foundational tools/languages, certifications in fundamentals, work or org roles requiring programming, and seminars/trainings on computing fundamentals.

- Maps to: `[cc2020:KA-SDF]`, `[cc2020:KA-AL]`, `[cc2020:KA-DS]`, `[sfia-9:PROG-<level>]`
- Program emphasis: BSCS → `[ched-25:bscs-po-1]`, `[ched-25:bscs-po-3]`; BSIT → `[ched-25:bsit-po-1]`; BSCpE → `[ched-87:bscpe-po-a]`, `[ched-87:bscpe-po-e]`

### 2. Systems & Infrastructure

Designing, building, deploying, and integrating computing systems — operating systems, networks, architecture, platforms, system-level concerns.

- Maps to: `[cc2020:KA-SF]`, `[cc2020:KA-AR]`, `[cc2020:KA-OS]`, `[cc2020:KA-NC]`, `[cc2020:KA-PBD]`, `[sfia-9:DESN-<level>]`, `[sfia-9:SLEN-<level>]`, `[sfia-9:SINT-<level>]`, `[sfia-9:ITOP-<level>]`, `[sfia-9:NTDS-<level>]`
- Program emphasis: BSCS → `[ched-25:bscs-po-5]`; BSIT → `[ched-25:bsit-po-5]`, `[ched-25:bsit-po-6]`; BSCpE → `[ched-87:bscpe-po-c]`, `[ched-87:bscpe-po-k]`, `[ched-87:bscpe-sp-iot]`, `[ched-87:bscpe-sp-net]`

### 3. Data & Information Management

Modelling, managing, querying, analyzing, and drawing insight from data; database design and administration; analytics fundamentals.

- Maps to: `[cc2020:KA-IM]`, `[cc2020:KA-DSA]`, `[sfia-9:DATM-<level>]`, `[sfia-9:DTAN-<level>]`, `[sfia-9:DBAD-<level>]`, `[sfia-9:DATS-<level>]`
- Program emphasis: BSCS → `[ched-25:bscs-po-2]`; BSIT → `[ched-25:bsit-po-4]`; BSCpE → `[ched-87:bscpe-po-b]`, `[ched-87:bscpe-sp-iot]`

### 4. Security, Ethics & Professional Responsibility

Security awareness and practice; ethical, legal, social, and professional issues in computing; data and user protection.

- Maps to: `[cc2020:KA-IAS]`, `[cc2020:KA-SEC]`, `[cc2020:KA-SP]`, `[cc2020:DISP-PROF]`, `[cc2020:DISP-RESP]`, `[sfia-9:SCTY-<level>]`, `[sfia-9:SCAD-<level>]`, `[sfia-9:PENT-<level>]`
- Program emphasis: BSCS → `[ched-25:bscs-po-4]`, `[ched-25:bscs-po-9]`; BSIT → `[ched-25:bsit-po-11]`, `[ched-25:bsit-po-12]`; BSCpE → `[ched-87:bscpe-po-f]`, `[ched-87:bscpe-po-h]`; BSCS/BSIT only → `[ched-25:common-po-4]`

### 5. Professional Communication

Writing, oral presentation, documentation, and technical communication; multilingual or cross-audience communication; usability and human-centered design communication.

- Maps to: `[cc2020:KA-HCI]`, `[cc2020:DISP-COLLAB]`
- Program emphasis: BSCS → `[ched-25:bscs-po-8]`; BSIT → `[ched-25:bsit-po-10]`; BSCpE → `[ched-87:bscpe-po-g]`; BSCS/BSIT only → `[ched-25:common-po-2]`

### 6. Collaboration & Teamwork

Working effectively with others, contributing to and leading teams, handling cross-disciplinary or cross-cultural collaboration; org and student-activity leadership.

- Maps to: `[cc2020:DISP-COLLAB]`, `[cc2020:DISP-RSPV]`, `[cc2020:DISP-ADAPT]`, `[sfia-9:ETDL-<level>]`, `[sfia-9:LEDA-<level>]`, `[sfia-9:PRMG-<level>]`
- Program emphasis: BSCS → `[ched-25:bscs-po-7]`; BSIT → `[ched-25:bsit-po-8]`; BSCpE → `[ched-87:bscpe-po-d]`, `[ched-87:bscpe-po-l]`; BSCS/BSIT only → `[ched-25:common-po-3]`

### 7. Self-Directed Learning & Innovation

Autonomous learning, continuous professional development, initiative, inventiveness, tracking and experimenting with emerging technology.

- Maps to: `[cc2020:DISP-SELF]`, `[cc2020:DISP-PROAC]`, `[cc2020:DISP-INV]`, `[cc2020:DISP-PASS]`, `[sfia-9:INOV-<level>]`, `[sfia-9:EMRG-<level>]`, `[sfia-9:RSCH-<level>]`
- Program emphasis: BSCS → `[ched-25:bscs-po-10]`; BSIT → `[ched-25:bsit-po-13]`; BSCpE → `[ched-87:bscpe-po-i]`, `[ched-87:bscpe-po-j]`; BSCS/BSIT only → `[ched-25:common-po-1]`

## Rating guidance

- Weight direct evidence (something the student *did* — a role they held, a certification they earned, an award they received, a seminar they presented or attended) more heavily than self-reported skills lists. A self-reported skill with a percentage is a *claim*, not a demonstration; it can support but not by itself establish a level.
- A single substantive piece of work (a substantive role, a flagship certification, a leadership position held for a full academic year) can justify **Proficient** in one competency but cannot by itself justify **Advanced**.
- **Advanced** typically requires repeated or scaled evidence: multiple work engagements, elected or appointed leadership in an organization, teaching or speaking to others, or recognition from external judges.
- When a competency has no supporting evidence, return it with `level: "Not Demonstrated"` and `confidence: "low"`, include a `notes` explanation, and cite the clause(s) that *define* the competency so coverage remains auditable.
- Year-level calibration: a 1st-year student at **Proficient** across the slate would be unusual; expect most 1st/2nd-year students to cluster at **Emerging**/**Developing** with a handful at **Proficient**. 4th-year students should show **Proficient** in most competencies.
