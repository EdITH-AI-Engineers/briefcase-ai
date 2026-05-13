import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { evaluateRun, writeEvaluation } from "./report.js";

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error(
      "usage: npm run evaluate -- <runDir>\n" +
        "  <runDir> is a directory produced by `npm run analyze`, containing\n" +
        "  analyses.json, narratives/, and manifest.json.",
    );
    process.exit(2);
  }
  const runDir = resolve(process.cwd(), arg);
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
