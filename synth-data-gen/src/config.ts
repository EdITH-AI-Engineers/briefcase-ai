import { Type, type Schema } from "@google/genai";

export const MODEL = "gemini-3.1-flash-lite-preview";

export type ColumnSpec = {
  type: Type;
  description: string;
  enum?: string[];
  nullable?: boolean;
  items?: Schema;
};

// Column shape mirrors the StudentProfile type consumed by genai-analysis.
// Keep field names in sync with genai-analysis/src/types.ts — the two are
// contract-coupled even though the packages don't share code.
export const COLUMNS: Record<string, ColumnSpec> = {
  id: {
    type: Type.STRING,
    description: "RFC 4122 v4 UUID, unique per profile.",
  },
  full_name: {
    type: Type.STRING,
    description:
      "Realistic full name reflecting cultural diversity (scripts transliterated to Latin). Rotate countries and naming conventions across the batch.",
  },
  description: {
    type: Type.STRING,
    description:
      "Self-authored bio in the student's own voice — first-person, 2-4 sentences, conversational. Should mention their year/stage, what drew them to their field, and what they are working on now. Do not sanitize into marketing copy.",
  },
  skills: {
    type: Type.ARRAY,
    description:
      "5–12 distinct skills — mix of technical, soft, and domain-specific, coherent with the student's field and stage. Short phrases, lowercase-friendly.",
    items: { type: Type.STRING },
  },
  certifications: {
    type: Type.ARRAY,
    description:
      "0–4 certifications. Earlier-stage students often have 0–1; senior/grad students 2–4. Real-sounding names and issuers appropriate to the field.",
    items: {
      type: Type.OBJECT,
      properties: {
        name: {
          type: Type.STRING,
          description:
            "Certification name, e.g. 'AWS Certified Cloud Practitioner', 'Google Data Analytics Certificate'.",
        },
        issuer: {
          type: Type.STRING,
          description: "Issuing organization or body.",
        },
        date: {
          type: Type.STRING,
          description: "Issue date in YYYY-MM format, between 2019-01 and today.",
        },
      },
      required: ["name", "issuer", "date"],
      propertyOrdering: ["name", "issuer", "date"],
    },
  },
  awards: {
    type: Type.ARRAY,
    description:
      "0–4 awards, honors, or scholarships earned during study. Leave empty for students with no notable recognitions.",
    items: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING },
        year: {
          type: Type.INTEGER,
          description: "Year awarded, between 2018 and 2026.",
        },
        description: {
          type: Type.STRING,
          description: "One sentence describing what the award recognized.",
        },
      },
      required: ["name", "year", "description"],
      propertyOrdering: ["name", "year", "description"],
    },
  },
  education: {
    type: Type.ARRAY,
    description:
      "1–3 education entries in reverse-chronological order. Always include the current or most recent program.",
    items: {
      type: Type.OBJECT,
      properties: {
        institution: {
          type: Type.STRING,
          description:
            "Real-sounding institution name — include state schools, regional universities, community colleges, and vocational programs, not only elite names.",
        },
        degree: {
          type: Type.STRING,
          description:
            "e.g. 'B.Sc.', 'B.A.', 'M.Sc.', 'Associate of Applied Science', 'High School Diploma', 'Diploma in Practical Nursing'.",
        },
        field: {
          type: Type.STRING,
          description: "Major or concentration.",
        },
        year: {
          type: Type.INTEGER,
          description: "Expected or actual year of graduation.",
        },
      },
      required: ["institution", "degree", "field", "year"],
      propertyOrdering: ["institution", "degree", "field", "year"],
    },
  },
  projects: {
    type: Type.ARRAY,
    description:
      "1–5 academic, personal, or open-source projects relevant to the student's field. Should reflect their stage — early students: small class or hobby projects; later students: richer independent or capstone work.",
    items: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING },
        description: {
          type: Type.STRING,
          description:
            "1–2 sentences: goal, what was built or investigated, outcome.",
        },
        tech: {
          type: Type.ARRAY,
          description:
            "Tools, languages, frameworks, or methods used. Can be empty for non-technical disciplines.",
          items: { type: Type.STRING },
        },
      },
      required: ["name", "description", "tech"],
      propertyOrdering: ["name", "description", "tech"],
    },
  },
  experience: {
    type: Type.ARRAY,
    description:
      "0–3 internships, part-time jobs, research assistantships, or volunteer roles. Leave empty for students with no work history.",
    items: {
      type: Type.OBJECT,
      properties: {
        role: { type: Type.STRING },
        organization: { type: Type.STRING },
        description: {
          type: Type.STRING,
          description: "What the student did and learned, 1–2 sentences.",
        },
        duration: {
          type: Type.STRING,
          description:
            "Human-readable duration, e.g. '3 months (Summer 2024)', '1 year (part-time)', 'ongoing since 2025-09'.",
        },
      },
      required: ["role", "organization", "description", "duration"],
      propertyOrdering: ["role", "organization", "description", "duration"],
    },
  },
};

export const CONTEXT = `
You are generating a synthetic dataset of STUDENT profiles — the kind of
self-reported summary a college or university student would fill out on a
career-services portal. Each row represents ONE student and must be
internally consistent: skills align with their field and stage,
certifications fit their level, and the project and experience histories
match their timeline.

Aim for maximum diversity across:
  - disciplines (STEM, humanities, arts, business, health sciences,
    trades/vocational, and interdisciplinary programs)
  - stage (first-year undergrad through graduate/postgraduate; include
    mid-career returners and transfer students)
  - country and cultural context (spread across continents)
  - access level — not every student has prestigious internships or
    well-funded resources; include community-college students, self-taught
    learners, first-generation students, and rural or regional programs
  - career-stage coherence: early students should have fewer certifications,
    1–2 projects, lighter or no experience; later students richer portfolios.

The "description" is the student's own voice. Write in first person, 2–4
sentences, conversational, with the specifics a real student would mention
(favorite courses, what drew them to the field, what they're building or
researching right now). Do not turn it into a cover-letter or marketing pitch.

No two rows should share the same id or full_name. Avoid stereotypes and
placeholder-looking data: no "John Doe", no "Example University", no
"Test Corporation". Institution names should be real-sounding but not only
elite — include state universities, regional institutions, community
colleges, and vocational schools.
`.trim();

export const GENERATION = {
  batchSize: 20,
  totalRows: 100,
  temperature: 1.1,
  outputDir: "output",
  useFlex: true,
  useCache: true,
  cacheTtlSeconds: 3600,
};

export const MIN_CACHE_TOKENS = 1024;
