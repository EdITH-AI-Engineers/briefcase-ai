export type Level =
  | "Not Demonstrated"
  | "Emerging"
  | "Developing"
  | "Proficient"
  | "Advanced";

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
    level: Level;
    score: number;
    idealScore: number;
    diagnosis: string;
    evidence: string[];
    citations: { doc: string; clause: string }[];
  }[];
  strengths: {
    area: string;
    evidence: string[];
  }[];
  gaps: {
    area: string;
    reason: string;
    recommendation: string;
    search_keywords?: string[];
  }[];
  skills: {
    hard: { name: string; rating: number }[];
    soft: { name: string; rating: number }[];
    uncategorized: { name: string; rating: number }[];
  };
  roadmap: {
    nodes: {
      id: string;
      label: string;
      detail: string;
      type: "gap" | "course" | "project" | "evidence";
      x: number;
      y: number;
      competency: string;
      objectives?: string[];
    }[];
    edges: { id: string; source: string; target: string }[];
  };
  recommendations: { title: string; provider: string; reason: string; relatedCompetency: string; url?: string }[];
  references: { id: string; title: string; url: string }[];
  narrative: string;
};
