export type Program = "BSCS" | "BSIT" | "BSCpE" | "unknown";

// Profile field shapes mirror the public student-portal profile page, which
// renders six sections: Personal Information, Skills, Work Experience,
// Honors & Awards, Licenses & Certifications, Seminars & Trainings, and
// Organizations & Memberships. The portal does not expose Projects or
// Education as distinct sections — those were part of an earlier synthetic
// schema and are now folded into biography / work experience where they fit.

export type SkillLevel = "Beginner" | "Intermediate" | "Expert" | "Master";

export type SkillEntry = {
  name: string;
  level: SkillLevel;
  // Self-reported confidence on a 0–100 scale, as shown on the portal
  // (e.g. "Expert (82%)", "Master (92%)"). Keep as a number, not a string.
  percentage: number;
};

export type WorkExperienceEntry = {
  company: string;
  role: string;
  // Optional employment-type label shown above the date range on the
  // portal, e.g. "Internship", "Part-time", "Full-time". Omit for roles
  // where the portal shows no such label.
  employment_type?: string | null;
  // Free-form date-range label as displayed, e.g. "Dec 2024 - Aug 2025"
  // or "Aug 2025 - Aug 2025 (Less than a month)".
  date_range: string;
  description?: string;
};

export type AwardEntry = {
  title: string;
  // Optional recipient-status line shown above the title, e.g. "Recipient",
  // "Winner", "Finalist". Null when the portal omits it.
  recipient_status?: string | null;
  issuer: string;
  // Full date string as rendered, e.g. "December 10, 2024".
  date: string;
};

export type CertificationEntry = {
  name: string;
  issuer: string;
  // Full date string, e.g. "January 27, 2024".
  issue_date: string;
  // Null when the certification does not expire.
  expiry_date?: string | null;
};

export type SeminarTrainingEntry = {
  // Optional participation role, e.g. "Speaker", "Attendee", "Facilitator".
  role?: string | null;
  title: string;
  issuer: string;
  date: string;
};

export type OrganizationEntry = {
  organization: string;
  role: string;
  // Full date strings. end_date is "Present" (or null) for current roles.
  start_date: string;
  end_date?: string | null;
};

export type StudentProfile = {
  id: string;

  // --- Account metadata (not rendered on the public profile page;
  //     derived from the student's enrollment record at FEU Tech).
  //     Needed by the analyzer to route CHED citations correctly. ---
  program?: Program;
  specialization?: string | null;
  year_level?: 1 | 2 | 3 | 4;

  // --- Personal Information section ---
  full_name?: string;
  // One-line tagline under the name, e.g.
  // "GitHub Campus Expert | Cloud Engineer @ Kollab | 5x GitHub".
  // Optional — many students leave this blank.
  headline?: string;
  // Multi-sentence free text, first-person. Maps to the portal's
  // "Short Biography" block.
  short_biography?: string;

  // --- Profile sections (names match the portal's section headings) ---
  skills?: SkillEntry[];
  work_experience?: WorkExperienceEntry[];
  honors_awards?: AwardEntry[];
  licenses_certifications?: CertificationEntry[];
  seminars_trainings?: SeminarTrainingEntry[];
  organizations_memberships?: OrganizationEntry[];

  [extra: string]: unknown;
};

export type Confidence = "high" | "medium" | "low";

// A citation ties an assessment claim to a specific framework clause.
// `doc` matches a framework doc id from frameworks/manifest.json
// (e.g., "ched-25", "cc2020", "sfia-9"); `clause` is a clause ID
// defined in that doc (e.g., "bscs-po-3", "KA-SDF", "PROG-3").
export type Citation = {
  doc: string;
  clause: string;
};

export type CompetencyAssessment = {
  name: string;
  level: string;
  evidence: string[];
  citations: Citation[];
  confidence: Confidence;
  notes?: string;
};

export type Strength = {
  area: string;
  evidence: string[];
};

export type Gap = {
  area: string;
  reason: string;
  recommendation: string;
};

export type AnalysisResult = {
  student_id: string;
  program: Program;
  summary: string;
  competencies: CompetencyAssessment[];
  strengths: Strength[];
  gaps: Gap[];
};

export type NarrativeResult = {
  student_id: string;
  narrative_markdown: string;
};

export type StudentAssessmentResult = {
  analysis: AnalysisResult;
  narrative: NarrativeResult;
};
