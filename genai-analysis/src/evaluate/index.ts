import { access, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { evaluateRun, writeEvaluation } from "./report.js";

async function latestRunDir(): Promise<string | null> {
  const outputDir = resolve(process.cwd(), "output");
  let entries;
  try {
    entries = await readdir(outputDir, { withFileTypes: true });
  } catch {
    return null;
  }

  const latest = entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("run-"))
    .map((entry) => entry.name)
    .sort()
    .reverse()[0];
  return latest ? join(outputDir, latest) : null;
}

async function main() {
  const arg = process.argv[2];
  const runDir = arg ? resolve(process.cwd(), arg) : await latestRunDir();
  if (!runDir) {
    console.error(
      "usage: npm run evaluate -- [runDir]\n" +
        "  runDir defaults to the newest output/run-* directory.\n" +
        "  It must contain\n" +
        "  analyses.json, narratives/, and manifest.json.",
    );
    process.exit(2);
  }
  try {
    await access(runDir);
  } catch {
    console.error(`Run directory not found: ${runDir}`);
    process.exit(2);
  }

  console.log(`Evaluating: ${runDir}`);
  const result = await evaluateRun(runDir);
  await writeEvaluation(runDir, result);

  console.log(`Overall: ${result.overallPass ? "PASS" : "FAIL"}`);
  if (!result.overallPass) {
    console.log("Failing metrics:");
    for (const f of result.failingMetrics) console.log(`  - ${f}`);
  }
  console.log(`\nWrote: ${runDir}/evaluation.json`);
  console.log(`Wrote: ${runDir}/evaluation.md`);
  if (!result.overallPass) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
