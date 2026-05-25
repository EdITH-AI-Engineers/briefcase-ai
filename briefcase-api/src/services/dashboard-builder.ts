import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Level, StudentDashboardDto } from "../types/dashboard.js";
import { linkedinLearningSearchUrl, pickKeywords } from "./linkedin-search.js";

type AnyRecord = Record<string, unknown>;
type CompetencyDto = StudentDashboardDto["competencies"][number];
type SkillBucket = StudentDashboardDto["skills"]["hard"];

type DashboardGap = {
  competency: string;
  issue: string;
  recommendation: string;
  level: Level;
  searchKeywords?: string[];
  actions: {
    learn: string;
    build: string;
    document: string;
  };
};

type GapSource = {
  name: string;
  raw?: AnyRecord;
  competency?: CompetencyDto;
};

type SkillKind = "hard" | "soft" | "uncategorized";

const levelScore: Record<Level, number> = {
  "Not Demonstrated": 0,
  Emerging: 25,
  Developing: 50,
  Proficient: 75,
  Advanced: 100,
};

const idealByYear: Record<number, number> = { 1: 35, 2: 50, 3: 65, 4: 80 };
const genaiSkillsPath = fileURLToPath(new URL("../../../genai-analysis/src/skills.ts", import.meta.url));
let cachedSkillKinds: Map<string, SkillKind> | null = null;

function isRecord(value: unknown): value is AnyRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asTextArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asLevel(value: unknown): Level {
  return typeof value === "string" && value in levelScore ? value as Level : "Not Demonstrated";
}

function asRecords(value: unknown): AnyRecord[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function normalizeSkillName(name: string): string {
  return name.trim().toLowerCase();
}

function loadSkillKinds(): Map<string, SkillKind> {
  if (cachedSkillKinds) return cachedSkillKinds;
  const skillKinds = new Map<string, SkillKind>();

  try {
    const source = readFileSync(genaiSkillsPath, "utf8");
    const entryPattern = /\["([^"]+)",\s*"(hard|soft)"\]/g;
    let match: RegExpExecArray | null;
    while ((match = entryPattern.exec(source))) {
      skillKinds.set(normalizeSkillName(match[1]), match[2] as SkillKind);
    }
  } catch {
    // If the analysis package is unavailable, unknown skills remain uncategorized.
  }

  cachedSkillKinds = skillKinds;
  return skillKinds;
}

function classifyFallbackSkill(name: string): SkillKind {
  return loadSkillKinds().get(normalizeSkillName(name)) ?? "uncategorized";
}

function ratingLabel(score: number): string {
  if (score >= 86) return "Excellent";
  if (score >= 72) return "Strong";
  if (score >= 58) return "Good";
  if (score >= 38) return "Developing";
  return "Needs Work";
}

function sparsity(profile: AnyRecord): StudentDashboardDto["student"]["sparsity"] {
  const sections = [
    "skills",
    "certifications",
    "licenses_certifications",
    "awards",
    "honors_awards",
    "education",
    "projects",
    "experience",
    "work_experience",
    "seminars_trainings",
    "organizations_memberships",
  ];
  const filled = sections.filter((key) => Array.isArray(profile[key]) && (profile[key] as unknown[]).length > 0).length;
  if (filled <= 1) return "Missing";
  if (filled <= 3) return "Sparse";
  if (filled <= 6) return "Complete";
  return "Rich";
}

function skillRating(skill: AnyRecord): number {
  return asNumber(skill.rating) ?? asNumber(skill.percentage) ?? 50;
}

function addSkill(grouped: {
  hard: SkillBucket;
  soft: SkillBucket;
  uncategorized: SkillBucket;
}, skill: AnyRecord, preferredBucket?: "hard" | "soft" | "uncategorized") {
  const name = asText(skill.name);
  if (!name) return;

  const item = { name, rating: skillRating(skill) };
  if (preferredBucket) grouped[preferredBucket].push(item);
  else {
    const kind = classifyFallbackSkill(name);
    if (kind === "hard") grouped.hard.push(item);
    else if (kind === "soft") grouped.soft.push(item);
    else grouped.uncategorized.push(item);
  }
}

function skillGroups(profile: AnyRecord, analysis: AnyRecord): StudentDashboardDto["skills"] {
  const grouped = {
    hard: [] as SkillBucket,
    soft: [] as SkillBucket,
    uncategorized: [] as SkillBucket,
  };

  if (isRecord(analysis.skills)) {
    for (const skill of asRecords(analysis.skills.hard)) addSkill(grouped, skill, "hard");
    for (const skill of asRecords(analysis.skills.soft)) addSkill(grouped, skill, "soft");
    for (const skill of asRecords(analysis.skills.uncategorized)) addSkill(grouped, skill, "uncategorized");
  }

  const hasGeneratedSkills = Object.values(grouped).some((bucket) => bucket.length > 0);
  if (!hasGeneratedSkills) {
    for (const skill of asRecords(profile.skills)) addSkill(grouped, skill);
  }

  for (const key of Object.keys(grouped) as Array<keyof typeof grouped>) {
    grouped[key] = grouped[key].filter((skill, index, all) => all.findIndex((item) => item.name === skill.name) === index);
  }

  return {
    ...grouped,
  };
}

function strengths(raw: unknown): StudentDashboardDto["strengths"] {
  return asRecords(raw).map((item) => ({
    area: asText(item.area) || asText(item.title) || "Generated Strength",
    evidence: asTextArray(item.evidence),
  }));
}

function analysisGaps(raw: unknown): StudentDashboardDto["gaps"] {
  return asRecords(raw).map((item) => {
    const keywords = asTextArray(item.search_keywords ?? item.searchKeywords ?? item.keywords);
    return {
      area: asText(item.area) || asText(item.competency) || asText(item.title) || "Generated Gap",
      reason: asText(item.reason) || asText(item.issue) || asText(item.description),
      recommendation: asText(item.recommendation) || asText(item.action) || asText(item.next_step) || asText(item.nextStep),
      ...(keywords.length > 0 ? { search_keywords: keywords } : {}),
    };
  });
}

function citations(value: unknown): CompetencyDto["citations"] {
  return asRecords(value)
    .map((item) => ({ doc: asText(item.doc), clause: asText(item.clause) }))
    .filter((item) => item.doc && item.clause);
}

function competencyBasis(competency: CompetencyDto): string {
  const labels = competency.citations
    .filter((citation) => citation.doc !== "slate")
    .slice(0, 2)
    .map((citation) => `${citation.doc}:${citation.clause}`);
  return labels.length > 0 ? `Framework basis: ${labels.join(", ")}.` : "Framework basis: generated course assessment.";
}

function competencyIssue(competency: CompetencyDto): string {
  const evidence = competency.evidence.length > 0
    ? `Current evidence: ${competency.evidence.slice(0, 2).join(", ")}.`
    : "Current evidence is sparse or absent.";
  return `${competency.level} vs ideal ${competency.idealScore}/100. ${evidence} ${competencyBasis(competency)}`;
}

function parseCompetencies(raw: unknown, idealScore: number): CompetencyDto[] {
  return asRecords(raw).map((item) => {
    const level = asLevel(item.level);
    return {
      name: asText(item.name) || "Unknown Competency",
      level,
      score: levelScore[level],
      idealScore,
      diagnosis: asText(item.notes) || asText(item.diagnosis) || "No diagnosis available.",
      evidence: asTextArray(item.evidence),
      citations: citations(item.citations),
    };
  });
}

function rawAction(raw: AnyRecord | undefined, keys: string[]): string {
  if (!raw) return "";

  if (isRecord(raw.actions)) {
    for (const key of keys) {
      const value = asText(raw.actions[key]);
      if (value) return value;
    }
  }

  for (const key of keys) {
    const value = asText(raw[key]);
    if (value) return value;
  }
  return "";
}

function searchKeywords(raw: AnyRecord | undefined): string[] | undefined {
  if (!raw) return undefined;
  const values = asTextArray(raw.search_keywords ?? raw.searchKeywords ?? raw.keywords);
  return values.length > 0 ? values : undefined;
}

function gapActions(input: {
  competency: string;
  raw?: AnyRecord;
  issue: string;
  recommendation: string;
  searchKeywords?: string[];
}): DashboardGap["actions"] {
  const learn = rawAction(input.raw, ["learn", "learning", "course", "study", "learning_action", "learningObjective"]);
  const build = rawAction(input.raw, ["build", "project", "practice", "recommendation", "activity", "task"]);
  const document = rawAction(input.raw, ["document", "documentation", "evidence", "artifact", "deliverable"]);
  const keywordHint = input.searchKeywords?.slice(0, 3).join(", ");

  return {
    learn: learn || (keywordHint
      ? `Study ${keywordHint} to address this ${input.competency.toLowerCase()} gap.`
      : `Review focused learning resources for ${input.competency.toLowerCase()}.`),
    build: build || input.recommendation,
    document: document || `Document the completed work with concrete evidence that addresses: ${input.issue || input.recommendation}`,
  };
}

function generatedGapSources(raw: unknown, competenciesByName: Map<string, CompetencyDto>): GapSource[] {
  const sources: GapSource[] = [];
  for (const gap of asRecords(raw)) {
    const name = asText(gap.competency) || asText(gap.area) || asText(gap.title);
    if (!name) continue;
    sources.push({ name, raw: gap, competency: competenciesByName.get(name) });
  }
  return sources;
}

function fallbackGapSources(competencies: CompetencyDto[]): GapSource[] {
  return competencies
    .filter((competency) => competency.score < competency.idealScore)
    .sort((a, b) => a.score - b.score)
    .map((competency) => ({ name: competency.name, competency }));
}

function uniqueGapSources(sources: GapSource[]): GapSource[] {
  return sources.filter((source, index, all) => all.findIndex((item) => item.name === source.name) === index);
}

function normalizeGaps(raw: unknown, competencies: CompetencyDto[]): DashboardGap[] {
  const competenciesByName = new Map(competencies.map((competency) => [competency.name, competency]));
  const generated = generatedGapSources(raw, competenciesByName);
  const selected = uniqueGapSources(generated.length > 0 ? generated : fallbackGapSources(competencies)).slice(0, 3);

  return selected.map(({ name, raw, competency }) => {
    const issue = raw
      ? asText(raw.reason) || asText(raw.issue) || asText(raw.description)
      : "";
    const recommendation = raw
      ? asText(raw.recommendation) || asText(raw.action) || asText(raw.next_step) || asText(raw.nextStep)
      : "";
    const finalIssue = issue || (competency ? competencyIssue(competency) : `Generated analysis flagged ${name} as an improvement area.`);
    const finalRecommendation = recommendation || `Add concrete portfolio evidence mapped to ${name}.`;
    const keywords = searchKeywords(raw);

    return {
      competency: name,
      issue: finalIssue,
      recommendation: finalRecommendation,
      level: competency?.level ?? "Not Demonstrated",
      searchKeywords: keywords,
      actions: gapActions({
        competency: name,
        raw,
        issue: finalIssue,
        recommendation: finalRecommendation,
        searchKeywords: keywords,
      }),
    };
  });
}

function roadmap(gaps: DashboardGap[]): StudentDashboardDto["roadmap"] {
  const nodes: StudentDashboardDto["roadmap"]["nodes"] = [];
  const edges: StudentDashboardDto["roadmap"]["edges"] = [];

  gaps.forEach((gap, index) => {
    const y = index * 230;
    const ids = {
      gap: `gap-${index}`,
      course: `course-${index}`,
      project: `project-${index}`,
      evidence: `evidence-${index}`,
    };
    const objectives = [gap.actions.learn, gap.actions.build, gap.actions.document];
    const base = { y, competency: gap.competency, objectives };

    nodes.push(
      { ...base, id: ids.gap, label: gap.competency, detail: gap.issue, type: "gap", x: 0 },
      { ...base, id: ids.course, label: "Learn", detail: gap.actions.learn, type: "course", x: 270 },
      { ...base, id: ids.project, label: "Build", detail: gap.actions.build, type: "project", x: 540 },
      { ...base, id: ids.evidence, label: "Document", detail: gap.actions.document, type: "evidence", x: 810 },
    );
    edges.push(
      { id: `${ids.gap}-${ids.course}`, source: ids.gap, target: ids.course },
      { id: `${ids.course}-${ids.project}`, source: ids.course, target: ids.project },
      { id: `${ids.project}-${ids.evidence}`, source: ids.project, target: ids.evidence },
    );
  });

  return { nodes, edges };
}

function recommendations(gaps: DashboardGap[]): StudentDashboardDto["recommendations"] {
  return gaps.flatMap((gap) => {
    const keywords = pickKeywords(gap.competency, gap.recommendation, gap.searchKeywords);
    return keywords.slice(0, 3).map((keyword, index) => ({
      title: index === 0 ? `${gap.competency}: ${keyword}` : `Deepen with "${keyword}"`,
      provider: "LinkedIn Learning",
      reason: index === 0
        ? gap.recommendation
        : `Targeted ${gap.level.toLowerCase()} search for ${gap.competency.toLowerCase()}.`,
      relatedCompetency: gap.competency,
      url: linkedinLearningSearchUrl({ keywords: keyword, level: gap.level }),
    }));
  });
}

function references(manifest: AnyRecord): StudentDashboardDto["references"] {
  const framework = isRecord(manifest.framework) ? manifest.framework : {};
  return asRecords(framework.docs).map((doc) => ({
    id: asText(doc.id),
    title: asText(doc.title),
    url: asText(doc.url),
  }));
}

export function buildDashboard(input: {
  runId: string;
  profile: AnyRecord;
  analysis: AnyRecord;
  narrative: string;
  manifest: AnyRecord;
}): StudentDashboardDto {
  const year = asNumber(input.profile.year_level);
  const idealScore = year ? idealByYear[year] ?? 65 : 65;
  const competencies = parseCompetencies(input.analysis.competencies, idealScore);
  const overallScore = competencies.length > 0
    ? Math.round(competencies.reduce((sum, competency) => sum + competency.score, 0) / competencies.length)
    : 0;
  const gaps = normalizeGaps(input.analysis.gaps, competencies);
  const topIssues = gaps.map((gap) => gap.issue).filter(Boolean);

  return {
    run: {
      id: input.runId,
      status: asText(input.manifest.status) || "success",
      frameworkVersion: isRecord(input.manifest.framework)
        ? asText(input.manifest.framework.bundleVersion) || "unknown"
        : "unknown",
    },
    student: {
      id: asText(input.analysis.student_id) || String(input.profile.id ?? ""),
      name: asText(input.profile.full_name) || asText(input.analysis.student_id) || String(input.profile.id ?? "Unknown Student"),
      program: asText(input.analysis.program) || asText(input.profile.program) || "unknown",
      yearLevel: year,
      sparsity: sparsity(input.profile),
    },
    overview: {
      overallScore,
      idealScore,
      ratingLabel: ratingLabel(overallScore),
      summary: asText(input.analysis.summary) || "No summary available.",
      topIssues,
      quickFixes: gaps.map((gap) => gap.recommendation),
    },
    competencies,
    strengths: strengths(input.analysis.strengths),
    gaps: analysisGaps(input.analysis.gaps),
    skills: skillGroups(input.profile, input.analysis),
    roadmap: roadmap(gaps),
    recommendations: recommendations(gaps),
    references: references(input.manifest),
    narrative: input.narrative,
  };
}
