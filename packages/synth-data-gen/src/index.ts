import { assertStudentProfiles, loadRootEnv, profilesOutputDir } from "@briefcase/shared";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { COLUMNS, CONTEXT, GENERATION, MODEL } from "./config.js";

loadRootEnv();
import {
  generateDataset,
  type Profile,
  type RunFeatures,
} from "./generate.js";

function runStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

type RunStatus = "success" | "partial" | "failed";

async function main() {
  const runId = `run-${runStamp()}`;
  const runDir = join(profilesOutputDir, runId);
  await mkdir(runDir, { recursive: true });

  const profilesPath = join(runDir, "profiles.json");
  const manifestPath = join(runDir, "manifest.json");
  const startedAt = new Date().toISOString();
  const collected: Profile[] = [];
  let status: RunStatus = "failed";
  let errorMsg: string | undefined;
  let features: RunFeatures | undefined;

  console.log(`Run: ${runId}`);
  console.log(`Output: ${runDir}`);
  console.log(
    `Generating ${GENERATION.totalRows} profiles in batches of ${GENERATION.batchSize}...`,
  );

  const writeCheckpoint = async () => {
    assertStudentProfiles(collected);
    await writeFile(profilesPath, JSON.stringify(collected, null, 2));
  };

  try {
    await generateDataset(GENERATION.totalRows, GENERATION.batchSize, {
      onBatch: async (batch) => {
        collected.push(...batch);
        await writeCheckpoint();
      },
      onFeatures: (f) => {
        features = f;
      },
    });
    status = collected.length >= GENERATION.totalRows ? "success" : "partial";
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
      requested: GENERATION.totalRows,
      collected: collected.length,
      batchSize: GENERATION.batchSize,
      temperature: GENERATION.temperature,
      features,
      columns: Object.keys(COLUMNS),
      context: CONTEXT,
      error: errorMsg,
    };
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`\nStatus: ${status} (${collected.length}/${GENERATION.totalRows})`);
    console.log(`Profiles: ${profilesPath}`);
    console.log(`Manifest: ${manifestPath}`);
  }

  if (status === "failed") process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
