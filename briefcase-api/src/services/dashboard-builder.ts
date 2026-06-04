import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Level, StudentDashboardDto } from "../types/dashboard.js";
import { linkedinLearningSearchUrl, pickKeywords } from "./linkedin-search.js";
import { paraverseCoursewareSearchUrl } from "./paraverse-courseware-search.js";

type AnyRecord = Record<string, unknown>;
type CompetencyDto = StudentDashboardDto["competencies"][number];
type SkillBucket = StudentDashboardDto["skills"]["hard"];
type LearningMap = StudentDashboardDto["learningMap"];
type LearningMapSkill = LearningMap["idealSkills"][number];
type LearningMapNode = LearningMap["nodes"][number];

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
type CourseSkillInference = {
  name: string;
  targetRating: number;
};
type CourseModule = {
  moduleName: string;
  skill: string;
  targetRating: number;
  courseCode: string;
  courseTitle: string;
  year: string;
  yearLevel: number;
  trimester: string;
  coursewareUrl?: string;
};

type CourseProgram = {
  programCode: string;
  programCategory: string;
  modules: CourseModule[];
};

const levelScore: Record<Level, number> = {
  "Not Demonstrated": 0,
  Emerging: 25,
  Developing: 50,
  Proficient: 75,
  Advanced: 100,
};

const idealByYear: Record<number, number> = { 1: 35, 2: 50, 3: 65, 4: 80 };
const genaiSkillsPath = fileURLToPath(new URL("../../../genai-analysis/src/skills.ts", import.meta.url));
const coursesPath = fileURLToPath(new URL("../../../genai-analysis/src/courses.json", import.meta.url));
let cachedSkillKinds: Map<string, SkillKind> | null = null;
let cachedCoursePrograms: CourseProgram[] | null = null;

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

const yearLevelByName = new Map([
  ["freshman", 1],
  ["sophomore", 2],
  ["junior", 3],
  ["senior", 4],
]);

function normalizeProgramText(value: string): string {
  return value.replace(/[^a-z0-9]/gi, "").toUpperCase();
}

function courseTitle(value: AnyRecord): string {
  return asText(value.mflix_title) || asText(value.description).replace(/\s+\((LEC|LAB)\)$/i, "") || asText(value.code);
}

function isMainCourseCode(code: string): boolean {
  const normalized = code.trim().toUpperCase();
  return !/^GED/i.test(normalized) && normalized !== "CS0016";
}

function coursewareLookupKey(kind: "code" | "title", value: string): string {
  return `${kind}:${normalizeSkillName(value)}`;
}

function buildCoursewareUrlLookup(programs: AnyRecord[]): Map<string, string> {
  const urls = new Map<string, string>();

  for (const program of programs) {
    const years = isRecord(program.years) ? program.years : {};
    for (const trimesterGroups of Object.values(years)) {
      if (!isRecord(trimesterGroups)) continue;

      for (const courses of Object.values(trimesterGroups)) {
        for (const course of asRecords(courses)) {
          const url = asText(course.mflix_url);
          if (!url) continue;

          const courseCode = asText(course.mflix_canonical_code) || asText(course.code);
          const title = courseTitle(course);
          if (courseCode) urls.set(coursewareLookupKey("code", courseCode), url);
          if (title) urls.set(coursewareLookupKey("title", title), url);
        }
      }
    }
  }

  return urls;
}

function moduleKey(module: CourseModule): string {
  return `${normalizeSkillName(module.skill)}|${normalizeSkillName(module.courseTitle)}|${module.year}|${module.trimester}`;
}

const directSkillPatterns: Array<[RegExp, string]> = [
  [/c\+\+/i, "C++"],
  [/\bjavascript\b/i, "JavaScript"],
  [/\btypescript\b/i, "TypeScript"],
  [/\bhtml\b/i, "HTML"],
  [/\bcss\b/i, "CSS"],
  [/\bpython\b/i, "Python"],
  [/\bjava\b/i, "Java"],
  [/\bsql\b/i, "SQL"],
  [/\bui\/ux\b|\buser interface\b|\buser experience\b/i, "UI/UX Design"],
  [/\boop\b|\bobject[- ]oriented\b/i, "Object-Oriented Programming"],
  [/\bdatabase\b/i, "Database"],
  [/\bnetwork\b|\binternet\b/i, "Networking"],
  [/\bcybersecurity\b|\bsecurity\b/i, "Cybersecurity"],
  [/\bphotoshop\b/i, "Adobe Photoshop"],
  [/\bpublic speaking\b|\bpersuasive speaking\b/i, "Public Speaking"],
  [/\bcommunication\b/i, "Communication"],
  [/\bmachine learning\b/i, "Machine Learning"],
  [/\bdata science\b/i, "Data Science"],
  [/\bdata analysis\b|\banalytics\b/i, "Data Analysis"],
  [/\bsoftware engineering\b/i, "Software Engineering"],
  [/\bweb development\b|\bweb design\b|\bweb application\b/i, "Web Development"],
  [/\bmobile development\b|\bmobile application\b/i, "Mobile Development"],
  [/\boperating systems?\b/i, "Operating Systems"],
  [/\bcloud computing\b/i, "Cloud Computing"],
  [/\balgorithms?\b/i, "Algorithms"],
  [/\bdifferential equations?\b/i, "Differential Equations"],
  [/\bcalculus\b/i, "Calculus"],
  [/\bstatistics\b|\bprobability\b/i, "Statistics"],
  [/\blinear algebra\b/i, "Linear Algebra"],
  [/\bdigital logic\b|\blogic circuits?\b/i, "Digital Logic"],
  [/\belectrical circuits?\b/i, "Electrical Circuits"],
  [/\belectronic circuits?\b/i, "Electronic Circuits"],
  [/\bcomputer aided drafting\b|\bcad\b/i, "Computer-Aided Design"],
  [/\b(computer hardware|hardware fundamentals?|cases?|cooling|peripherals?|gpu|cpu|pc hardware|hardware components?|bios|uefi|bootable media|os installation|pc building|specification assembly|maintenance)\b/i, "Computer Hardware"],
  [/\b(hci|human[- ]computer interaction|usability|performance metrics?|issue[- ]based metrics?|self[- ]reported metrics?|behavioral metrics?|norman|designing for errors|designing for emotions|the human|the computer and task)\b/i, "Human-Computer Interaction"],
  [/\b(computer programming|programming logic|programming|program logic|logic design|control structures?|input\/output|functions?|recursion|file handling|pointers?|arrays?|character|string manipulation|user defined functions?)\b/i, "Programming Fundamentals"],
  [/\b(linked lists?|data structures?|structures)\b/i, "Data Structures"],
  [/\b(introduction to computing|computing fundamentals?|number systems?|software|computer fundamentals?)\b/i, "Computer Fundamentals"],
  [/\bcomputer engineering as a discipline\b/i, "Computer Engineering Foundations"],
  [/\bengineering design\b/i, "Engineering Design"],
  [/\bengineering ethics|principles of ethics|introduction to ethics\b/i, "Engineering Ethics"],
];

const courseTitleSkillPatterns: Array<[RegExp, string[]]> = [
  [/\bmachine learning algorithms?\b/i, ["Machine Learning", "Algorithms"]],
  [/\badvance(?:d)? machine learning\b/i, ["Machine Learning"]],
  [/\bstatistical analysis and modeling\b/i, ["Statistics", "Data Analysis"]],
  [/\bmodeling and simulation\b/i, ["Modeling and Simulation"]],
  [/\bsystem analysis and design\b/i, ["Systems Analysis and Design"]],
  [/\bweb system technologies\b/i, ["Web Development"]],
  [/\be-?commerce with digital marketing\b/i, ["E-commerce and Digital Marketing"]],
  [/\bdigital forensics essentials\b/i, ["Digital Forensics"]],
  [/\b(cs|capstone)\s+project\s+\d+\b/i, ["Software Project Development"]],
  [/\b(cs|it)?\s*project management\b/i, ["Project Management"]],
  [/\bsocial and professional issues\b/i, ["Professional Responsibility"]],
  [/\bcertification exam\b/i, ["Certification Readiness"]],
  [/\binternship\b/i, ["Professional Practice"]],
  [/\bemerging technologies\b/i, ["Emerging Technologies"]],
  [/\bsystem integration\b|\bsystem integration and architecture\b/i, ["System Integration"]],
  [/\bcpe practice and design\b/i, ["Computer Engineering Design"]],
  [/\bprofessional development for engineers\b/i, ["Professional Development"]],
  [/\bcpe laws and professional practice\b/i, ["Engineering Ethics"]],
  [/\bcognate\/track course\b|\btechnical elective\b/i, ["Specialized Track Development"]],
  [/\bdigital signal processing\b/i, ["Digital Signal Processing"]],
  [/\boccupational health and safety\b/i, ["Occupational Health and Safety"]],
  [/\bbusiness process\b/i, ["Business Process Analysis"]],
  [/\bcomputer systems?(?: &| and)? architecture\b|\bcomputer systems and platform technologies\b/i, ["Computer Systems"]],
  [/\bnetworking\b|\bcisco ccna\b/i, ["Networking"]],
  [/\bcomputer engineering drafting and design\b/i, ["Computer-Aided Design", "Engineering Design"]],
  [/\bdiscrete mathematics(?: for cpe)?\b/i, ["Discrete Mathematics"]],
  [/\bnumerical methods(?: for cpe)?\b/i, ["Numerical Methods"]],
  [/\bfeedback and control systems?\b/i, ["Control Systems"]],
  [/\bengineering economics\b/i, ["Engineering Economics"]],
  [/\bmixed signals? and sensors?\b/i, ["Sensor Systems"]],
  [/\bbioengineering\b/i, ["Bioengineering"]],
  [/\bdesign thinking(?: for engineers)?\b/i, ["Design Thinking"]],
  [/\bengineering management\b/i, ["Engineering Management"]],
  [/\bmethods of research(?: for cpe)?\b/i, ["Research Methods"]],
  [/\bcomputer architecture and organization\b/i, ["Computer Architecture"]],
  [/\bmicroprocessors?\b/i, ["Microprocessors"]],
  [/\bembedded systems?\b/i, ["Embedded Systems"]],
  [/\bseminars? and field trips?\b/i, ["Professional Practice"]],
  [/\bhdl\b|\bhardware description language\b/i, ["Hardware Description Languages"]],
  [/\btechnopreneurship(?: for engineers)?\b/i, ["Technopreneurship"]],
  [/\bparallel and distributed computing\b/i, ["Parallel and Distributed Computing"]],
  [/\bautomata theory and formal languages\b/i, ["Theory of Computation"]],
  [/\bcomputer graphics and visual computing\b/i, ["Computer Graphics"]],
  [/\bimage processing\b/i, ["Image Processing"]],
  [/\b3d design\b/i, ["3D Design"]],
  [/\b3d texturing\b/i, ["3D Texturing"]],
  [/\bgame design\b/i, ["Game Design"]],
  [/\bgame studies\b/i, ["Game Studies"]],
  [/\bquantitative methods\b/i, ["Quantitative Methods"]],
  [/\binformation management\b/i, ["Information Management"]],
  [/\bblockchain\b/i, ["Blockchain"]],
];

const nonSkillModulePatterns = [
  /\bcpe curriculum\b/i,
  /\bcurriculum\b/i,
  /\bsupplementary videos?\b/i,
  /\bthe profession\b/i,
  /\bintroduction to the engineering profession\b/i,
  /\bpreparing for an engineering career\b/i,
  /\bprofessional organizations?\b/i,
];

function inferSkillTargetRating(moduleName: string): number {
  const normalized = normalizeSkillName(moduleName);
  if (/\b(introduction|getting ready|foundations?|review)\b/.test(normalized)) return 30;
  if (/\b(basic|fundamentals?|principles?|essentials?)\b/.test(normalized)) return 40;
  if (/\b(intermediate|structures?|arrays?|functions?|file handling|linked list|pointers?)\b/.test(normalized)) return 50;
  if (/\b(applications?|advanced|higher order|professional|design|analysis)\b/.test(normalized)) return 60;
  return 45;
}

function titleCaseSkillName(value: string): string {
  const words = value
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ");
  return words.map((word) => {
    if (/^[A-Z0-9/+.-]+$/.test(word)) return word;
    return `${word.slice(0, 1).toUpperCase()}${word.slice(1).toLowerCase()}`;
  }).join(" ");
}

function inferCourseSkill(moduleName: string, courseName = ""): CourseSkillInference | null {
  if (nonSkillModulePatterns.some((pattern) => pattern.test(moduleName))) {
    return null;
  }

  const skillSource = `${moduleName} ${courseName}`.trim();
  for (const [pattern, skillName] of directSkillPatterns) {
    if (pattern.test(skillSource)) {
      return { name: skillName, targetRating: inferSkillTargetRating(moduleName) };
    }
  }

  const fallbackSource = courseName || moduleName;
  const cleaned = fallbackSource
    .replace(/\([^)]*\)/g, "")
    .replace(/\b(part|module)\s+\d+\b/gi, "")
    .replace(/^\s*(introduction to|getting ready for|basic concepts in|basics of|basic|foundations of|fundamentals of|principles of|review the fundamentals of|review of)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();

  return {
    name: titleCaseSkillName(cleaned || moduleName),
    targetRating: inferSkillTargetRating(moduleName),
  };
}

function inferCourseTitleSkills(courseTitle: string): CourseSkillInference[] {
  for (const [pattern, skillNames] of courseTitleSkillPatterns) {
    if (pattern.test(courseTitle)) {
      return skillNames.map((skillName) => ({
        name: skillName,
        targetRating: inferSkillTargetRating(courseTitle),
      }));
    }
  }

  const skill = inferCourseSkill(courseTitle);
  return skill ? [skill] : [];
}

function normalizeEquivalentSkillName(name: string): string {
  return normalizeSkillName(inferCourseSkill(name)?.name ?? name);
}

function loadCoursePrograms(): CourseProgram[] {
  if (cachedCoursePrograms) return cachedCoursePrograms;

  try {
    const raw = JSON.parse(readFileSync(coursesPath, "utf8")) as unknown;
    const programs = isRecord(raw) ? asRecords(raw.programs) : [];
    const coursewareUrls = buildCoursewareUrlLookup(programs);
    cachedCoursePrograms = programs.map((program) => {
      const modules: CourseModule[] = [];
      const years = isRecord(program.years) ? program.years : {};

      for (const [year, trimesterGroups] of Object.entries(years)) {
        const yearLevel = yearLevelByName.get(year.toLowerCase());
        if (!yearLevel || !isRecord(trimesterGroups)) continue;

        for (const [trimester, courses] of Object.entries(trimesterGroups)) {
          for (const course of asRecords(courses)) {
            const courseCode = asText(course.mflix_canonical_code) || asText(course.code);
            if (!isMainCourseCode(courseCode)) continue;

            const title = courseTitle(course);
            const coursewareUrl =
              asText(course.mflix_url) ||
              coursewareUrls.get(coursewareLookupKey("code", courseCode)) ||
              coursewareUrls.get(coursewareLookupKey("title", title)) ||
              "";

            for (const skillTarget of inferCourseTitleSkills(title)) {
              modules.push({
                moduleName: title,
                skill: skillTarget.name,
                targetRating: skillTarget.targetRating,
                courseCode,
                courseTitle: title,
                year,
                yearLevel,
                trimester,
                ...(coursewareUrl ? { coursewareUrl } : {}),
              });
            }
          }
        }
      }

      const uniqueModules = modules.filter((module, index, all) =>
        all.findIndex((item) => moduleKey(item) === moduleKey(module)) === index
      );

      return {
        programCode: asText(program.program_code),
        programCategory: asText(program.category),
        modules: uniqueModules,
      };
    }).filter((program) => program.programCode && program.modules.length > 0);
  } catch {
    cachedCoursePrograms = [];
  }

  return cachedCoursePrograms;
}

function programMatchScore(program: CourseProgram, profile: AnyRecord, analysis: AnyRecord): number {
  const declaredProgram = normalizeProgramText(asText(analysis.program) || asText(profile.program));
  const specialization = normalizeProgramText(asText(profile.specialization) || asText(analysis.specialization));
  const code = normalizeProgramText(program.programCode);
  const category = normalizeProgramText(program.programCategory);
  let score = 0;

  if (declaredProgram) {
    if (code === declaredProgram) score += 80;
    else if (code.startsWith(declaredProgram)) score += 55;
    else if (declaredProgram.startsWith(code)) score += 45;
    if (category.includes(declaredProgram)) score += 25;
  }

  if (specialization) {
    if (code.includes(specialization)) score += 30;
    if (category.includes(specialization)) score += 30;
  }

  const yearMatch = code.match(/20\d{2}/);
  if (yearMatch) score += Number(yearMatch[0]) - 2020;

  return score;
}

function selectCourseProgram(profile: AnyRecord, analysis: AnyRecord): CourseProgram | undefined {
  return loadCoursePrograms()
    .map((program) => ({ program, score: programMatchScore(program, profile, analysis) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)[0]?.program;
}

function skillRatings(skills: StudentDashboardDto["skills"]): Map<string, number> {
  const ratings = new Map<string, number>();
  for (const bucket of [skills.hard, skills.soft, skills.uncategorized]) {
    for (const skill of bucket) {
      ratings.set(normalizeSkillName(skill.name), skill.rating);
      ratings.set(normalizeEquivalentSkillName(skill.name), skill.rating);
    }
  }
  return ratings;
}

function learningMapStatus(currentRating: number | undefined, targetRating: number): LearningMapSkill["status"] {
  if (currentRating === undefined) return "missing";
  return currentRating >= targetRating ? "met" : "needs-work";
}

function learningMapDifficulty(targetRating: number): string {
  if (targetRating >= 70) return "ADVANCED";
  if (targetRating >= 45) return "INTERMEDIATE";
  return "BEGINNER";
}

function buildLearningMap(input: {
  profile: AnyRecord;
  analysis: AnyRecord;
  skills: StudentDashboardDto["skills"];
  yearLevel: number | null;
  targetScore: number;
}): LearningMap {
  const selectedProgram = selectCourseProgram(input.profile, input.analysis);
  const currentRatings = skillRatings(input.skills);
  const targetYearLevel = input.yearLevel ?? 4;
  const modules = selectedProgram
    ? selectedProgram.modules.filter((module) => module.yearLevel === targetYearLevel)
    : [];

  const allIdealSkills = modules.map((module): LearningMapSkill => {
    const normalized = normalizeEquivalentSkillName(module.skill);
    const currentRating = currentRatings.get(normalized);
    const status = learningMapStatus(currentRating, module.targetRating);
    return {
      name: module.skill,
      courseCode: module.courseCode,
      courseTitle: module.courseTitle,
      year: module.year,
      trimester: module.trimester,
      status,
      currentRating: currentRating ?? null,
      targetRating: module.targetRating,
      coursewareUrl: module.coursewareUrl ?? paraverseCoursewareSearchUrl({ keywords: [module.courseTitle, module.skill] }),
      linkedinLearningUrl: linkedinLearningSearchUrl({
        keywords: module.skill,
        difficulty: learningMapDifficulty(module.targetRating),
      }),
    };
  });
  const idealSkills = allIdealSkills
    .sort((a, b) => {
      const statusScore = (skill: LearningMapSkill) =>
        skill.status === "missing" ? 0 : skill.status === "needs-work" ? 1 : 2;
      const statusDelta = statusScore(a) - statusScore(b);
      if (statusDelta !== 0) return statusDelta;
      return b.targetRating - a.targetRating;
    });

  const learningTargets = idealSkills
    .filter((skill): skill is LearningMapSkill & { status: "needs-work" | "missing" } => skill.status !== "met")
    .sort((a, b) => {
      const yearDelta = (yearLevelByName.get(b.year.toLowerCase()) ?? 0) - (yearLevelByName.get(a.year.toLowerCase()) ?? 0);
      if (yearDelta !== 0) return yearDelta;
      return a.name.localeCompare(b.name);
    })
    .slice(0, 8);

  const nodes: LearningMapNode[] = [];
  const edges: LearningMap["edges"] = [];
  learningTargets.forEach((target, index) => {
    const y = index * 230;
    const ids = {
      ideal: `learning-ideal-${index}`,
      learn: `learning-learn-${index}`,
      practice: `learning-practice-${index}`,
      evidence: `learning-evidence-${index}`,
    };
    const base = {
      y,
      skill: target.name,
      courseCode: target.courseCode,
      courseTitle: target.courseTitle,
      year: target.year,
      trimester: target.trimester,
      status: target.status,
      coursewareUrl: target.coursewareUrl,
      linkedinLearningUrl: target.linkedinLearningUrl,
    };

    nodes.push(
      {
        ...base,
        id: ids.ideal,
        label: target.courseTitle,
        detail: `${target.year} ${target.trimester}: add or improve ${target.name} to ${target.targetRating}/100.`,
        type: "ideal",
        x: 0,
      },
      {
        ...base,
        id: ids.learn,
        label: "Learn",
        detail: `Study ${target.name} using ${target.courseTitle} materials.`,
        type: "learn",
        x: 270,
      },
      {
        ...base,
        id: ids.practice,
        label: "Practice",
        detail: `Build a small artifact that proves ${target.name} in the context of ${target.courseTitle}.`,
        type: "practice",
        x: 540,
      },
      {
        ...base,
        id: ids.evidence,
        label: "Document",
        detail: `Add portfolio evidence for ${target.name} and note the course/module source.`,
        type: "evidence",
        x: 810,
      },
    );
    edges.push(
      { id: `${ids.ideal}-${ids.learn}`, source: ids.ideal, target: ids.learn },
      { id: `${ids.learn}-${ids.practice}`, source: ids.learn, target: ids.practice },
      { id: `${ids.practice}-${ids.evidence}`, source: ids.practice, target: ids.evidence },
    );
  });

  const missingCount = idealSkills.filter((skill) => skill.status === "missing").length;
  const needsWorkCount = idealSkills.filter((skill) => skill.status === "needs-work").length;
  const programLabel = selectedProgram
    ? `${selectedProgram.programCode} (${selectedProgram.programCategory})`
    : "No matching course program";

  return {
    programCode: selectedProgram?.programCode ?? "",
    programCategory: selectedProgram?.programCategory ?? "",
    targetYearLevel: input.yearLevel,
    targetScore: input.targetScore,
    summary: selectedProgram && idealSkills.length === 0
      ? `${programLabel}: no Year ${targetYearLevel} main-course skill targets were found in courses.json.`
      : selectedProgram
      ? `${programLabel}: ${missingCount} missing and ${needsWorkCount} needs-work skills for the Year ${targetYearLevel} curriculum target.`
      : "No matching curriculum was found in courses.json for this student's program.",
    idealSkills,
    nodes,
    edges,
  };
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
  return loadSkillKinds().get(normalizeEquivalentSkillName(name)) ?? "uncategorized";
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

function evidenceCounts(profile: AnyRecord): StudentDashboardDto["student"]["evidenceCounts"] {
  const count = (...keys: string[]) =>
    keys.reduce((sum, key) => sum + (Array.isArray(profile[key]) ? (profile[key] as unknown[]).length : 0), 0);

  return {
    skills: count("skills"),
    projects: count("projects"),
    experience: count("experience", "work_experience"),
    education: count("education", "educational_qualification", "educational_qualifications"),
    certifications: count("certifications", "licenses_certifications"),
    awards: count("awards", "honors_awards"),
    trainings: count("seminars_trainings"),
    organizations: count("organizations_memberships"),
  };
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
  const skills = skillGroups(input.profile, input.analysis);
  const curriculumLearningMap = buildLearningMap({
    profile: input.profile,
    analysis: input.analysis,
    skills,
    yearLevel: year,
    targetScore: idealScore,
  });

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
      specialization: asText(input.analysis.specialization) || asText(input.profile.specialization),
      headline: asText(input.profile.headline),
      biography: asText(input.profile.short_biography) || asText(input.profile.biography),
      yearLevel: year,
      sparsity: sparsity(input.profile),
      evidenceCounts: evidenceCounts(input.profile),
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
    skills,
    roadmap: roadmap(gaps),
    learningMap: curriculumLearningMap,
    recommendations: recommendations(gaps),
    references: references(input.manifest),
    narrative: input.narrative,
  };
}
