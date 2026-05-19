import { analysisOutputDir, latestRunDir } from "@briefcase/shared";
import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { evaluateRun, writeEvaluation } from "./report.js";

async function main() {
  const arg = process.argv[2];
  const runDir = arg
    ? resolve(process.cwd(), arg)
    : await latestRunDir(analysisOutputDir);
  if (!runDir) {
    console.error(`No analysis run found under ${analysisOutputDir}.`);
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
