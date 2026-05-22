import type { SkillBreakdown, SkillEntry, SkillKind } from "./types.js";

const SKILL_KIND = new Map<string, SkillKind>([
  // Hard skills: programming, tools, platforms, technical domains.
  ["python", "hard"],
  ["java", "hard"],
  ["javascript", "hard"],
  ["typescript", "hard"],
  ["node.js", "hard"],
  ["react", "hard"],
  ["express.js", "hard"],
  ["html", "hard"],
  ["css", "hard"],
  ["sql", "hard"],
  ["mysql", "hard"],
  ["postgresql", "hard"],
  ["mongodb", "hard"],
  ["git", "hard"],
  ["github", "hard"],
  ["data analysis", "hard"],
  ["machine learning", "hard"],
  ["pandas", "hard"],
  ["numpy", "hard"],
  ["matplotlib", "hard"],
  ["cloud computing", "hard"],
  ["networking", "hard"],
  ["cybersecurity", "hard"],
  ["ui/ux design", "hard"],
  ["mobile development", "hard"],
  ["web development", "hard"],

  // Soft skills: interpersonal, professional, and self-management skills.
  ["communication", "soft"],
  ["leadership", "soft"],
  ["teamwork", "soft"],
  ["collaboration", "soft"],
  ["problem solving", "soft"],
  ["adaptability", "soft"],
  ["creativity", "soft"],
  ["time management", "soft"],
  ["critical thinking", "soft"],
  ["project management", "soft"],
  ["public speaking", "soft"],
]);

function normalizeSkillName(name: string): string {
  return name.trim().toLowerCase();
}

export function classifySkill(skill: SkillEntry): SkillKind | "uncategorized" {
  return SKILL_KIND.get(normalizeSkillName(skill.name)) ?? "uncategorized";
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
