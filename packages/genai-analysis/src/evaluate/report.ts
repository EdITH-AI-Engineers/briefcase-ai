import { readdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import type { AnalysisResult, StudentProfile } from "../types.js";
import { overlapRatio, rougeL, summarize } from "./metrics.js";
import type {
  EvaluationResult,
  NarrativeMetrics,
  PerStudentEval,
  StructuredMetrics,
  StudentFlag,
  Thresholds,
} from "./types.js";
import { DEFAULT_THRESHOLDS } from "./types.js";
import {
  citationMatchesProgram,
  clauseExistsInDoc,
  extractNarrativeCitations,
  loadFrameworkTexts,
  locateClauseText,
  REQUIRED_NARRATIVE_SECTIONS,
  sectionsInOrder,
  SLATE_COMPETENCIES,
  splitSentencesWithTags,
  stripReferencesFooter,
  type FrameworkBundleText,
  type ParsedCitation,
} from "./validators.js";

type RunManifest = {
  runId: string;
  framework?: {
    manifestPath?: string;
    bundleVersion?: string;
  };
};

// Extract just the *textual values* from a profile (skipping JSON
// keys). This is what an LLM narrative actually echoes — not
// "certifications" and "tech" (field names), but the cert names and
// tech strings themselves. Using this as the reference for ROUGE-L
// groundedness avoids penalizing the narrative for not mentioning
// the JSON structure.
function serializeProfile(p: StudentProfile): string {
  const parts: string[] = [];
  const walk = (v: unknown): void => {
    if (v == null) return;
    if (typeof v === "string" || typeof v === "number") {
      parts.push(String(v));
    } else if (Array.isArray(v)) {
      for (const x of v) walk(x);
    } else if (typeof v === "object") {
      for (const x of Object.values(v)) walk(x);
    }
  };
  walk(p);
  return parts.join(" ");
}

function profileById(profiles: StudentProfile[]): Map<string, StudentProfile> {
  const m = new Map<string, StudentProfile>();
  for (const p of profiles) m.set(p.id, p);
  return m;
}

function narrativePathsInDir(dir: string): Promise<string[]> {
  return readdir(dir).then((files) =>
    files.filter((f) => f.endsWith(".md")).map((f) => join(dir, f)),
  );
}

export async function evaluateRun(
  runDir: string,
  thresholds: Thresholds = DEFAULT_THRESHOLDS,
): Promise<EvaluationResult> {
  const manifestPath = join(runDir, "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as RunManifest;

  const bundleManifestPath = manifest.framework?.manifestPath;
  if (!bundleManifestPath) {
    throw new Error(
      `Run manifest at ${manifestPath} has no framework.manifestPath.`,
    );
  }
  const bundle = await loadFrameworkTexts(bundleManifestPath);

  const analyses = JSON.parse(
    await readFile(join(runDir, "analyses.json"), "utf8"),
  ) as AnalysisResult[];

  const profilesPath = await findProfilesPath(runDir);
  const profiles = JSON.parse(await readFile(profilesPath, "utf8")) as StudentProfile[];
  const byId = profileById(profiles);

  const flagsById = new Map<string, StudentFlag[]>();
  const addFlag = (id: string, f: StudentFlag) => {
    const arr = flagsById.get(id) ?? [];
    arr.push(f);
    flagsById.set(id, arr);
  };

  const structured = evaluateStructured(
    analyses,
    byId,
    bundle,
    thresholds,
    addFlag,
  );

  const narrativesDir = join(runDir, "narratives");
  const narrativeFiles = await narrativePathsInDir(narrativesDir);
  const narrative = await evaluateNarratives(
    narrativeFiles,
    byId,
    bundle,
    thresholds,
    addFlag,
  );

  const perStudent: PerStudentEval[] = analyses.map((a) => ({
    student_id: a.student_id,
    program: a.program,
    flags: flagsById.get(a.student_id) ?? [],
  }));

  const { overallPass, failingMetrics } = checkThresholds(
    structured,
    narrative,
    thresholds,
  );

  return {
    runId: manifest.runId ?? basename(runDir),
    runDir,
    bundleVersion: manifest.framework?.bundleVersion ?? "unknown",
    generatedAt: new Date().toISOString(),
    thresholds,
    structured,
    narrative,
    perStudent,
    overallPass,
    failingMetrics,
  };
}

// Resolve the profiles.json path: read the absolute path recorded in
// the run manifest. Throws a clear error if missing, since evaluating
// a run without its source profiles produces meaningless groundedness
// and evidence metrics.
async function findProfilesPath(runDir: string): Promise<string> {
  const manifestPath = join(runDir, "manifest.json");
  const m = JSON.parse(await readFile(manifestPath, "utf8")) as {
    profilesPath?: string;
  };
  if (!m.profilesPath) {
    throw new Error(
      `Run manifest at ${manifestPath} has no profilesPath; cannot evaluate groundedness or evidence against source profiles.`,
    );
  }
  return m.profilesPath;
}

function evaluateStructured(
  analyses: AnalysisResult[],
  byId: Map<string, StudentProfile>,
  bundle: FrameworkBundleText,
  thresholds: Thresholds,
  addFlag: (id: string, f: StudentFlag) => void,
): StructuredMetrics {
  let totalCitations = 0;
  let invalidCitations = 0;
  let totalEvidence = 0;
  let evidenceBelowThreshold = 0;
  let coverageOk = 0;
  let slateConsistent = 0;
  let wrongProgramClauseCount = 0;

  for (const r of analyses) {
    const profile = byId.get(r.student_id);
    const profileText = profile ? serializeProfile(profile) : "";

    // Coverage check.
    const names = r.competencies.map((c) => c.name);
    const coverageMatches =
      names.length === SLATE_COMPETENCIES.length &&
      SLATE_COMPETENCIES.every((n, i) => names[i] === n);
    if (coverageMatches) coverageOk += 1;
    else {
      addFlag(r.student_id, {
        kind: "missing_competency",
        detail: `expected ${SLATE_COMPETENCIES.length} slate entries; got ${names.length} (${names.join(", ")})`,
      });
    }

    let studentWrongProgramClauses = 0;
    for (const c of r.competencies) {
      for (const cite of c.citations) {
        totalCitations += 1;
        if (!clauseExistsInDoc(cite.doc, cite.clause, bundle)) {
          invalidCitations += 1;
          addFlag(r.student_id, {
            kind: "invalid_citation_structured",
            detail: `${cite.doc}:${cite.clause} in competency "${c.name}"`,
          });
        }
        if (!citationMatchesProgram(r.program, cite.doc)) {
          studentWrongProgramClauses += 1;
          wrongProgramClauseCount += 1;
          addFlag(r.student_id, {
            kind: "wrong_program_clause",
            detail: `${cite.doc}:${cite.clause} cited for program ${r.program}`,
          });
        }
      }

      for (const ev of c.evidence) {
        totalEvidence += 1;
        const ratio = overlapRatio(ev, profileText);
        if (ratio < thresholds.evidenceOverlapThreshold) {
          evidenceBelowThreshold += 1;
          addFlag(r.student_id, {
            kind: "evidence_not_in_profile",
            detail: `"${ev.slice(0, 80)}${ev.length > 80 ? "…" : ""}" (overlap ${ratio.toFixed(2)})`,
          });
        }
      }
    }

    if (studentWrongProgramClauses === 0) slateConsistent += 1;
  }

  const total = analyses.length;
  return {
    totalStudents: total,
    citationValidityRate:
      totalCitations === 0 ? 1 : 1 - invalidCitations / totalCitations,
    invalidCitationCount: invalidCitations,
    evidenceInProfileRate:
      totalEvidence === 0 ? 1 : 1 - evidenceBelowThreshold / totalEvidence,
    evidenceBelowThresholdCount: evidenceBelowThreshold,
    competencyCoverageRate: total === 0 ? 1 : coverageOk / total,
    programSlateConsistencyRate: total === 0 ? 1 : slateConsistent / total,
    wrongProgramClauseCount,
  };
}

async function evaluateNarratives(
  paths: string[],
  byId: Map<string, StudentProfile>,
  bundle: FrameworkBundleText,
  thresholds: Thresholds,
  addFlag: (id: string, f: StudentFlag) => void,
): Promise<NarrativeMetrics> {
  let totalCitations = 0;
  let invalidCitations = 0;
  let structureOk = 0;
  const taggedRatios: number[] = [];
  const groundednessValues: number[] = [];
  const alignmentValues: number[] = [];
  let alignmentBelow = 0;

  for (const p of paths) {
    const full = await readFile(p, "utf8");
    const body = stripReferencesFooter(full);
    const studentId = basename(p, ".md");

    // Structure
    const structured = sectionsInOrder(body);
    if (structured) {
      structureOk += 1;
    } else {
      const missing = REQUIRED_NARRATIVE_SECTIONS.filter(
        (s) => body.indexOf(`## ${s}`) === -1,
      );
      addFlag(studentId, {
        kind: "missing_section",
        detail: missing.length ? `missing: ${missing.join(", ")}` : "sections out of order",
      });
    }

    // Citations
    const cites = extractNarrativeCitations(body);
    for (const c of cites) {
      totalCitations += 1;
      if (!clauseExistsInDoc(c.doc, c.clause, bundle)) {
        invalidCitations += 1;
        addFlag(studentId, {
          kind: "invalid_citation_narrative",
          detail: `${c.doc}:${c.clause}`,
        });
      }
    }

    // Tagged sentences
    const { tagged, totalSentences } = splitSentencesWithTags(body);
    const ratio = totalSentences === 0 ? 0 : tagged.length / totalSentences;
    taggedRatios.push(ratio);
    if (ratio < thresholds.taggedSentenceRateMin) {
      addFlag(studentId, {
        kind: "low_tagged_sentence_rate",
        detail: `${(ratio * 100).toFixed(0)}% of sentences tagged (${tagged.length}/${totalSentences})`,
      });
    }

    // Groundedness: what fraction of the profile's content tokens
    // appear in the narrative. Uses overlapRatio in profile->narrative
    // direction so the score is comparable across narrative lengths
    // (ROUGE-L F1 with a tiny reference and a long candidate is
    // dominated by precision and under-reports grounding). We still
    // compute and store the ROUGE-L F1 alongside for diagnostics.
    const profile = byId.get(studentId);
    if (profile) {
      const refValues = serializeProfile(profile);
      const grounded = overlapRatio(refValues, body); // frac of profile tokens echoed
      groundednessValues.push(grounded);
      if (grounded < thresholds.groundednessMeanMin) {
        addFlag(studentId, {
          kind: "low_groundedness",
          detail: `overlap ${grounded.toFixed(3)} < ${thresholds.groundednessMeanMin}`,
        });
      }
    }

    // Framework alignment: for each tagged sentence, ROUGE-L
    // between the sentence and the cited clause descriptor.
    for (const t of tagged) {
      const refs: string[] = [];
      for (const c of t.citations) {
        const text = locateClauseText(c.doc, c.clause, bundle);
        if (text) refs.push(text);
      }
      if (refs.length === 0) continue;
      const combinedRef = refs.join(" ");
      const a = rougeL(t.text, combinedRef);
      alignmentValues.push(a.f1);
      if (a.f1 < thresholds.frameworkAlignmentMeanMin) {
        alignmentBelow += 1;
        addFlag(studentId, {
          kind: "low_framework_alignment",
          detail: `"${t.text.slice(0, 80)}${t.text.length > 80 ? "…" : ""}" rougeL-f1 ${a.f1.toFixed(3)}`,
        });
      }
    }
  }

  const total = paths.length;
  const avg = (xs: number[]) =>
    xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;

  return {
    totalNarratives: total,
    sectionStructureComplianceRate: total === 0 ? 1 : structureOk / total,
    citationValidityRate:
      totalCitations === 0 ? 1 : 1 - invalidCitations / totalCitations,
    invalidCitationCount: invalidCitations,
    taggedSentenceRate: avg(taggedRatios),
    groundedness: summarize(groundednessValues),
    frameworkAlignment: summarize(alignmentValues),
    frameworkAlignmentBelowThresholdCount: alignmentBelow,
  };
}

function checkThresholds(
  s: StructuredMetrics,
  n: NarrativeMetrics,
  t: Thresholds,
): { overallPass: boolean; failingMetrics: string[] } {
  const fails: string[] = [];
  if (s.citationValidityRate < t.citationValidityRateMin)
    fails.push(`structured.citationValidityRate=${s.citationValidityRate.toFixed(3)} < ${t.citationValidityRateMin}`);
  if (s.evidenceInProfileRate < t.evidenceInProfileRateMin)
    fails.push(`structured.evidenceInProfileRate=${s.evidenceInProfileRate.toFixed(3)} < ${t.evidenceInProfileRateMin}`);
  if (s.competencyCoverageRate < t.competencyCoverageRateMin)
    fails.push(`structured.competencyCoverageRate=${s.competencyCoverageRate.toFixed(3)} < ${t.competencyCoverageRateMin}`);
  if (s.programSlateConsistencyRate < t.programSlateConsistencyRateMin)
    fails.push(`structured.programSlateConsistencyRate=${s.programSlateConsistencyRate.toFixed(3)} < ${t.programSlateConsistencyRateMin}`);
  if (n.sectionStructureComplianceRate < t.sectionStructureComplianceRateMin)
    fails.push(`narrative.sectionStructureComplianceRate=${n.sectionStructureComplianceRate.toFixed(3)} < ${t.sectionStructureComplianceRateMin}`);
  if (n.citationValidityRate < t.citationValidityRateMin)
    fails.push(`narrative.citationValidityRate=${n.citationValidityRate.toFixed(3)} < ${t.citationValidityRateMin}`);
  if (n.taggedSentenceRate < t.taggedSentenceRateMin)
    fails.push(`narrative.taggedSentenceRate=${n.taggedSentenceRate.toFixed(3)} < ${t.taggedSentenceRateMin}`);
  if (n.groundedness.mean < t.groundednessMeanMin)
    fails.push(`narrative.groundedness.mean=${n.groundedness.mean.toFixed(3)} < ${t.groundednessMeanMin} (hallucinated)`);
  if (n.frameworkAlignment.mean < t.frameworkAlignmentMeanMin)
    fails.push(`narrative.frameworkAlignment.mean=${n.frameworkAlignment.mean.toFixed(3)} < ${t.frameworkAlignmentMeanMin}`);
  return { overallPass: fails.length === 0, failingMetrics: fails };
}

export async function writeEvaluation(
  runDir: string,
  result: EvaluationResult,
): Promise<void> {
  await writeFile(
    join(runDir, "evaluation.json"),
    JSON.stringify(result, null, 2),
  );
  await writeFile(join(runDir, "evaluation.md"), renderMarkdown(result));
}

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

function renderMarkdown(r: EvaluationResult): string {
  const lines: string[] = [];
  lines.push(`# Evaluation — ${r.runId}`);
  lines.push("");
  lines.push(`- Generated: ${r.generatedAt}`);
  lines.push(`- Bundle version: ${r.bundleVersion}`);
  lines.push(`- Run dir: ${r.runDir}`);
  lines.push(`- Overall: ${r.overallPass ? "✅ PASS" : "❌ FAIL"}`);
  if (r.failingMetrics.length) {
    lines.push("");
    lines.push("## Failing metrics");
    for (const f of r.failingMetrics) lines.push(`- ${f}`);
  }

  lines.push("");
  lines.push("## Structured assessment (analyses.json)");
  lines.push(`- Students evaluated: ${r.structured.totalStudents}`);
  lines.push(`- Citation validity: ${pct(r.structured.citationValidityRate)} (${r.structured.invalidCitationCount} invalid)`);
  lines.push(`- Evidence-in-profile: ${pct(r.structured.evidenceInProfileRate)} (${r.structured.evidenceBelowThresholdCount} below threshold)`);
  lines.push(`- Competency coverage (exact slate): ${pct(r.structured.competencyCoverageRate)}`);
  lines.push(`- Program-slate consistency: ${pct(r.structured.programSlateConsistencyRate)} (${r.structured.wrongProgramClauseCount} wrong-program clauses)`);

  lines.push("");
  lines.push("## Narratives");
  lines.push(`- Narratives evaluated: ${r.narrative.totalNarratives}`);
  lines.push(`- Section structure compliance: ${pct(r.narrative.sectionStructureComplianceRate)}`);
  lines.push(`- Citation validity: ${pct(r.narrative.citationValidityRate)} (${r.narrative.invalidCitationCount} invalid)`);
  lines.push(`- Tagged-sentence rate (mean): ${pct(r.narrative.taggedSentenceRate)}`);
  lines.push(`- Groundedness (profile→narrative token overlap): mean ${r.narrative.groundedness.mean.toFixed(3)} (stdev ${r.narrative.groundedness.stdev.toFixed(3)}, min ${r.narrative.groundedness.min.toFixed(3)}, max ${r.narrative.groundedness.max.toFixed(3)})`);
  lines.push(`- Framework alignment (ROUGE-L sentence vs. cited clause): mean ${r.narrative.frameworkAlignment.mean.toFixed(3)} over ${r.narrative.frameworkAlignment.count} tagged sentences (${r.narrative.frameworkAlignmentBelowThresholdCount} below threshold)`);

  lines.push("");
  lines.push("## Per-student flags");
  const flagged = r.perStudent.filter((p) => p.flags.length > 0);
  if (flagged.length === 0) {
    lines.push("No per-student flags raised.");
  } else {
    lines.push(`${flagged.length} of ${r.perStudent.length} students have at least one flag.`);
    lines.push("");
    for (const p of flagged) {
      lines.push(`### ${p.student_id} (${p.program})`);
      for (const f of p.flags) {
        lines.push(`- **${f.kind}** — ${f.detail}`);
      }
      lines.push("");
    }
  }

  return lines.join("\n") + "\n";
}
