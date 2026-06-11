type AnyRecord = Record<string, unknown>;

type ProfileSparsityLevel = "Missing" | "Sparse" | "Complete" | "Rich";

type EvidenceSection = {
  key: string;
  label: string;
  fields: string[];
  minimumItems?: number;
};

type ProfileSparsityWarning = {
  sparsity: ProfileSparsityLevel;
  shouldWarn: boolean;
  message: string;
  filledSections: number;
  totalSections: number;
  sectionCounts: Record<string, number>;
  missingSections: string[];
  thinSections: string[];
};

const evidenceSections: EvidenceSection[] = [
  { key: "skills", label: "skills", fields: ["skills"], minimumItems: 2 },
  { key: "projects", label: "projects", fields: ["projects"], minimumItems: 1 },
  {
    key: "organizations",
    label: "organizations",
    fields: ["organizations_memberships"],
    minimumItems: 1,
  },
  {
    key: "certifications",
    label: "certifications",
    fields: ["certifications", "licenses_certifications"],
    minimumItems: 1,
  },
  { key: "awards", label: "awards", fields: ["awards", "honors_awards"], minimumItems: 1 },
  {
    key: "education",
    label: "education",
    fields: ["education", "educational_qualification", "educational_qualifications"],
    minimumItems: 1,
  },
  { key: "experience", label: "experience", fields: ["experience", "work_experience"], minimumItems: 1 },
  { key: "trainings", label: "trainings", fields: ["seminars_trainings"], minimumItems: 1 },
];

function arrayCount(profile: AnyRecord, fields: string[]): number {
  return fields.reduce((count, field) => {
    const value = profile[field];
    return count + (Array.isArray(value) ? value.length : 0);
  }, 0);
}

function profileSparsityLevel(profile: AnyRecord): ProfileSparsityLevel {
  const filledSections = evidenceSections.filter((section) => arrayCount(profile, section.fields) > 0).length;
  if (filledSections <= 1) return "Missing";
  if (filledSections <= 3) return "Sparse";
  if (filledSections <= 6) return "Complete";
  return "Rich";
}

function warningMessage(sparsity: ProfileSparsityLevel, missingSections: string[], thinSections: string[]): string {
  if (sparsity === "Complete" || sparsity === "Rich") {
    return "Student profile has enough evidence for a stronger analysis.";
  }

  const issues = [...thinSections, ...missingSections].slice(0, 4);
  const suffix = issues.length > 0 ? ` Add more ${issues.join(", ")} before analysis.` : "";
  return `Student profile is ${sparsity.toLowerCase()} and may produce a weak recommendation.${suffix}`;
}

export function buildProfileSparsityWarning(profile: AnyRecord): ProfileSparsityWarning {
  const sectionCounts = Object.fromEntries(
    evidenceSections.map((section) => [section.key, arrayCount(profile, section.fields)]),
  ) as Record<string, number>;
  const filledSections = Object.values(sectionCounts).filter((count) => count > 0).length;
  const missingSections = evidenceSections
    .filter((section) => sectionCounts[section.key] === 0)
    .map((section) => section.label);
  const thinSections = evidenceSections
    .filter((section) => {
      const count = sectionCounts[section.key];
      return count > 0 && count < (section.minimumItems ?? 1);
    })
    .map((section) => section.label);
  const sparsity = profileSparsityLevel(profile);
  const shouldWarn = sparsity === "Missing" || sparsity === "Sparse" || thinSections.length > 0;

  return {
    sparsity,
    shouldWarn,
    message: warningMessage(sparsity, missingSections, thinSections),
    filledSections,
    totalSections: evidenceSections.length,
    sectionCounts,
    missingSections,
    thinSections,
  };
}
