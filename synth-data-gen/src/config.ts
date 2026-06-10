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

// Core portal fields mirror the StudentProfile type consumed by genai-analysis.
// Broader evidence aliases are accepted by StudentProfile's extra-field index
// signature and consumed by dashboard/import paths.
//
// The profile fields include the six rendered student-portal sections plus
// broader evidence aliases used by the dashboard/import pipeline. The three
// account-metadata fields (program, specialization, year_level) are not
// rendered on the public profile page but travel alongside it so the analyzer
// can route CHED citations correctly.
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
      "Skills list. Each entry is the skill name, a self-reported level, and a percentage. Generate a broader mix than a minimal profile: include programming languages, tools, platforms, methods, and 2-4 professional/soft skills when plausible. Length and level spread vary by profile completeness (see CONTEXT). Must cohere with program, specialization, and year_level. Skills do not need dates.",
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
  certifications: {
    type: Type.ARRAY,
    description:
      "General Certifications section for imported resume evidence. Use only for certifications not already represented in licenses_certifications. Each entry must include an issue date in 2026 when the profile has recent certification evidence; expiry_date is null for non-expiring certificates.",
    items: {
      type: Type.OBJECT,
      properties: {
        name: {
          type: Type.STRING,
          description: "Certification or certificate name.",
        },
        issuer: {
          type: Type.STRING,
          description: "Issuing organization, school, vendor, or training provider.",
        },
        issue_date: {
          type: Type.STRING,
          description: "Full issue date as rendered, preferably in 2026 for recent evidence.",
        },
        expiry_date: {
          type: Type.STRING,
          nullable: true,
          description: "Expiry date if applicable; null when it does not expire or is not shown.",
        },
      },
      required: ["name", "issuer", "issue_date"],
      propertyOrdering: ["name", "issuer", "issue_date", "expiry_date"],
    },
  },
  licenses_certifications: {
    type: Type.ARRAY,
    description:
      "Licenses and Certifications section. Academic or industry certifications, aligned to program/specialization where relevant. Leave empty for SPARSE and most year-1/year-2 profiles. Use issue dates in 2026 for this year's evidence when present.",
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
            "Full issue date as rendered. Prefer a 2026 date for recent evidence; otherwise keep it coherent with year_level.",
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
  awards: {
    type: Type.ARRAY,
    description:
      "General Awards section for imported resume evidence. Use only for awards not already represented in honors_awards. Each entry has a date; prefer 2026 for current-year awards.",
    items: {
      type: Type.OBJECT,
      properties: {
        title: {
          type: Type.STRING,
          description: "Award title.",
        },
        recipient_status: {
          type: Type.STRING,
          nullable: true,
          description:
            "Optional status line. One of: Recipient, Winner, Finalist, Nominee, null.",
          enum: ["Recipient", "Winner", "Finalist", "Nominee"],
        },
        issuer: {
          type: Type.STRING,
          description: "Issuing body or awarding institution.",
        },
        date: {
          type: Type.STRING,
          description: "Full award date as rendered, preferably in 2026.",
        },
      },
      required: ["title", "issuer", "date"],
      propertyOrdering: ["title", "recipient_status", "issuer", "date"],
    },
  },
  honors_awards: {
    type: Type.ARRAY,
    description:
      "Honors and Awards section. Scholarships, academic honors (Dean's/President's Lister), hackathon placements, external competitions. Length varies by completeness; leave empty when the student genuinely has none. Use 2026 dates for this year's honors when present.",
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
            "Full date as rendered (e.g. 'May 18, 2026'). Must be coherent with year_level.",
        },
      },
      required: ["title", "issuer", "date"],
      propertyOrdering: ["title", "recipient_status", "issuer", "date"],
    },
  },
  education: {
    type: Type.ARRAY,
    description:
      "Education section. Include the current degree as a date range and optionally one recent academic program, microcredential, or exchange experience. Do not overfill. Current undergraduate education should overlap 2026.",
    items: {
      type: Type.OBJECT,
      properties: {
        school: {
          type: Type.STRING,
          description: "School or institution name.",
        },
        degree: {
          type: Type.STRING,
          description: "Degree, program, or academic credential.",
        },
        date_range: {
          type: Type.STRING,
          description:
            "Academic time frame as rendered, e.g. 'Aug 2022 - Present' or 'Aug 2022 - Jun 2026'. Must overlap 2026 for the current degree.",
        },
        description: {
          type: Type.STRING,
          nullable: true,
          description: "Optional short note about track, thesis, academic focus, or relevant coursework.",
        },
      },
      required: ["school", "degree", "date_range"],
      propertyOrdering: ["school", "degree", "date_range", "description"],
    },
  },
  projects: {
    type: Type.ARRAY,
    description:
      "Projects section. Academic, capstone, hackathon, open-source, or personal projects. Each project must include a date_range/time frame, and current-year evidence should overlap 2026 (e.g. 'Jan 2026 - Mar 2026' or 'Feb 2026 - Present').",
    items: {
      type: Type.OBJECT,
      properties: {
        title: {
          type: Type.STRING,
          description: "Project title.",
        },
        role: {
          type: Type.STRING,
          nullable: true,
          description: "Student's role, or null when the profile does not specify one.",
        },
        date_range: {
          type: Type.STRING,
          description: "Project time frame as rendered; must overlap 2026.",
        },
        technologies: {
          type: Type.ARRAY,
          description: "Short technology, tool, or method names used in the project.",
          items: { type: Type.STRING },
        },
        description: {
          type: Type.STRING,
          description: "One or two sentences describing what was built and what evidence it gives.",
        },
      },
      required: ["title", "date_range", "technologies", "description"],
      propertyOrdering: ["title", "role", "date_range", "technologies", "description"],
    },
  },
  experience: {
    type: Type.ARRAY,
    description:
      "General Experience section for imported resume evidence. Use only for non-duplicate internships, assistantships, freelance, volunteer, or industry engagements not already in work_experience. Each entry has a date_range that overlaps 2026 when it is current-year evidence.",
    items: {
      type: Type.OBJECT,
      properties: {
        company: {
          type: Type.STRING,
          description: "Hosting company, lab, client, or organization name.",
        },
        role: {
          type: Type.STRING,
          description: "Role title.",
        },
        employment_type: {
          type: Type.STRING,
          nullable: true,
          description:
            "Experience-type label. One of: Internship, Part-time, Full-time, Contract, Volunteer, Research, Freelance, null.",
          enum: ["Internship", "Part-time", "Full-time", "Contract", "Volunteer", "Research", "Freelance"],
        },
        date_range: {
          type: Type.STRING,
          description:
            "Free-form date range as rendered; use 2026 ranges for this year's evidence.",
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
  work_experience: {
    type: Type.ARRAY,
    description:
      "Work Experience section. Internships (OJT / practicum, typically year 4), part-time jobs, research assistantships, or short industry engagements. Student-organization roles belong in organizations_memberships, NOT here. Each entry has a date_range; current-year work should overlap 2026.",
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
            "Free-form date range as rendered, with optional duration in parentheses. Use three-letter month + year (e.g. 'Jan 2026 - Present', 'Feb 2026 - May 2026 (4 months)').",
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
  seminars_trainings: {
    type: Type.ARRAY,
    description:
      "Seminars and Trainings section. Campus events, workshops, and industry talks. Role drives how the entry reads as evidence: Speaker is strong communication + self-directed-learning evidence; Facilitator/Organizer is collaboration evidence; Attendee is weaker but still counts as CPD. Use 2026 dates for this year's seminars.",
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
            "Full date as rendered, preferably in 2026. Must be coherent with year_level.",
        },
      },
      required: ["title", "issuer", "date"],
      propertyOrdering: ["role", "title", "issuer", "date"],
    },
  },
  organizations_memberships: {
    type: Type.ARRAY,
    description:
      "Organizations and Memberships section. Student organizations (FEU Tech chapters of ACM, JPCS, AITS, CpEO, GDSC) and professional-body memberships (IEEE / ACM / IEEE-CS student branches). Roles range from plain Member to elected/appointed officer titles. Membership dates should overlap 2026 for current roles.",
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
institution and the broader dashboard import format. It contains these
profile/evidence sections:
  - Personal Information (full_name, optional headline, short_biography)
  - Skills (name + level + percentage; no dates)
  - Certifications (name, issuer, issue_date, expiry_date)
  - Licenses and Certifications (name, issuer, issue_date, expiry_date)
  - Awards (title, recipient_status, issuer, date)
  - Honors and Awards (title, recipient_status, issuer, date)
  - Education (school, degree, date_range, description)
  - Projects (title, role, date_range, technologies, description)
  - Experience (company, role, employment_type, date_range, description)
  - Work Experience (company, role, employment_type, date_range,
    description) — internships / OJT / industry engagements only.
    Student-organization roles go in organizations_memberships.
  - Seminars and Trainings (role, title, issuer, date)
  - Organizations and Memberships (organization, role, start_date,
    end_date — end_date null means current)
Alias pairs (certifications/licenses_certifications,
awards/honors_awards, experience/work_experience) must not duplicate the
exact same evidence item. Put portal-style entries in the longer portal
field names and use the shorter aliases for imported resume-style items
when a profile is rich enough to have both.
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
      - skills: 5-8 items, Beginner/Intermediate only
      - education: 1 current-degree entry with a date range
      - projects: 0-1 simple class project with a 2026 date_range
      - work_experience: empty
      - experience: empty
      - awards: empty
      - honors_awards: empty
      - certifications: empty
      - licenses_certifications: empty
      - seminars_trainings: empty
      - organizations_memberships: empty or 1 (plain Member)
    Empty arrays on optional sections are realistic here. Do NOT
    invent filler entries to pad sparse profiles.

  ~55% MODERATE — typical mid-progression student.
      - headline: null or a short tagline
      - short_biography: 2-3 sentences
      - skills: 8-12 items, mostly Intermediate with a couple of Expert
      - education: 1 current-degree entry, optional academic program
      - projects: 1-3 class, portfolio, or hackathon projects with 2026 ranges
      - experience: 0-1 non-duplicate assistantship/freelance/volunteer entry
      - work_experience: 0-1 (proper OJT is year-4 only)
      - awards: 0-1
      - honors_awards: 0-2
      - certifications: 0-1
      - licenses_certifications: 0-2
      - seminars_trainings: 0-1
      - organizations_memberships: 1-2 (member-level)

  ~20% RICH — upper-year students with strong portfolios.
      - headline: short tagline
      - short_biography: 3-4 sentences
      - skills: 12-18 items, mostly Expert, 1-2 Master
      - education: 1-2 entries
      - projects: 3-5 substantial projects with 2026 ranges
      - experience: 1-2 non-duplicate assistantship/freelance/research entries
      - work_experience: 1-3
      - awards: 1-2
      - honors_awards: 2-4
      - certifications: 1-2
      - licenses_certifications: 2-4 track-relevant
      - seminars_trainings: 1-2
      - organizations_memberships: 2-3 including an officer role

  ~5% OUTLIER-RICH — stand-out senior students.
      - headline: multi-clause tagline listing credentials/roles
      - short_biography: short paragraph, may include a LinkedIn URL
      - skills: 16-22 items, several Master
      - education: 1-3 entries
      - projects: 5-7 substantial projects with 2026 ranges
      - experience: 2-3 non-duplicate assistantship/freelance/research entries
      - work_experience: 2-4 including substantive industry role
      - awards: 2-3
      - honors_awards: 4-7 including external recognition
      - certifications: 2-3
      - licenses_certifications: 4-6 spread across issuers
      - seminars_trainings: 1-3 including a Speaker-level engagement
      - organizations_memberships: 3-5 including professional-body memberships

YEAR-LEVEL COHERENCE (hard rules):
  - year 1 or 2: specialization MUST be null. work_experience and
    experience empty. licenses_certifications and certifications usually
    empty. Skill levels mostly Beginner, occasional Intermediate.
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

DATE COHERENCE: assume today is June 10, 2026. Skills do not carry
dates. Sections that represent evidence over time must include a time
field only when it naturally belongs there:
  - projects, experience, work_experience, education: date_range.
  - organizations_memberships: start_date and end_date.
  - certifications and licenses_certifications: issue_date and optional
    expiry_date.
  - awards, honors_awards, seminars_trainings: date.
Generated current-year evidence should land in 2026. Every project
date_range must overlap 2026. Current education and current memberships
must overlap 2026. Experience/work_experience should overlap 2026 when
the entry is meant to be this year's evidence. Historical dates are fine
only when they are plausible for the student's year_level and do not
pretend to be current-year evidence.
`.trim();

export const GENERATION = {
  batchSize: 15,
  totalRows: 15,
  temperature: 1.1,
  outputDir: "output",
  useFlex: true,
  useCache: false,
  cacheTtlSeconds: 3600,
};

export const MIN_CACHE_TOKENS = 1024;
