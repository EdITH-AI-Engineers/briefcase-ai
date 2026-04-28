export const MODEL = "gemini-3.1-flash-lite-preview";

export const ANALYSIS = {
  // Manifest (relative to cwd) describing the framework document bundle.
  // The bundle and its references.md are read by src/context.ts and embedded
  // verbatim into every run.
  frameworkManifestPath: "frameworks/manifest.json",

  // Path (relative to cwd) to a JSON array of StudentProfile objects.
  // Point this at a synth-data-gen run once student profiles exist there.
  profilesPath: "../synth-data-gen/output/run-XXXXXXXX-XXXXXX/profiles.json",

  // Where to write analysis outputs (run-<timestamp> subfolders).
  outputDir: "output",

  // Pass 1 (structured JSON assessment) knobs.
  temperature: 0.3,

  // Pass 3 (per-student markdown narrative) knobs.
  narrativeTemperature: 0.5,

  useFlex: true,
  useCache: true,
  cacheTtlSeconds: 3600,

  // Bounded concurrency for Pass 1 and Pass 3 LLM calls. Each call is
  // independent (order preserved by indexing in runner.ts), so this is
  // safe to raise as long as the provider accepts concurrent requests.
  // 4 is a conservative default that roughly 3-4x's throughput vs.
  // sequential on flex tier; raise with care.
  concurrency: 4,
};

export const MIN_CACHE_TOKENS = 1024;

// Framework-agnostic role statement. Stays identical across frameworks
// so it can be cached alongside the framework body.
export const ROLE_BRIEF = `
You are an expert educational assessment specialist. You evaluate
self-reported student profiles of Philippine undergraduate computing
students (BS Computer Science, BS Information Technology, BS Computer
Engineering) against a multi-document skills framework, and produce
structured, evidence-based, citation-bearing analyses for use by
academic advisors, employers, and the students themselves.

Each profile renders the sections visible on the student portal:
Personal Information (full_name, headline, short_biography), Skills
(name + level + percentage), Work Experience, Honors & Awards,
Licenses & Certifications, Seminars & Trainings, and Organizations
& Memberships. Program, specialization, and year_level are account
metadata attached alongside the visible profile.
`.trim();

// Rules the model must follow on every analysis, independent of which
// framework documents are loaded. Citation discipline is strict: every
// competency rating must be traceable to a specific clause in the
// provided framework bundle.
export const EVALUATION_RULES = `
Hard rules:
  - Ground every competency rating in specific evidence drawn from
    the student's own profile (skills, licenses_certifications,
    honors_awards, short_biography, headline, work_experience,
    seminars_trainings, organizations_memberships). Never invent
    evidence. If a section is empty, treat that as genuine absence
    of evidence — do not upsell sparse profiles.
  - The "competencies" array MUST contain exactly seven entries, using
    the competency names and order defined in the "slate" document above:
      1. "Computing Foundations"
      2. "Systems & Infrastructure"
      3. "Data & Information Management"
      4. "Security, Ethics & Professional Responsibility"
      5. "Professional Communication"
      6. "Collaboration & Teamwork"
      7. "Self-Directed Learning & Innovation"
    Do not rename, merge, drop, reorder, or add competencies.
  - Use the slate's proficiency scale verbatim for the "level" field:
    "Emerging", "Developing", "Proficient", "Advanced", or
    "Not Demonstrated". Do not introduce a new scale.
  - Every competency entry must carry at least one citation. A citation
    is { doc, clause } where "doc" is one of the framework document ids
    listed above ("ched-25", "cc2020", "sfia-9" — do not cite the
    "slate" doc itself) and "clause" is a clause id defined inside that
    document (e.g., "bscs-po-3", "KA-SDF", "PROG-3"). Cite only clauses
    that actually appear in the provided framework documents — never
    invent a clause id.
  - Select the CHED clause family by program:
      BSCS  -> cite "bscs-po-*" clauses from doc "ched-25"
               (and "common-po-*" from "ched-25" for shared outcomes)
      BSIT  -> cite "bsit-po-*" clauses from doc "ched-25"
               (and "common-po-*" from "ched-25" for shared outcomes)
      BSCpE -> cite "bscpe-po-*" and "bscpe-sp-*" clauses from doc
               "ched-87". BSCpE profiles MUST NOT cite any "ched-25"
               clauses — the CHED CMOs are program-specific.
    Use cc2020 KA-* codes for knowledge evidence and DISP-* codes for
    dispositional evidence (both program-agnostic). Use sfia-9
    skill-code + level citations (e.g. "PROG-3") for professional-skill
    evidence (also program-agnostic).
  - If a slate competency has no supporting evidence in the profile,
    still include it with level="Not Demonstrated", confidence="low",
    and explain the absence in "notes"; citations in that case point
    to the clause(s) that define the competency so coverage remains
    auditable.
  - "evidence" entries must be direct quotes or close paraphrases of
    text that appears in the profile.
  - "strengths" surface the clearest demonstrated capabilities (2–4
    entries drawn from the slate competencies the student rated highest).
  - "gaps" surface the slate competencies with weak or missing evidence
    (1–3 entries); each gap must include a specific, actionable
    recommendation tied to that area.
  - Return ONLY JSON conforming to the enforced response schema.
    No prose outside the schema.
`.trim();
