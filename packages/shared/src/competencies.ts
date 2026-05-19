export const COMPETENCY_NAMES = [
  "Computing Foundations",
  "Systems & Infrastructure",
  "Data & Information Management",
  "Security, Ethics & Professional Responsibility",
  "Professional Communication",
  "Collaboration & Teamwork",
  "Self-Directed Learning & Innovation",
] as const;

export type CompetencyName = (typeof COMPETENCY_NAMES)[number];
