import { access, readdir, readFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDashboard } from "./dashboard-builder.js";

type AnyRecord = Record<string, unknown>;
type RunManifest = {
  status?: string;
  profilesPath?: string;
  requestedProfiles?: number;
  completedAnalyses?: number;
  framework?: {
    bundleVersion?: string;
    docs?: unknown;
  };
};
type AnalysisRecord = AnyRecord & { student_id: string };
type ProfileRecord = AnyRecord & { id: string };

const here = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = resolve(here, "../../..");
const analysisOutputDir = join(repoRoot, "genai-analysis", "output");
const synthOutputDir = join(repoRoot, "synth-data-gen", "output");

function isRecord(value: unknown): value is AnyRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAnalysisRecord(value: unknown): value is AnalysisRecord {
  return isRecord(value) && typeof value.student_id === "string" && value.student_id.trim().length > 0;
}

function isProfileRecord(value: unknown): value is ProfileRecord {
  return isRecord(value) && typeof value.id === "string" && value.id.trim().length > 0;
}

function isPathInside(path: string, root: string): boolean {
  const rel = relative(resolve(root), resolve(path));
  return rel === "" || (!!rel && !rel.startsWith("..") && !isAbsolute(rel));
}

function resolveAllowedProfilesPath(runDir: string, manifest: RunManifest): string | null {
  const configured = typeof manifest.profilesPath === "string" && manifest.profilesPath.trim()
    ? manifest.profilesPath
    : join(runDir, "profiles.json");
  const profilesPath = resolve(runDir, configured);
  const allowedRoots = [runDir, synthOutputDir];
  return allowedRoots.some((root) => isPathInside(profilesPath, root)) ? profilesPath : null;
}

function parseManifest(value: unknown): RunManifest | null {
  if (!isRecord(value)) return null;
  return {
    ...(typeof value.status === "string" ? { status: value.status } : {}),
    ...(typeof value.profilesPath === "string" ? { profilesPath: value.profilesPath } : {}),
    ...(typeof value.requestedProfiles === "number" ? { requestedProfiles: value.requestedProfiles } : {}),
    ...(typeof value.completedAnalyses === "number" ? { completedAnalyses: value.completedAnalyses } : {}),
    ...(isRecord(value.framework) ? { framework: value.framework as RunManifest["framework"] } : {}),
  };
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8")) as unknown;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function isRunId(runId: string): boolean {
  return /^run-[a-zA-Z0-9._-]+$/.test(runId);
}

async function readRunMetadata(runId: string) {
  if (!isRunId(runId)) return null;
  const runDir = join(analysisOutputDir, runId);
  const manifestPath = join(runDir, "manifest.json");
  const analysesPath = join(runDir, "analyses.json");
  if (!(await exists(manifestPath)) || !(await exists(analysesPath))) return null;

  try {
    const [rawManifest, rawAnalyses] = await Promise.all([
      readJson(manifestPath),
      readJson(analysesPath),
    ]);
    const manifest = parseManifest(rawManifest);
    if (!manifest || !Array.isArray(rawAnalyses)) return null;

    const analyses = rawAnalyses.filter(isAnalysisRecord);
    if (analyses.length === 0 && rawAnalyses.length > 0) return null;

    return { runDir, manifest, analyses };
  } catch {
    return null;
  }
}

async function readRun(runId: string) {
  const metadata = await readRunMetadata(runId);
  if (!metadata) return null;

  const { runDir, manifest, analyses } = metadata;
  const profilesPath = resolveAllowedProfilesPath(runDir, manifest);
  if (!profilesPath) return null;
  if (!(await exists(profilesPath))) return null;

  const rawProfiles = await readJson(profilesPath);
  if (!Array.isArray(rawProfiles)) return null;
  const profiles = rawProfiles.filter(isProfileRecord);

  return {
    runDir,
    manifest,
    analyses,
    profiles,
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
        const run = await readRunMetadata(id);
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
