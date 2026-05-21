export type StudentDashboardDto = {
  run: { id: string; status: string; frameworkVersion: string };
  student: { id: string; name: string; program: string; yearLevel: number | null; sparsity: string };
  overview: { overallScore: number; idealScore: number; ratingLabel: string; summary: string; topIssues: string[]; quickFixes: string[] };
  competencies: { name: string; level: string; score: number; idealScore: number; diagnosis: string; evidence: string[]; citations: { doc: string; clause: string }[] }[];
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
      type: string;
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
