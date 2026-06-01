import type { Citation, Program } from "@briefcase/shared";
import type { StudentDashboardDto, Level } from "../types/dashboard.js";
import { linkedinLearningSearchUrl, pickKeywords } from "./linkedin-search.js";

const levelScore: Record<Level, number> = {
  "Not Demonstrated": 0,
  Emerging: 25,
  Developing: 50,
  Proficient: 75,
  Advanced: 100,
};

const idealByYear: Record<number, number> = { 1: 35, 2: 50, 3: 65, 4: 80 };

const hardSkills = new Set(["typescript", "python", "sql", "javascript", "java", "c++"]);
const softSkills = new Set(["leadership", "collaboration", "communication", "tutoring"]);
const tools = new Set(["docker", "postgresql", "node.js", "react", "git"]);

const missingEvidenceByCompetency: Record<string, string[]> = {
  "Computing Foundations": [
    "algorithm implementation with tests",
    "data structure design notes",
    "complexity analysis write-up",
  ],
  "Systems & Infrastructure": [
    "deployment logs or runbook",
    "architecture diagram",
    "environment configuration evidence",
  ],
  "Data & Information Management": [
    "database schema or data model",
    "query examples",
    "data analysis output",
  ],
  "Security, Ethics & Professional Responsibility": [
    "threat model or security checklist",
    "privacy or ethics reflection",
    "secure validation evidence",
  ],
  "Professional Communication": [
    "technical brief or README improvement",
    "presentation slides",
    "peer or advisor feedback",
  ],
  "Collaboration & Teamwork": [
    "issue tracker or team milestone evidence",
    "meeting notes",
    "role summary from a team project",
  ],
  "Self-Directed Learning & Innovation": [
    "learning log",
    "prototype experiment notes",
    "tradeoff reflection for a new tool",
  ],
};

const fallbackMissingEvidence = [
  "project artifact linked to a competency gap",
  "reflection note explaining what the artifact demonstrates",
];

function ratingLabel(score: number): string {
  if (score >= 86) return "Excellent";
  if (score >= 72) return "Strong";
  if (score >= 58) return "Good";
  if (score >= 38) return "Developing";
  return "Needs Work";
}

function sparsity(profile: Record<string, unknown>): StudentDashboardDto["student"]["sparsity"] {
  const sections = ["skills", "certifications", "awards", "education", "projects", "experience"];
  const filled = sections.filter((key) => Array.isArray(profile[key]) && (profile[key] as unknown[]).length > 0).length;
  if (filled <= 1) return "Missing";
  if (filled <= 3) return "Sparse";
  if (filled <= 5) return "Complete";
  return "Rich";
}

type DashboardSkill = { name: string; rating: number };

export type FrameworkDoc = { id: string; title: string; url: string };

export type AnalysisManifest = {
  status?: string;
  framework?: {
    bundleVersion?: string;
    docs?: FrameworkDoc[];
  };
};

type RawSkill = { name: string; percentage?: number; rating?: number };
type RawGap = {
  competency?: string;
  area?: string;
  title?: string;
  reason?: string;
  recommendation?: string;
  action?: string;
  next_step?: string;
  search_keywords?: unknown;
};
type RawCompetency = { name: string; level: string; evidence?: string[]; citations?: Citation[]; notes?: string };
export type DashboardProfile = Record<string, unknown> & {
  id: string;
  full_name?: string;
  program?: Program | string;
  year_level?: number;
  skills?: RawSkill[];
};
export type DashboardAnalysis = {
  student_id?: string;
  summary?: string;
  competencies: RawCompetency[];
  gaps?: RawGap[];
};

type DashboardInput = {
  runId: string;
  profile: DashboardProfile;
  analysis: DashboardAnalysis;
  narrative: string;
  manifest: AnalysisManifest;
};

function normalizeEvidenceText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9+#.]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function isEvidenceRepresented(item: string, profileSkills: Set<string>): boolean {
  const normalizedItem = normalizeEvidenceText(item);
  if (!normalizedItem) return false;
  const itemTokens = normalizedItem.split(" ").filter((token) => token.length > 2);
  for (const skill of profileSkills) {
    if (skill === normalizedItem || skill.includes(normalizedItem) || normalizedItem.includes(skill)) return true;
    if (itemTokens.some((token) => skill === token || skill.includes(token))) return true;
  }
  return false;
}

function missingPortfolioEvidence(profile: DashboardProfile, gaps: Gap[]): string[] {
  const profileSkills = new Set((profile.skills ?? []).map((skill) => normalizeEvidenceText(skill.name)).filter(Boolean));
  const missing: string[] = [];
  const seen = new Set<string>();
  for (const gap of gaps) {
    const expected = missingEvidenceByCompetency[gap.competency] ?? [];
    for (const item of expected) {
      const key = normalizeEvidenceText(item);
      if (!key || seen.has(key) || isEvidenceRepresented(item, profileSkills)) continue;
      seen.add(key);
      missing.push(item);
      if (missing.length >= 5) return missing;
    }
  }
  if (missing.length > 0) return missing;
  return fallbackMissingEvidence.filter((item) => !isEvidenceRepresented(item, profileSkills)).slice(0, 2);
}

function skillGroups(profile: DashboardProfile, redFlags: string[], missing: string[]): StudentDashboardDto["skills"] {
  const skills = profile.skills ?? [];
  const grouped = {
    hard: [] as DashboardSkill[],
    soft: [] as DashboardSkill[],
    tools: [] as DashboardSkill[],
    domains: [] as DashboardSkill[],
  };
  for (const skill of skills) {
    const key = skill.name.toLowerCase();
    const item = { name: skill.name, rating: skill.percentage ?? skill.rating ?? 50 };
    if (hardSkills.has(key)) grouped.hard.push(item);
    else if (softSkills.has(key)) grouped.soft.push(item);
    else if (tools.has(key)) grouped.tools.push(item);
    else grouped.domains.push(item);
  }
  return {
    ...grouped,
    missing,
    redFlags,
  };
}

type CompetencyDto = StudentDashboardDto["competencies"][number];
type GapCitation = StudentDashboardDto["overview"]["topIssues"][number]["citations"][number];
type Gap = {
  competency: string;
  issue: string;
  status: string;
  recommendation: string;
  level: Level;
  score: number;
  idealScore: number;
  citations: GapCitation[];
  searchKeywords?: string[];
};

const competencyActions: Record<string, { learn: string; build: string; document: string }> = {
  "Computing Foundations": {
    learn: "Review programming, algorithms, data structures, and computing theory mapped to CC2020 SDF, AL, and DS.",
    build: "Implement a small algorithmic feature with tests and explain the data structure choices.",
    document: "Publish code, test results, and a short theory note linking the work to SDF, AL, or DS outcomes.",
  },
  "Systems & Infrastructure": {
    learn: "Study operating systems, networking, architecture, deployment, and platform-based development from the framework map.",
    build: "Deploy a service with networking, configuration, logging, and a repeatable environment setup.",
    document: "Add an architecture diagram, deployment steps, logs, and failure-handling notes as evidence.",
  },
  "Data & Information Management": {
    learn: "Review information management, data analytics, database administration, and data modelling outcomes.",
    build: "Create a data-backed feature with schema design, queries, validation, and a simple analysis view.",
    document: "Include schema notes, query examples, data dictionary, and screenshots of the analysis output.",
  },
  "Security, Ethics & Professional Responsibility": {
    learn: "Study CC2020 information assurance, security, social issues, and professional responsibility clauses.",
    build: "Add authentication, validation, secure error handling, or a privacy review to an existing project.",
    document: "Attach a threat model, ethics note, security checklist, and before-after remediation evidence.",
  },
  "Professional Communication": {
    learn: "Review the communication, documentation, presentation, and human-centered design expectations.",
    build: "Prepare a technical brief or presentation that explains one project to both technical and non-technical readers.",
    document: "Publish the brief, slides, README improvements, and advisor or peer feedback as communication evidence.",
  },
  "Collaboration & Teamwork": {
    learn: "Review teamwork, leadership, collaboration, adaptability, and project management expectations.",
    build: "Join or lead a scoped team task with assigned roles, milestones, issue tracking, and peer coordination.",
    document: "Keep meeting notes, issue history, role summary, and team outcome evidence.",
  },
  "Self-Directed Learning & Innovation": {
    learn: "Review continuous learning, innovation, emerging technology, research, and proactive learning expectations.",
    build: "Complete a self-directed prototype using an unfamiliar tool or emerging technique.",
    document: "Write a learning log, experiment notes, tradeoffs, and next-step reflection.",
  },
};

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toLevel(value: string): Level {
  return value in levelScore ? (value as Level) : "Not Demonstrated";
}

function gapCitations(competency: CompetencyDto): GapCitation[] {
  const seen = new Set<string>();
  const out: GapCitation[] = [];
  for (const citation of competency.citations) {
    if (citation.doc === "slate") continue;
    const key = `${citation.doc}:${citation.clause}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ doc: citation.doc, clause: citation.clause });
    if (out.length >= 4) break;
  }
  return out;
}

function yearLabel(year: number | null): string {
  return year ? `Year ${year}` : "this year level";
}

function cleanReason(input: string): string {
  const trimmed = input.trim();
  if (!trimmed || trimmed === "No diagnosis available.") return "";
  return trimmed;
}

function gapSummary(
  competency: CompetencyDto,
  year: number | null,
): string {
  const target = competency.idealScore;
  if (competency.level === "Not Demonstrated") {
    return `No demonstrated evidence yet; expected ${target}/100 for ${yearLabel(year)}.`;
  }
  return `Currently ${competency.level} (${competency.score}/100), expected ${target}/100 for ${yearLabel(year)}.`;
}

function normalizeGaps(
  raw: RawGap[] | undefined,
  competencies: CompetencyDto[],
  year: number | null,
): Gap[] {
  const weakCompetencies = competencies
    .filter((competency) => competency.score < competency.idealScore)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);
  const rawByCompetency = new Map<string, RawGap>();
  for (const gap of raw ?? []) {
    const item = gap;
    const competency = asText(item.competency) || asText(item.area) || asText(item.title);
    if (competency) rawByCompetency.set(competency, item);
  }

  return weakCompetencies.map((competency) => {
    const rawGap = rawByCompetency.get(competency.name);
    const rawRecommendation = rawGap ? asText(rawGap.recommendation) || asText(rawGap.action) || asText(rawGap.next_step) : "";
    const rawReason = rawGap ? asText(rawGap.reason) : "";
    const rawKeywords = rawGap?.search_keywords;
    const searchKeywords = Array.isArray(rawKeywords)
      ? rawKeywords.map(asText).filter(Boolean)
      : undefined;
    const status = gapSummary(competency, year);
    const reason = cleanReason(rawReason) || cleanReason(competency.diagnosis);
    return {
      competency: competency.name,
      issue: reason || status,
      status,
      recommendation: rawRecommendation || competencyActions[competency.name]?.build || "Add concrete portfolio evidence mapped to this competency.",
      level: competency.level,
      score: competency.score,
      idealScore: competency.idealScore,
      citations: gapCitations(competency),
      searchKeywords,
    };
  });
}

function roadmap(gaps: Gap[]): StudentDashboardDto["roadmap"] {
  const nodes: StudentDashboardDto["roadmap"]["nodes"] = [];
  const edges: StudentDashboardDto["roadmap"]["edges"] = [];
  gaps.slice(0, 3).forEach((gap, index) => {
    const y = index * 230;
    const gapId = `gap-${index}`;
    const courseId = `course-${index}`;
    const projectId = `project-${index}`;
    const evidenceId = `evidence-${index}`;
    const actions = competencyActions[gap.competency];
    const objectives = actions ? [actions.learn, actions.build, actions.document] : undefined;
    const competency = gap.competency;
    nodes.push(
      { id: gapId, label: gap.competency, detail: gap.issue, type: "gap", x: 0, y, competency, objectives },
      { id: courseId, label: "Learn", detail: actions?.learn ?? "Review the mapped framework outcomes for this competency.", type: "course", x: 270, y, competency, objectives },
      { id: projectId, label: "Build", detail: actions?.build ?? gap.recommendation, type: "project", x: 540, y, competency, objectives },
      { id: evidenceId, label: "Document", detail: actions?.document ?? "Collect artifacts, reflection notes, and advisor-reviewed evidence.", type: "evidence", x: 810, y, competency, objectives },
    );
    edges.push(
      { id: `${gapId}-${courseId}`, source: gapId, target: courseId },
      { id: `${courseId}-${projectId}`, source: courseId, target: projectId },
      { id: `${projectId}-${evidenceId}`, source: projectId, target: evidenceId },
    );
  });
  return { nodes, edges };
}

export function buildDashboard(input: DashboardInput): StudentDashboardDto {
  const competenciesRaw = input.analysis.competencies;
  const year = Number(input.profile.year_level) || null;
  const idealScore = year ? idealByYear[year] ?? 65 : 65;
  const competencies = competenciesRaw.map((competency) => {
    const level = toLevel(competency.level);
    const score = levelScore[level] ?? 0;
    return {
      name: competency.name,
      level,
      score,
      idealScore,
      diagnosis: competency.notes ?? "No diagnosis available.",
      evidence: competency.evidence ?? [],
      citations: competency.citations ?? [],
    };
  });
  const overallScore = competencies.length > 0 ? Math.round(competencies.reduce((sum, item) => sum + item.score, 0) / competencies.length) : 0;
  const gaps = normalizeGaps(input.analysis.gaps, competencies, year);
  const redFlags = gaps.map((gap) => gap.issue).filter(Boolean);
  const missingEvidence = missingPortfolioEvidence(input.profile, gaps);

  return {
    run: {
      id: input.runId,
      status: String(input.manifest.status ?? "success"),
      frameworkVersion: String(input.manifest.framework?.bundleVersion ?? "unknown"),
    },
    student: {
      id: String(input.profile.id),
      name: String(input.profile.full_name ?? input.profile.id),
      program: String(input.profile.program ?? "unknown"),
      yearLevel: year,
      sparsity: sparsity(input.profile),
    },
    overview: {
      overallScore,
      idealScore,
      ratingLabel: ratingLabel(overallScore),
      summary: String(input.analysis.summary ?? "No summary available."),
      topIssues: gaps.map((gap) => ({
        competency: gap.competency,
        level: gap.level,
        score: gap.score,
        idealScore: gap.idealScore,
        summary: gap.issue,
        status: gap.status,
        citations: gap.citations,
      })),
      quickFixes: gaps.map((gap) => gap.recommendation),
    },
    competencies,
    skills: skillGroups(input.profile, redFlags, missingEvidence),
    roadmap: roadmap(gaps),
    recommendations: gaps.flatMap((gap) => {
      const selection = pickKeywords(gap.competency, gap.recommendation, gap.searchKeywords);
      return selection.keywords.slice(0, 3).map((keyword, index) => ({
        title: index === 0
          ? `${gap.competency}: ${keyword}`
          : `Deepen with "${keyword}"`,
        provider: "LinkedIn Learning",
        reason: index === 0
          ? gap.recommendation
          : `Targeted ${gap.level.toLowerCase()} search for ${gap.competency.toLowerCase()}.`,
        relatedCompetency: gap.competency,
        source: selection.source,
        url: linkedinLearningSearchUrl({ keywords: keyword, level: gap.level }),
      }));
    }),
    references: (input.manifest.framework?.docs ?? []).map((doc) => ({ id: doc.id, title: doc.title, url: doc.url })),
    narrative: input.narrative,
  };
}
