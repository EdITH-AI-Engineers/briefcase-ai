import { Type, type Schema } from "@google/genai";

export const MODEL = "gemini-2.5-flash-lite";

export type ColumnSpec = {
  type: Type;
  description: string;
  enum?: string[];
  nullable?: boolean;
  items?: Schema;
  properties?: Record<string, Schema>;
  required?: string[];
  propertyOrdering?: string[];
};

// Column shape mirrors the StudentProfile type consumed by genai-analysis.
// Keep field names in sync with genai-analysis/src/types.ts — the two are
// contract-coupled even though the packages don't share code.
//
// The visible-profile fields (skills, work_experience, honors_awards,
// licenses_certifications, seminars_trainings, organizations_memberships)
// mirror the six rendered sections on the student portal. The three
// account-metadata fields (program, specialization, year_level) are not
// rendered on the public profile page but travel alongside it so the
// analyzer can route CHED citations correctly.
export const COLUMNS: Record<string, ColumnSpec> = {
  id: {
    type: Type.STRING,
    description: "RFC 4122 v4 UUID, unique per profile.",
  },
  program: {
    type: Type.STRING,
    description:
      "Degree program. Rotate across the batch so the mix is roughly 35% BSCS, 35% BSIT, 30% BSCpE.",
    enum: ["BSCS", "BSIT", "BSCpE"],
  },
  specialization: {
    type: Type.STRING,
    nullable: true,
    description:
      "Specialization track, or null when the student is in year 1 or 2 (tracks are declared in year 3). MUST be null for year_level < 3 and non-null for year_level >= 3. Allowed values per program: BSCS -> 'Software Engineering', 'Data Science', 'Artificial Intelligence'. BSIT -> 'Web and Mobile Application', 'Animation and Game Development', 'Business Analytics', 'Cybersecurity'. BSCpE -> 'Internet of Things and Data Analytics', 'Network Administration and Cybersecurity'.",
  },
  year_level: {
    type: Type.INTEGER,
    description:
      "Year level 1 through 4. Distribute roughly 25% per year across the batch.",
  },
  full_name: {
    type: Type.STRING,
    description:
      "Realistic Filipino full name. Mix Tagalog, Cebuano, Ilocano, and Spanish-influenced surnames; include occasional Chinese-Filipino and Muslim-Filipino names for realism. Two given names plus a surname is common. Do not reuse a name within a batch.",
  },
  headline: {
    type: Type.STRING,
    nullable: true,
    description:
      "Optional one-line tagline shown under the name. Null when the student has left it blank (common for SPARSE profiles and most year-1/year-2 students). When present, 30-120 characters describing the student's focus or notable roles. Do not pad.",
  },
  short_biography: {
    type: Type.STRING,
    description:
      "Student-authored biography, first-person, conversational. Length varies by profile completeness (see CONTEXT): SPARSE is one or two sentences; MODERATE 2-4 sentences; RICH a short paragraph. Do not force content when the student has little to say.",
  },
  skills: {
    type: Type.ARRAY,
    description:
      "Skills list. Each entry is the skill name, a self-reported level, and a percentage. Length and level spread vary by profile completeness (see CONTEXT). Must cohere with program, specialization, and year_level. Empty array is valid for very sparse profiles.",
    items: {
      type: Type.OBJECT,
      properties: {
        name: {
          type: Type.STRING,
          description: "Short skill name; keep capitalization natural.",
        },
        level: {
          type: Type.STRING,
          description:
            "Self-reported proficiency label. One of Beginner / Intermediate / Expert / Master.",
          enum: ["Beginner", "Intermediate", "Expert", "Master"],
        },
        percentage: {
          type: Type.INTEGER,
          description:
            "Self-reported confidence 0-100, consistent with the level: Beginner 30-50, Intermediate 55-70, Expert 75-89, Master 90-98.",
        },
      },
      required: ["name", "level", "percentage"],
      propertyOrdering: ["name", "level", "percentage"],
    },
  },
  work_experience: {
    type: Type.ARRAY,
    description:
      "Work Experience section. Internships (OJT / practicum, typically year 4), part-time jobs, research assistantships, or short industry engagements. Student-organization roles belong in organizations_memberships, NOT here.",
    items: {
      type: Type.OBJECT,
      properties: {
        company: {
          type: Type.STRING,
          description: "Hosting company or organization name.",
        },
        role: {
          type: Type.STRING,
          description: "Role title at the company.",
        },
        employment_type: {
          type: Type.STRING,
          nullable: true,
          description:
            "Employment-type label shown above the date range. One of: Internship, Part-time, Full-time, Contract, null. Null when the portal shows no label.",
          enum: ["Internship", "Part-time", "Full-time", "Contract"],
        },
        date_range: {
          type: Type.STRING,
          description:
            "Free-form date range as rendered, with optional duration in parentheses. Use three-letter month + year (e.g. 'Jun 2025 - Present', 'Jan 2025 - Aug 2025 (8 months)').",
        },
        description: {
          type: Type.STRING,
          description: "What the student did and learned, 1-2 sentences.",
        },
      },
      required: ["company", "role", "date_range", "description"],
      propertyOrdering: ["company", "role", "employment_type", "date_range", "description"],
    },
  },
  honors_awards: {
    type: Type.ARRAY,
    description:
      "Honors and Awards section. Scholarships, academic honors (Dean's/President's Lister), hackathon placements, external competitions. Length varies by completeness; leave empty when the student genuinely has none.",
    items: {
      type: Type.OBJECT,
      properties: {
        title: {
          type: Type.STRING,
          description: "Award title as rendered.",
        },
        recipient_status: {
          type: Type.STRING,
          nullable: true,
          description:
            "Optional status line above the title. One of: Recipient, Winner, Finalist, Nominee, null.",
          enum: ["Recipient", "Winner", "Finalist", "Nominee"],
        },
        issuer: {
          type: Type.STRING,
          description: "Issuing body or awarding institution.",
        },
        date: {
          type: Type.STRING,
          description:
            "Full date as rendered (e.g. 'December 10, 2024'). Must be coherent with year_level.",
        },
      },
      required: ["title", "issuer", "date"],
      propertyOrdering: ["title", "recipient_status", "issuer", "date"],
    },
  },
  licenses_certifications: {
    type: Type.ARRAY,
    description:
      "Licenses and Certifications section. Academic or industry certifications, aligned to program/specialization where relevant. Leave empty for SPARSE and most year-1/year-2 profiles.",
    items: {
      type: Type.OBJECT,
      properties: {
        name: {
          type: Type.STRING,
          description: "Certification name as rendered.",
        },
        issuer: {
          type: Type.STRING,
          description:
            "Issuing organization (e.g. Cisco, AWS, Google, Microsoft, CompTIA, IBM, Oracle, an accredited university).",
        },
        issue_date: {
          type: Type.STRING,
          description:
            "Full issue date as rendered. Must be coherent with year_level.",
        },
        expiry_date: {
          type: Type.STRING,
          nullable: true,
          description:
            "Expiry date if the certification expires; null for non-expiring certs (most academic certs) and for industry certs rendered without an expiry line.",
        },
      },
      required: ["name", "issuer", "issue_date"],
      propertyOrdering: ["name", "issuer", "issue_date", "expiry_date"],
    },
  },
  seminars_trainings: {
    type: Type.ARRAY,
    description:
      "Seminars and Trainings section. Campus events, workshops, and industry talks. Role drives how the entry reads as evidence: Speaker is strong communication + self-directed-learning evidence; Facilitator/Organizer is collaboration evidence; Attendee is weaker but still counts as CPD.",
    items: {
      type: Type.OBJECT,
      properties: {
        role: {
          type: Type.STRING,
          nullable: true,
          description:
            "Participation role. One of: Speaker, Attendee, Facilitator, Organizer, Panelist, null. Null when the portal omits the label.",
          enum: ["Speaker", "Attendee", "Facilitator", "Organizer", "Panelist"],
        },
        title: {
          type: Type.STRING,
          description: "Talk or training title.",
        },
        issuer: {
          type: Type.STRING,
          description: "Hosting organization.",
        },
        date: {
          type: Type.STRING,
          description:
            "Full date as rendered. Must be coherent with year_level.",
        },
      },
      required: ["title", "issuer", "date"],
      propertyOrdering: ["role", "title", "issuer", "date"],
    },
  },
  organizations_memberships: {
    type: Type.ARRAY,
    description:
      "Organizations and Memberships section. Student organizations (FEU Tech chapters of ACM, JPCS, AITS, CpEO, GDSC) and professional-body memberships (IEEE / ACM / IEEE-CS student branches). Roles range from plain Member to elected/appointed officer titles.",
    items: {
      type: Type.OBJECT,
      properties: {
        organization: {
          type: Type.STRING,
          description: "Organization name, full form as rendered on the portal.",
        },
        role: {
          type: Type.STRING,
          description:
            "Role in the organization (e.g. Member, Webmaster, Director, Lead, President, Vice President).",
        },
        start_date: {
          type: Type.STRING,
          description: "Full start date as rendered.",
        },
        end_date: {
          type: Type.STRING,
          nullable: true,
          description:
            "End date if the role has ended; null for current roles (the portal renders these as 'Present').",
        },
      },
      required: ["organization", "role", "start_date"],
      propertyOrdering: ["organization", "role", "start_date", "end_date"],
    },
  },
};

export const CONTEXT = `
You are generating a synthetic dataset of Filipino undergraduate student
profiles from a single Metro Manila university offering BS Computer
Science (BSCS), BS Information Technology (BSIT), and BS Computer
Engineering (BSCpE). Every profile represents ONE student and must be
internally consistent across program, specialization (if any),
year_level, and every visible profile section.

The profile schema mirrors the public student-portal view at the
institution, with six rendered sections:
  - Personal Information (full_name, optional headline, short_biography)
  - Skills (name + level + percentage)
  - Work Experience (company, role, employment_type, date_range,
    description) — internships / OJT / industry engagements only.
    Student-organization roles go in organizations_memberships.
  - Honors and Awards (title, recipient_status, issuer, date)
  - Licenses and Certifications (name, issuer, issue_date, expiry_date)
  - Seminars and Trainings (role, title, issuer, date)
  - Organizations and Memberships (organization, role, start_date,
    end_date — end_date null means current)
Program, specialization, and year_level are account metadata attached
alongside the visible profile, not rendered on the public page.

INSTITUTION STRUCTURE:
  - BSCS tracks (declared year 3): Software Engineering, Data Science,
    Artificial Intelligence.
  - BSIT tracks (declared year 3): Web and Mobile Application,
    Animation and Game Development, Business Analytics, Cybersecurity.
  - BSCpE tracks (declared year 3): Internet of Things and Data
    Analytics, Network Administration and Cybersecurity.
  - OJT (practicum) happens in year 4, up to ~8 months, at one of the
    university's industry partners.

PROFILE COMPLETENESS DISTRIBUTION (match these proportions within
each batch):

  ~20% SPARSE — barely-filled portal or year-1/year-2 student.
      - headline: null
      - short_biography: 1-2 short sentences
      - skills: 2-5 items, Beginner/Intermediate only
      - work_experience: empty
      - honors_awards: empty
      - licenses_certifications: empty
      - seminars_trainings: empty
      - organizations_memberships: empty or 1 (plain Member)
    Empty arrays on optional sections are realistic here. Do NOT
    invent filler entries to pad sparse profiles.

  ~55% MODERATE — typical mid-progression student.
      - headline: null or a short tagline
      - short_biography: 2-3 sentences
      - skills: 5-9 items, mostly Intermediate with a couple of Expert
      - work_experience: 0-1 (proper OJT is year-4 only)
      - honors_awards: 0-2
      - licenses_certifications: 0-2
      - seminars_trainings: 0-1
      - organizations_memberships: 1-2 (member-level)

  ~20% RICH — upper-year students with strong portfolios.
      - headline: short tagline
      - short_biography: 3-4 sentences
      - skills: 8-14 items, mostly Expert, 1-2 Master
      - work_experience: 1-3
      - honors_awards: 2-4
      - licenses_certifications: 2-4 track-relevant
      - seminars_trainings: 1-2
      - organizations_memberships: 2-3 including an officer role

  ~5% OUTLIER-RICH — stand-out senior students.
      - headline: multi-clause tagline listing credentials/roles
      - short_biography: short paragraph, may include a LinkedIn URL
      - skills: 10-14 items, several Master
      - work_experience: 2-4 including substantive industry role
      - honors_awards: 4-7 including external recognition
      - licenses_certifications: 4-6 spread across issuers
      - seminars_trainings: 1-3 including a Speaker-level engagement
      - organizations_memberships: 3-5 including professional-body memberships

YEAR-LEVEL COHERENCE (hard rules):
  - year 1 or 2: specialization MUST be null. work_experience empty.
    licenses_certifications usually empty. Skill levels mostly
    Beginner, occasional Intermediate.
  - year 3: specialization MUST be non-null. OJT not yet completed.
  - year 4: specialization MUST be non-null. OJT experience REQUIRED
    in work_experience for RICH/OUTLIER profiles; optional for
    MODERATE; missing is fine for SPARSE year-4 profiles.

PROGRAM MIX: roughly 35% BSCS, 35% BSIT, 30% BSCpE. Rotate tracks
within each program so no one specialization dominates.

FILIPINO NAMES: mix Tagalog, Cebuano, Ilocano, and Spanish-influenced
surnames; include occasional Chinese-Filipino and Muslim-Filipino
names. Do not reuse within a batch; no placeholder names.

TONE OF short_biography: student's own voice, first person,
conversational. Sparse profiles sound sparse; do NOT upsell them.

DATE COHERENCE: all dates across sections must be plausible relative
to the student's year_level (assume "today" ~= 2026-04). Honors,
certifications, experience, seminars, and organization memberships
must fall within the student's plausible active years.
`.trim();

export const GENERATION = {
  batchSize: 10,
  totalRows: 10,
  temperature: 1.1,
  outputDir: "output",
  useFlex: true,
  useCache: false,
  cacheTtlSeconds: 3600,
};

export const MIN_CACHE_TOKENS = 1024;
