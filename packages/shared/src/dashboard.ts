export type DashboardLevel =
  | "Not Demonstrated"
  | "Emerging"
  | "Developing"
  | "Proficient"
  | "Advanced";

export type RecommendationSource =
  | "ai_keywords"
  | "curated_competency"
  | "gap_recommendation"
  | "competency_name";

export type StudentDashboardDto = {
  run: { id: string; status: string; frameworkVersion: string };
  student: {
    id: string;
    name: string;
    program: string;
    yearLevel: number | null;
    sparsity: "Missing" | "Sparse" | "Complete" | "Rich";
  };
  overview: {
    overallScore: number;
    idealScore: number;
    ratingLabel: string;
    summary: string;
    topIssues: string[];
    quickFixes: string[];
  };
  competencies: {
    name: string;
    level: DashboardLevel;
    score: number;
    idealScore: number;
    diagnosis: string;
    evidence: string[];
    citations: { doc: string; clause: string }[];
  }[];
  skills: {
    hard: { name: string; rating: number }[];
    soft: { name: string; rating: number }[];
    tools: { name: string; rating: number }[];
    domains: { name: string; rating: number }[];
    missing: string[];
    redFlags: string[];
  };
  roadmap: {
    nodes: {
      id: string;
      label: string;
      detail: string;
      type: "gap" | "course" | "project" | "evidence";
      x: number;
      y: number;
      competency?: string;
      objectives?: string[];
    }[];
    edges: { id: string; source: string; target: string }[];
  };
  recommendations: {
    title: string;
    provider: string;
    reason: string;
    relatedCompetency: string;
    source: RecommendationSource;
    url?: string;
  }[];
  references: { id: string; title: string; url: string }[];
  narrative: string;
};
