import "dotenv/config";
import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { ANALYSIS, MODEL } from "./config.js";
import { loadFramework } from "./context.js";
import { analyzeDataset, type RunFeatures } from "./runner.js";
import type { AnalysisResult, StudentProfile } from "./types.js";

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

  const framework = await loadFramework(ANALYSIS.frameworkPath);
  console.log(
    `Framework: ${framework.path} (${framework.content.length} chars)`,
  );

  console.log(`Analyzing ${profiles.length} profiles...`);

  const collected: AnalysisResult[] = [];
  let status: RunStatus = "failed";
  let errorMsg: string | undefined;
  let features: RunFeatures | undefined;

  const writeCheckpoint = async () => {
    await writeFile(analysesPath, JSON.stringify(collected, null, 2));
  };

  try {
    await analyzeDataset({
      profiles,
      framework,
      onAnalyze: async (result) => {
        collected.push(result);
        await writeCheckpoint();
      },
      onFeatures: (f) => {
        features = f;
      },
    });
    status = collected.length >= profiles.length ? "success" : "partial";
  } catch (err) {
    errorMsg = err instanceof Error ? err.message : String(err);
    status = collected.length > 0 ? "partial" : "failed";
    console.error(`\nRun aborted: ${errorMsg}`);
  } finally {
    await writeCheckpoint();
    const manifest = {
      runId,
      startedAt,
      finishedAt: new Date().toISOString(),
      status,
      model: MODEL,
      profilesPath: profilesAbs,
      frameworkPath: framework.path,
      requestedProfiles: profiles.length,
      completedAnalyses: collected.length,
      temperature: ANALYSIS.temperature,
      features,
      error: errorMsg,
    };
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(
      `\nStatus: ${status} (${collected.length}/${profiles.length})`,
    );
    console.log(`Analyses: ${analysesPath}`);
    console.log(`Manifest: ${manifestPath}`);
  }

  if (status === "failed") process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
