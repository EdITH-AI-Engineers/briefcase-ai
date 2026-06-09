import type { SkillBreakdown, SkillEntry, SkillKind } from "./types.js";
import coursesData from "./courses.json";

export type CourseSkillTarget = {
  programCode: string;
  programCategory: string;
  courseCode: string;
  courseTitle: string;
  moduleName: string;
  skillName: string;
  skillKind: SkillKind;
  targetRating: number;
  year: string;
  yearLevel: number;
  trimester: string;
  coursewareUrl?: string;
};

export type CourseSkillProgram = {
  programCode: string;
  programCategory: string;
  targets: CourseSkillTarget[];
};

type AnyRecord = Record<string, unknown>;
type CourseSkillInference = {
  name: string;
  kind: SkillKind;
  targetRating: number;
};

const SOFT_MODULE_PATTERNS = [
  "communication",
  "ethics",
  "interview",
  "listening",
  "professional",
  "public speaking",
  "speaking",
  "team",
  "workplace",
];

const DIRECT_SKILL_PATTERNS: Array<[RegExp, string]> = [
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

const COURSE_TITLE_SKILL_PATTERNS: Array<[RegExp, string[]]> = [
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

const NON_SKILL_MODULE_PATTERNS = [
  /\bcpe curriculum\b/i,
  /\bcurriculum\b/i,
  /\bsupplementary videos?\b/i,
  /\bthe profession\b/i,
  /\bintroduction to the engineering profession\b/i,
  /\bpreparing for an engineering career\b/i,
  /\bprofessional organizations?\b/i,
];

const yearLevelByName = new Map([
  ["freshman", 1],
  ["sophomore", 2],
  ["junior", 3],
  ["senior", 4],
]);

const EXCLUDED_COURSE_PREFIXES = ["GED"];
const EXCLUDED_COURSE_CODES = ["CS0016"];

function isRecord(value: unknown): value is AnyRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
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

function inferSkillTargetRating(moduleName: string): number {
  const normalized = normalizeSkillName(moduleName);
  if (/\b(introduction|getting ready|foundations?|review)\b/.test(normalized)) return 30;
  if (/\b(basic|fundamentals?|principles?|essentials?)\b/.test(normalized)) return 40;
  if (/\b(intermediate|structures?|arrays?|functions?|file handling|linked list|pointers?)\b/.test(normalized)) return 50;
  if (/\b(applications?|advanced|higher order|professional|design|analysis)\b/.test(normalized)) return 60;
  return 45;
}

export function inferCourseSkill(moduleName: string, courseName = ""): CourseSkillInference | null {
  if (NON_SKILL_MODULE_PATTERNS.some((pattern) => pattern.test(moduleName))) {
    return null;
  }

  const skillSource = `${moduleName} ${courseName}`.trim();
  for (const [pattern, skillName] of DIRECT_SKILL_PATTERNS) {
    if (pattern.test(skillSource)) {
      return {
        name: skillName,
        kind: inferCourseSkillKind(skillName, skillSource),
        targetRating: inferSkillTargetRating(moduleName),
      };
    }
  }

  const fallbackSource = courseName || moduleName;
  const cleaned = fallbackSource
    .replace(/\([^)]*\)/g, "")
    .replace(/\b(part|module)\s+\d+\b/gi, "")
    .replace(/^\s*(introduction to|getting ready for|basic concepts in|basics of|basic|foundations of|fundamentals of|principles of|review the fundamentals of|review of)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();

  const name = titleCaseSkillName(cleaned || moduleName);
  return {
    name,
    kind: inferCourseSkillKind(name, skillSource),
    targetRating: inferSkillTargetRating(moduleName),
  };
}

function inferCourseTitleSkills(courseTitle: string): CourseSkillInference[] {
  for (const [pattern, skillNames] of COURSE_TITLE_SKILL_PATTERNS) {
    if (pattern.test(courseTitle)) {
      return skillNames.map((skillName) => ({
        name: skillName,
        kind: inferCourseSkillKind(skillName, courseTitle),
        targetRating: inferSkillTargetRating(courseTitle),
      }));
    }
  }

  const skill = inferCourseSkill(courseTitle);
  return skill ? [skill] : [];
}

function inferCourseSkillKind(skillName: string, moduleName: string): SkillKind {
  const normalized = normalizeSkillName(`${skillName} ${moduleName}`);
  return SOFT_MODULE_PATTERNS.some((pattern) => normalized.includes(pattern))
    ? "soft"
    : "hard";
}

function courseTitle(value: AnyRecord): string {
  return asText(value.mflix_title) ||
    asText(value.description).replace(/\s+\((LEC|LAB)\)$/i, "") ||
    asText(value.code);
}

export function isMainCourseCode(code: string): boolean {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return false;
  return !EXCLUDED_COURSE_CODES.includes(normalized) &&
    !EXCLUDED_COURSE_PREFIXES.some((prefix) => normalized.startsWith(prefix));
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
        for (const course of (Array.isArray(courses) ? courses : []).filter(isRecord)) {
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

function courseSkillKey(target: CourseSkillTarget): string {
  return [
    normalizeSkillName(target.skillName),
    normalizeSkillName(target.courseTitle),
    target.year,
    target.trimester,
  ].join("|");
}

function extractCourseSkillPrograms(value: unknown): CourseSkillProgram[] {
  if (!isRecord(value)) return [];

  const programs = (Array.isArray(value.programs) ? value.programs : []).filter(isRecord);
  const coursewareUrls = buildCoursewareUrlLookup(programs);

  return programs
    .map((program) => {
      const targets: CourseSkillTarget[] = [];
      const programCode = asText(program.program_code);
      const programCategory = asText(program.category);
      const years = isRecord(program.years) ? program.years : {};

      for (const [year, trimesterGroups] of Object.entries(years)) {
        const yearLevel = yearLevelByName.get(year.toLowerCase());
        if (!yearLevel || !isRecord(trimesterGroups)) continue;

        for (const [trimester, courses] of Object.entries(trimesterGroups)) {
          for (const course of (Array.isArray(courses) ? courses : []).filter(isRecord)) {
            const courseCode = asText(course.mflix_canonical_code) || asText(course.code);
            if (!isMainCourseCode(courseCode)) continue;

            const title = courseTitle(course);
            const coursewareUrl =
              asText(course.mflix_url) ||
              coursewareUrls.get(coursewareLookupKey("code", courseCode)) ||
              coursewareUrls.get(coursewareLookupKey("title", title)) ||
              "";

            for (const skill of inferCourseTitleSkills(title)) {
              targets.push({
                programCode,
                programCategory,
                courseCode,
                courseTitle: title,
                moduleName: title,
                skillName: skill.name,
                skillKind: skill.kind,
                targetRating: skill.targetRating,
                year,
                yearLevel,
                trimester,
                ...(coursewareUrl ? { coursewareUrl } : {}),
              });
            }
          }
        }
      }

      return {
        programCode,
        programCategory,
        targets: targets.filter((target, index, all) =>
          all.findIndex((item) => courseSkillKey(item) === courseSkillKey(target)) === index
        ),
      };
    })
    .filter((program) => program.programCode && program.targets.length > 0);
}

const COURSE_SKILL_PROGRAMS = extractCourseSkillPrograms(coursesData);
const COURSE_SKILL_ALIASES = new Map<string, string>();
const COURSE_SKILL_KIND = new Map<string, SkillKind>();

for (const program of COURSE_SKILL_PROGRAMS) {
  for (const target of program.targets) {
    COURSE_SKILL_ALIASES.set(
      normalizeSkillName(target.moduleName),
      normalizeSkillName(target.skillName),
    );
    COURSE_SKILL_KIND.set(normalizeSkillName(target.skillName), target.skillKind);
  }
}

const BASE_SKILL_KIND = [
  // Hard skills: programming, tools, platforms, technical domains.
  ["python", "hard"] as const,
  ["java", "hard"] as const,
  ["javascript", "hard"] as const,
  ["typescript", "hard"] as const,
  ["node.js", "hard"] as const,
  ["react", "hard"] as const,
  ["express.js", "hard"] as const,
  ["html", "hard"] as const,
  ["css", "hard"] as const,
  ["sql", "hard"] as const,
  ["mysql", "hard"] as const,
  ["postgresql", "hard"] as const,
  ["mongodb", "hard"] as const,
  ["git", "hard"] as const,
  ["github", "hard"] as const,
  ["data analysis", "hard"] as const,
  ["machine learning", "hard"] as const,
  ["pandas", "hard"] as const,
  ["numpy", "hard"] as const,
  ["matplotlib", "hard"] as const,
  ["cloud computing", "hard"] as const,
  ["networking", "hard"] as const,
  ["cybersecurity", "hard"] as const,
  ["ui/ux design", "hard"] as const,
  ["mobile development", "hard"] as const,
  ["web development", "hard"] as const,
  ["programming fundamentals", "hard"] as const,
  ["computer fundamentals", "hard"] as const,
  ["computer hardware", "hard"] as const,
  ["human-computer interaction", "hard"] as const,
  ["data structures", "hard"] as const,
  ["data science", "hard"] as const,
  ["software engineering", "hard"] as const,
  ["software project development", "hard"] as const,
  ["professional responsibility", "soft"] as const,
  ["certification readiness", "hard"] as const,
  ["professional practice", "soft"] as const,
  ["emerging technologies", "hard"] as const,
  ["system integration", "hard"] as const,
  ["computer engineering design", "hard"] as const,
  ["professional development", "soft"] as const,
  ["specialized track development", "hard"] as const,
  ["digital signal processing", "hard"] as const,
  ["occupational health and safety", "soft"] as const,
  ["business process analysis", "hard"] as const,
  ["computer systems", "hard"] as const,
  ["modeling and simulation", "hard"] as const,
  ["systems analysis and design", "hard"] as const,
  ["e-commerce and digital marketing", "hard"] as const,
  ["digital forensics", "hard"] as const,
  ["discrete mathematics", "hard"] as const,
  ["numerical methods", "hard"] as const,
  ["control systems", "hard"] as const,
  ["engineering economics", "hard"] as const,
  ["sensor systems", "hard"] as const,
  ["bioengineering", "hard"] as const,
  ["design thinking", "hard"] as const,
  ["engineering management", "hard"] as const,
  ["research methods", "hard"] as const,
  ["computer architecture", "hard"] as const,
  ["microprocessors", "hard"] as const,
  ["embedded systems", "hard"] as const,
  ["hardware description languages", "hard"] as const,
  ["technopreneurship", "hard"] as const,
  ["parallel and distributed computing", "hard"] as const,
  ["theory of computation", "hard"] as const,
  ["computer graphics", "hard"] as const,
  ["image processing", "hard"] as const,
  ["3d design", "hard"] as const,
  ["3d texturing", "hard"] as const,
  ["game design", "hard"] as const,
  ["game studies", "hard"] as const,
  ["quantitative methods", "hard"] as const,
  ["information management", "hard"] as const,
  ["blockchain", "hard"] as const,
  ["operating systems", "hard"] as const,
  ["algorithms", "hard"] as const,
  ["differential equations", "hard"] as const,
  ["calculus", "hard"] as const,
  ["statistics", "hard"] as const,
  ["linear algebra", "hard"] as const,
  ["digital logic", "hard"] as const,
  ["electrical circuits", "hard"] as const,
  ["electronic circuits", "hard"] as const,
  ["computer-aided design", "hard"] as const,
  ["computer engineering foundations", "hard"] as const,
  ["engineering design", "hard"] as const,
  ["engineering ethics", "soft"] as const,

  // Soft skills: interpersonal, professional, and self-management skills.
  ["communication", "soft"] as const,
  ["leadership", "soft"] as const,
  ["teamwork", "soft"] as const,
  ["collaboration", "soft"] as const,
  ["problem solving", "soft"] as const,
  ["adaptability", "soft"] as const,
  ["creativity", "soft"] as const,
  ["time management", "soft"] as const,
  ["critical thinking", "soft"] as const,
  ["project management", "soft"] as const,
  ["public speaking", "soft"] as const,
];

const SKILL_KIND = new Map<string, SkillKind>([
  ...COURSE_SKILL_KIND,
  ...BASE_SKILL_KIND,
]);

function normalizeSkillName(name: string): string {
  return name.trim().toLowerCase();
}

export function normalizeEquivalentSkillName(name: string): string {
  const normalized = normalizeSkillName(name);
  const inferred = inferCourseSkill(name);
  return COURSE_SKILL_ALIASES.get(normalized) ??
    normalizeSkillName(inferred?.name ?? name);
}

export function getCourseSkillPrograms(): CourseSkillProgram[] {
  return COURSE_SKILL_PROGRAMS;
}

export function getCourseSkillTargets(): CourseSkillTarget[] {
  return COURSE_SKILL_PROGRAMS.flatMap((program) => program.targets);
}

export function getSkillKind(name: string): SkillKind | "uncategorized" {
  return SKILL_KIND.get(normalizeEquivalentSkillName(name)) ?? "uncategorized";
}

export function classifySkill(skill: SkillEntry): SkillKind | "uncategorized" {
  return getSkillKind(skill.name);
}

export function splitSkills(skills: SkillEntry[] = []): SkillBreakdown {
  const breakdown: SkillBreakdown = {
    hard: [],
    soft: [],
    uncategorized: [],
  };

  for (const skill of skills) {
    const kind = classifySkill(skill);
    breakdown[kind].push(skill);
  }

  return breakdown;
}
