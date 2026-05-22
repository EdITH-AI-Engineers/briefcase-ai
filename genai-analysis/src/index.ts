import "dotenv/config";
import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { ANALYSIS, MODEL } from "./config.js";
import { loadFramework } from "./context.js";
import { analyzeDataset, type RunFeatures } from "./runner.js";
import { splitSkills } from "./skills.js";
import type {
  AnalysisResult,
  StudentAssessmentResult,
  StudentProfile,
} from "./types.js";

function runStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

// If the configured profiles path doesn't exist, fall back to the newest
// run-*/profiles.json under the same output directory.
async function resolveProfilesPath(configured: string): Promise<string> {
  const abs = resolve(process.cwd(), configured);
  try {
    await access(abs);
    return abs;
  } catch {
    const base = dirname(dirname(abs));
    let entries: string[];
    try {
      entries = await readdir(base);
    } catch {
      throw new Error(
        `Configured profilesPath '${configured}' not found, and the fallback directory '${base}' does not exist either.`,
      );
    }
    const runDirs = entries.filter((e) => e.startsWith("run-")).sort().reverse();
    for (const dir of runDirs) {
      const candidate = join(base, dir, "profiles.json");
      try {
        await access(candidate);
        console.warn(
          `  configured profilesPath not found; auto-selected '${candidate}'`,
        );
        return candidate;
      } catch {
        // Keep searching.
      }
    }
    throw new Error(
      `Configured profilesPath '${configured}' not found and no run-*/profiles.json under '${base}'.`,
    );
  }
}

type RunStatus = "success" | "partial" | "failed";

async function main() {
  const runId = `run-${runStamp()}`;
  const runDir = join(ANALYSIS.outputDir, runId);
  await mkdir(runDir, { recursive: true });
  const narrativesDir = join(runDir, "narratives");
  await mkdir(narrativesDir, { recursive: true });

  const analysesPath = join(runDir, "analyses.json");
  const manifestPath = join(runDir, "manifest.json");
  const startedAt = new Date().toISOString();

  console.log(`Run: ${runId}`);
  console.log(`Output: ${runDir}`);

  const profilesAbs = await resolveProfilesPath(ANALYSIS.profilesPath);
  const rawProfiles = await readFile(profilesAbs, "utf8");
  const profiles = JSON.parse(rawProfiles) as StudentProfile[];
  if (!Array.isArray(profiles)) {
    throw new Error(`Profiles file at ${profilesAbs} is not a JSON array.`);
  }
  console.log(`Profiles: ${profilesAbs} (${profiles.length} entries)`);

  const framework = await loadFramework(ANALYSIS.frameworkManifestPath);
  console.log(
    `Framework bundle: ${framework.manifestPath} (v${framework.bundleVersion}, ${framework.docs.length} docs)`,
  );
  for (const d of framework.docs) {
    console.log(`  - ${d.id} v${d.version}: ${d.title}`);
  }

  console.log(`\nPass 1: assessing and narrating ${profiles.length} profiles...`);

  // Input-order results array; entries are filled in as each concurrent call
  // completes, so the written checkpoint is sparse mid-run but aligns to input
  // order at completion.
  const collected: (StudentAssessmentResult | undefined)[] = new Array(
    profiles.length,
  ).fill(undefined);
  let status: RunStatus = "failed";
  let errorMsg: string | undefined;
  let features: RunFeatures | undefined;
  let narrativesWritten = 0;
  const enrichAnalysis = (
    analysis: AnalysisResult,
    profile?: StudentProfile,
  ): AnalysisResult => {
    if (!profile) {
      console.warn(
        `  no source profile for analysis '${analysis.student_id}'; leaving skills unset`,
      );
      return {
        ...analysis,
        skills: undefined,
      };
    }

    return {
      ...analysis,
      skills: splitSkills(profile.skills ?? []),
    };
  };

  const normalizeResultIds = (
    result: StudentAssessmentResult,
    index: number,
    warnOnDrift = true,
  ): StudentAssessmentResult => {
    const profile = profiles[index];
    if (!profile) {
      console.warn(
        `  no source profile at index ${index}; keeping model-returned ids`,
      );
      return result;
    }

    const authoritativeId = profile.id;
    const analysisStudentId = result.analysis.student_id;
    const narrativeStudentId = result.narrative.student_id;

    if (warnOnDrift && analysisStudentId !== authoritativeId) {
      console.warn(
        `  analysis id drift: model returned '${analysisStudentId}', using profile id '${authoritativeId}'`,
      );
    }
    if (warnOnDrift && narrativeStudentId !== authoritativeId) {
      console.warn(
        `  narrative id drift: model returned '${narrativeStudentId}', using profile id '${authoritativeId}'`,
      );
    }

    return {
      analysis: {
        ...result.analysis,
        student_id: authoritativeId,
      },
      narrative: {
        ...result.narrative,
        student_id: authoritativeId,
      },
    };
  };

  const writeAnalysesCheckpoint = async () => {
    const analyses: AnalysisResult[] = collected.flatMap((r, index) =>
      r ? [enrichAnalysis(r.analysis, profiles[index])] : [],
    );
    await writeFile(analysesPath, JSON.stringify(analyses, null, 2));
  };

  try {
    const assessmentResults = await analyzeDataset({
      profiles,
      framework,
      onAnalyze: async (result, index) => {
        const normalizedResult = normalizeResultIds(result, index);
        collected[index] = normalizedResult;

        // Trust the profile's id, not the model's echoed id. This guards
        // against minor drift and path-injection via a pathological response.
        const authoritativeId = profiles[index]?.id;
        if (!authoritativeId) {
          console.warn(`  skipping unknown profile at index ${index}`);
        } else {
          const body = result.narrative.narrative_markdown.trimEnd();
          const full = `${body}\n\n---\n\n## References\n\n${framework.references}\n`;
          await writeFile(join(narrativesDir, `${authoritativeId}.md`), full);
          narrativesWritten += 1;
        }

        await writeAnalysesCheckpoint();
      },
      onFeatures: (f) => {
        features = f;
      },
    });

    for (let i = 0; i < assessmentResults.length; i++) {
      collected[i] = normalizeResultIds(assessmentResults[i], i, false);
    }

    const finalResults = collected.filter(
      (r): r is StudentAssessmentResult => r !== undefined,
    );

    await writeAnalysesCheckpoint();

    status =
      finalResults.length >= profiles.length &&
      narrativesWritten >= finalResults.length
        ? "success"
        : "partial";
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : String(err);
    const doneCount = collected.filter((r) => r !== undefined).length;
    status = doneCount > 0 ? "partial" : "failed";
    console.error(`\nRun aborted: ${errorMsg}`);
  } finally {
    await writeAnalysesCheckpoint();
    const completedAnalyses = collected.filter(
      (r): r is StudentAssessmentResult => r !== undefined,
    ).length;
    const manifest = {
      runId,
      startedAt,
      finishedAt: new Date().toISOString(),
      status,
      model: MODEL,
      profilesPath: profilesAbs,
      framework: {
        manifestPath: framework.manifestPath,
        bundleVersion: framework.bundleVersion,
        docs: framework.docs.map((d) => ({
          id: d.id,
          version: d.version,
          title: d.title,
          url: d.url,
        })),
      },
      requestedProfiles: profiles.length,
      completedAnalyses,
      completedNarratives: narrativesWritten,
      temperature: ANALYSIS.temperature,
      narrativeTemperature: ANALYSIS.narrativeTemperature,
      features,
      error: errorMsg,
    };
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(
      `\nStatus: ${status} (analyses ${completedAnalyses}/${profiles.length}, narratives ${narrativesWritten}/${completedAnalyses})`,
    );
    console.log(`Analyses: ${analysesPath}`);
    console.log(`Narratives: ${narrativesDir}/`);
    console.log(`Manifest: ${manifestPath}`);
  }

  if (status === "failed") process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
