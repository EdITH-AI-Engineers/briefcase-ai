export type Certification = {
  name: string;
  issuer?: string;
  date?: string;
};

export type Award = {
  name: string;
  year?: number;
  description?: string;
};

export type EducationEntry = {
  institution?: string;
  degree?: string;
  field?: string;
  year?: number;
};

export type Project = {
  name: string;
  description?: string;
  tech?: string[];
};

export type Experience = {
  role: string;
  organization?: string;
  description?: string;
  duration?: string;
};

export type StudentProfile = {
  id: string;
  full_name?: string;
  description?: string;
  skills?: string[];
  certifications?: Certification[];
  awards?: Award[];
  education?: EducationEntry[];
  projects?: Project[];
  experience?: Experience[];
  [extra: string]: unknown;
};

export type Confidence = "high" | "medium" | "low";

export type CompetencyAssessment = {
  name: string;
  level: string;
  evidence: string[];
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
  summary: string;
  competencies: CompetencyAssessment[];
  strengths: Strength[];
  gaps: Gap[];
};
