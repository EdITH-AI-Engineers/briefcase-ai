import assert from "node:assert/strict";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { app } from "../src/app.ts";

const analysisOutputDir = fileURLToPath(new URL("../../genai-analysis/output", import.meta.url));

describe("api routes", () => {
  it("responds to health checks", async () => {
    const response = await app.request("/api/health");
    const body = await response.json() as { ok?: boolean; service?: string };

    assert.equal(response.status, 200);
    assert.deepEqual(body, { ok: true, service: "briefcase-api" });
  });

  it("returns JSON for unknown routes", async () => {
    const response = await app.request("/api/does-not-exist");
    const body = await response.json() as { error?: string };

    assert.equal(response.status, 404);
    assert.equal(body.error, "Route not found");
  });

  it("returns an empty student list for a missing run", async () => {
    const response = await app.request("/api/runs/run-missing/students");
    const body = await response.json() as { students?: unknown[] };

    assert.equal(response.status, 200);
    assert.deepEqual(body.students, []);
  });

  it("returns 404 for a dashboard in a missing run", async () => {
    const response = await app.request("/api/runs/run-missing/students/stu-missing/dashboard");
    const body = await response.json() as { error?: string };

    assert.equal(response.status, 404);
    assert.equal(body.error, "Student or run not found");
  });

  it("lists runs as an array", async () => {
    const response = await app.request("/api/runs");
    const body = await response.json() as unknown;

    assert.equal(response.status, 200);
    assert.equal(Array.isArray(body), true);
  });

  it("does not list runs with missing profiles files", async () => {
    const runId = `run-test-missing-profiles-${Date.now()}`;
    const runDir = join(analysisOutputDir, runId);

    await mkdir(runDir, { recursive: true });
    try {
      await writeFile(
        join(runDir, "manifest.json"),
        JSON.stringify({ status: "success", profilesPath: "missing-profiles.json" }),
      );
      await writeFile(join(runDir, "analyses.json"), JSON.stringify([]));

      const response = await app.request("/api/runs");
      const body = await response.json() as Array<{ id?: string }>;

      assert.equal(response.status, 200);
      assert.equal(body.some((run) => run.id === runId), false);
    } finally {
      await rm(runDir, { recursive: true, force: true });
    }
  });
});
