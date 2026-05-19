import { analysisOutputDir } from "@briefcase/shared";
import { access, readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { buildDashboard } from "./dashboard-builder.js";

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function readRun(runId: string) {
  const runDir = join(analysisOutputDir, runId);
  const manifestPath = join(runDir, "manifest.json");
  const analysesPath = join(runDir, "analyses.json");
  if (!(await exists(manifestPath)) || !(await exists(analysesPath))) return null;

  const [manifest, analyses] = await Promise.all([
    readJson<any>(manifestPath),
    readJson<any[]>(analysesPath),
  ]);
  const profilesPath = String(manifest.profilesPath ?? join(runDir, "profiles.json"));
  if (!(await exists(profilesPath))) return null;

  return {
    runDir,
    manifest,
    analyses,
    profiles: await readJson<any[]>(profilesPath),
  };
}

export async function listRuns() {
  let entries: string[] = [];
  try {
    entries = await readdir(analysisOutputDir);
  } catch {
    return [];
  }

  const runs = await Promise.all(
    entries
      .filter((entry) => entry.startsWith("run-"))
      .sort()
      .reverse()
      .map(async (id) => {
        const run = await readRun(id);
        if (!run) return null;
        return {
          id,
          status: run.manifest.status,
          frameworkVersion: run.manifest.framework?.bundleVersion,
          completedAnalyses: run.manifest.completedAnalyses ?? run.analyses.length,
          requestedProfiles: run.manifest.requestedProfiles,
        };
      }),
  );
  return runs.filter((run) => run !== null);
}

export async function getLatestRunId() {
  const [latest] = await listRuns();
  return latest?.id ?? null;
}

export async function getStudents(runId: string) {
  const run = await readRun(runId);
  if (!run) return [];
  const analyzedIds = new Set(run.analyses.map((analysis) => analysis.student_id));
  return run.profiles
    .filter((profile) => analyzedIds.has(profile.id))
    .map((profile) => ({
      id: profile.id,
      name: profile.full_name,
      program: profile.program,
      yearLevel: profile.year_level,
    }));
}

export async function getDashboard(runId: string, studentId: string) {
  const run = await readRun(runId);
  if (!run) return null;
  const profile = run.profiles.find((item) => item.id === studentId);
  const analysis = run.analyses.find((item) => item.student_id === studentId);
  if (!profile || !analysis) return null;
  let narrative = "";
  try {
    narrative = await readFile(join(run.runDir, "narratives", `${studentId}.md`), "utf8");
  } catch {
    narrative = "";
  }
  return buildDashboard({ runId, profile, analysis, manifest: run.manifest, narrative });
}

export async function getLatestDashboard() {
  const runId = await getLatestRunId();
  if (!runId) return null;
  const [student] = await getStudents(runId);
  if (!student) return null;
  return getDashboard(runId, student.id);
}

export async function getFrameworks(runId?: string) {
  const targetRunId = runId ?? (await getLatestRunId());
  if (!targetRunId) return [];
  const run = await readRun(targetRunId);
  return run?.manifest.framework?.docs ?? [];
}
