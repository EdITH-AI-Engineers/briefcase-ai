import { mkdir, readdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

export const repoRoot = resolve(here, "../../..");
export const frameworksDir = join(repoRoot, "frameworks");
export const outputDir = join(repoRoot, "output");
export const profilesOutputDir = join(outputDir, "profiles");
export const analysisOutputDir = join(outputDir, "analysis");
export const fixturesDir = join(repoRoot, "fixtures");
export const demoRunFixturesDir = join(fixturesDir, "demo-run");

export async function ensureOutputDirs(): Promise<void> {
  await Promise.all([
    mkdir(profilesOutputDir, { recursive: true }),
    mkdir(analysisOutputDir, { recursive: true }),
  ]);
}

export async function latestRunDir(baseDir: string): Promise<string | null> {
  let entries: string[];
  try {
    entries = await readdir(baseDir);
  } catch {
    return null;
  }
  const latest = entries.filter((entry) => entry.startsWith("run-")).sort().reverse()[0];
  return latest ? join(baseDir, latest) : null;
}
