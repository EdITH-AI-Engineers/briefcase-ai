import type { Level } from "../types/dashboard.js";

const LINKEDIN_LEARNING_SEARCH = "https://www.linkedin.com/learning/search";

const difficultyByLevel: Record<Level, string> = {
  "Not Demonstrated": "BEGINNER",
  Emerging: "BEGINNER",
  Developing: "INTERMEDIATE",
  Proficient: "INTERMEDIATE",
  Advanced: "ADVANCED",
};

export const competencyKeywords: Record<string, string[]> = {
  "Computing Foundations": ["programming fundamentals", "data structures and algorithms", "software engineering basics"],
  "Systems & Infrastructure": ["docker containers", "linux administration", "cloud deployment"],
  "Data & Information Management": ["sql database design", "data analysis python", "postgresql"],
  "Security, Ethics & Professional Responsibility": ["application security", "threat modeling", "owasp top 10"],
  "Professional Communication": ["technical writing", "documentation best practices", "presentation skills"],
  "Collaboration & Teamwork": ["agile teamwork", "git collaboration", "scrum fundamentals"],
  "Self-Directed Learning & Innovation": ["learning how to learn", "innovation in technology", "personal productivity"],
};

export function difficultyForLevel(level: Level): string {
  return difficultyByLevel[level] ?? "INTERMEDIATE";
}

export function linkedinLearningSearchUrl(input: {
  keywords: string;
  level?: Level;
  difficulty?: string;
}): string {
  const difficulty = input.difficulty ?? (input.level ? difficultyForLevel(input.level) : "INTERMEDIATE");
  const params = new URLSearchParams();
  params.set("keywords", input.keywords);
  params.set("entityType", "COURSE");
  params.set("difficultyLevel", difficulty);
  return `${LINKEDIN_LEARNING_SEARCH}?${params.toString()}`;
}

export function pickKeywords(competency: string, fallbackHint?: string, override?: string[]): string[] {
  if (override && override.length > 0) {
    return override.map((keyword) => keyword.trim()).filter(Boolean);
  }
  const curated = competencyKeywords[competency];
  if (curated && curated.length > 0) return curated;
  if (fallbackHint) return [fallbackHint];
  return [competency.replace(/[^a-zA-Z0-9 ]+/g, "").toLowerCase()];
}
