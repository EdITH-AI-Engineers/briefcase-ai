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
    specialization: string;
    headline: string;
    biography: string;
    yearLevel: number | null;
    sparsity: "Missing" | "Sparse" | "Complete" | "Rich";
    evidenceCounts: {
      skills: number;
      projects: number;
      experience: number;
      education: number;
      certifications: number;
      awards: number;
      trainings: number;
      organizations: number;
    };
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
  learningMap: {
    programCode: string;
    programCategory: string;
    targetYearLevel: number | null;
    targetScore: number;
    summary: string;
    idealSkills: {
      name: string;
      courseCode: string;
      courseTitle: string;
      year: string;
      trimester: string;
      status: "met" | "needs-work" | "missing";
      currentRating: number | null;
      targetRating: number;
      coursewareUrl?: string;
      linkedinLearningUrl?: string;
    }[];
    nodes: {
      id: string;
      label: string;
      detail: string;
      type: "ideal" | "learn" | "practice" | "evidence";
      x: number;
      y: number;
      skill: string;
      courseCode: string;
      courseTitle: string;
      year: string;
      trimester: string;
      status: "needs-work" | "missing";
      coursewareUrl?: string;
      linkedinLearningUrl?: string;
    }[];
    edges: { id: string; source: string; target: string }[];
  };
  recommendations: { title: string; provider: string; reason: string; relatedCompetency: string; url?: string }[];
  references: { id: string; title: string; url: string }[];
  narrative: string;
};
