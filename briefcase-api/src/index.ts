import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { getDashboard, getFrameworks, getLatestDashboard, getStudents, listRuns } from "./services/run-store.js";

const app = new Hono();
app.use("*", cors({ origin: ["http://localhost:5173", "http://127.0.0.1:5173"] }));

app.get("/api/health", (c) => c.json({ ok: true, service: "briefcase-api" }));
app.get("/api/runs", async (c) => c.json(await listRuns()));
app.get("/api/dashboard/latest", async (c) => {
  const dashboard = await getLatestDashboard();
  if (!dashboard) return c.json({ dashboard: null });
  return c.json({ dashboard });
});
app.get("/api/runs/:runId/students", async (c) => c.json(await getStudents(c.req.param("runId"))));
app.get("/api/runs/:runId/students/:studentId/dashboard", async (c) => {
  const dashboard = await getDashboard(c.req.param("runId"), c.req.param("studentId"));
  if (!dashboard) return c.json({ error: "Student or run not found" }, 404);
  return c.json(dashboard);
});
app.get("/api/frameworks", async (c) => c.json(await getFrameworks()));

const port = Number(process.env.PORT ?? 8787);
serve({ fetch: app.fetch, port }, (info) => {
  console.log(`briefcase-api listening on http://localhost:${info.port}`);
});
