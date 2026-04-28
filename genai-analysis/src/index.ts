import "dotenv/config";
import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { aggregateCohort } from "./cohort.js";
import { ANALYSIS, MODEL } from "./config.js";
import { loadFramework } from "./context.js";
import {
  analyzeDataset,
  narrateDataset,
  type RunFeatures,
} from "./runner.js";
import type {
  AnalysisResult,
  CohortComparison,
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
// run-*/profiles.json under the same output directory. Lets the defaults
// "just work" after any synth-data-gen run.
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
        // keep searching
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
  const cohortPath = join(runDir, "cohort.json");
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

  console.log(`\nPass 1: analyzing ${profiles.length} profiles...`);

  // Input-order results array; entries are filled in as each
  // concurrent call completes, so the written checkpoint is sparse
  // mid-run but aligns to input order at completion.
  const collected: (AnalysisResult | undefined)[] = new Array(
    profiles.length,
  ).fill(undefined);
  let status: RunStatus = "failed";
  let errorMsg: string | undefined;
  let features: RunFeatures | undefined;
  let cohortMap: Map<string, CohortComparison> = new Map();
  let narrativesWritten = 0;

  const writeAnalysesCheckpoint = async () => {
    // Compact: write only completed entries, preserving input order.
    const completed = collected.filter(
      (r): r is AnalysisResult => r !== undefined,
    );
    await writeFile(analysesPath, JSON.stringify(completed, null, 2));
  };

  try {
    const analyzeResults = await analyzeDataset({
      profiles,
      framework,
      onAnalyze: async (result, index) => {
        collected[index] = result;
        await writeAnalysesCheckpoint();
      },
      onFeatures: (f) => {
        features = f;
      },
    });
    // analyzeResults is already in input order — overwrite in case any
    // onAnalyze slot didn't land (it always should, but defensive).
    for (let i = 0; i < analyzeResults.length; i++) {
      collected[i] = analyzeResults[i];
    }

    const finalAnalyses = collected.filter(
      (r): r is AnalysisResult => r !== undefined,
    );

    // Pass 2 — deterministic cohort aggregation.
    console.log(`\nPass 2: aggregating cohort (${finalAnalyses.length} students)...`);
    cohortMap = aggregateCohort(finalAnalyses);
    for (const r of finalAnalyses) {
      r.cohort = cohortMap.get(r.student_id);
    }
    await writeAnalysesCheckpoint();
    await writeFile(
      cohortPath,
      JSON.stringify(Object.fromEntries(cohortMap), null, 2),
    );

    // Pass 3 — per-student narrative.
    console.log(`\nPass 3: narrating ${finalAnalyses.length} profiles...`);
    const profileIds = new Set(profiles.map((p) => p.id));
    await narrateDataset({
      profiles,
      analyses: finalAnalyses,
      framework,
      onNarrate: async (modelStudentId, narrativeMarkdown, index) => {
        // Trust the profile's id, not the model's echoed id — guards
        // against both minor drift ("CASE" flips) and path-injection
        // via a pathological model response.
        const authoritativeId = profiles[index].id;
        if (modelStudentId !== authoritativeId) {
          console.warn(
            `  narrative id drift: model returned '${modelStudentId}', using profile id '${authoritativeId}'`,
          );
        }
        if (!profileIds.has(authoritativeId)) {
          console.warn(`  skipping unknown profile id ${authoritativeId}`);
          return;
        }
        const body = narrativeMarkdown.trimEnd();
        const full = `${body}\n\n---\n\n## References\n\n${framework.references}\n`;
        await writeFile(join(narrativesDir, `${authoritativeId}.md`), full);
        narrativesWritten += 1;
      },
      onFeatures: (f) => {
        if (features) features.narrativeCache = f.narrativeCache;
      },
    });

    status =
      finalAnalyses.length >= profiles.length &&
      narrativesWritten >= finalAnalyses.length
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
      (r): r is AnalysisResult => r !== undefined,
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
      cohortSize: cohortMap.size,
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
    console.log(`Cohort:   ${cohortPath}`);
    console.log(`Narratives: ${narrativesDir}/`);
    console.log(`Manifest: ${manifestPath}`);
  }

  if (status === "failed") process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
