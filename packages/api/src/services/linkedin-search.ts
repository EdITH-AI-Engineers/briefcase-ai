import type { RecommendationSource } from "@briefcase/shared";
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

function normalizeKeyword(keyword: string): string | null {
  if (/^https?:\/\//i.test(keyword.trim())) return null;

  const cleaned = keyword
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^\w .+#-]/g, "")
    .trim();

  if (cleaned.length < 2 || cleaned.length > 60) return null;
  return cleaned;
}

function uniqueKeywords(keywords: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const keyword of keywords) {
    const normalized = normalizeKeyword(keyword);
    if (!normalized) continue;

    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    result.push(normalized);
  }

  return result.slice(0, 3);
}

export type KeywordSelection = {
  keywords: string[];
  source: RecommendationSource;
};

export function pickKeywords(competency: string, fallbackHint?: string, override?: string[]): KeywordSelection {
  const overrideKeywords = uniqueKeywords(override ?? []);
  if (overrideKeywords.length > 0) return { keywords: overrideKeywords, source: "ai_keywords" };

  const curated = competencyKeywords[competency];
  if (curated && curated.length > 0) return { keywords: curated, source: "curated_competency" };

  const fallbackKeywords = uniqueKeywords(fallbackHint ? [fallbackHint] : []);
  if (fallbackKeywords.length > 0) return { keywords: fallbackKeywords, source: "gap_recommendation" };

  return {
    keywords: [competency.replace(/[^a-zA-Z0-9 ]+/g, " ").replace(/\s+/g, " ").toLowerCase().trim()],
    source: "competency_name",
  };
}
