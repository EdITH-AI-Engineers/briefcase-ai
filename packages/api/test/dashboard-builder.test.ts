import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildDashboard } from "../src/services/dashboard-builder.ts";

const manifest = {
  status: "success",
  framework: {
    bundleVersion: "1.3.0",
    docs: [
      { id: "ched-25", title: "CHED CMO No. 25", url: "https://example.test/ched" },
      { id: "cc2020", title: "CC2020", url: "https://example.test/cc2020" },
    ],
  },
};

const profile = {
  id: "stu-test-001",
  full_name: "Test Student",
  program: "BSCS",
  year_level: 4,
  skills: [{ name: "Python", rating: 80 }],
  certifications: [],
  awards: [],
  education: [],
  projects: [],
  experience: [],
};

const analysis = {
  summary: "Test summary.",
  competencies: [
    {
      name: "Computing Foundations",
      level: "Proficient",
      evidence: ["Python"],
      citations: [{ doc: "cc2020", clause: "KA-SDF" }],
      notes: "Good programming evidence.",
    },
    {
      name: "Systems & Infrastructure",
      level: "Emerging",
      evidence: [],
      citations: [{ doc: "cc2020", clause: "KA-OS" }],
      notes: "Little systems evidence.",
    },
    {
      name: "Data & Information Management",
      level: "Developing",
      evidence: ["SQL project"],
      citations: [{ doc: "ched-25", clause: "bscs-po-2" }],
      notes: "Some data evidence.",
    },
    {
      name: "Security, Ethics & Professional Responsibility",
      level: "Emerging",
      evidence: [],
      citations: [{ doc: "ched-25", clause: "bscs-po-4" }],
      notes: "Security evidence is sparse.",
    },
    {
      name: "Professional Communication",
      level: "Developing",
      evidence: ["Presentation"],
      citations: [{ doc: "ched-25", clause: "bscs-po-8" }],
      notes: "Some communication evidence.",
    },
    {
      name: "Collaboration & Teamwork",
      level: "Proficient",
      evidence: ["Team lead"],
      citations: [{ doc: "cc2020", clause: "DISP-COLLAB" }],
      notes: "Team evidence exists.",
    },
    {
      name: "Self-Directed Learning & Innovation",
      level: "Proficient",
      evidence: ["Self-directed prototype"],
      citations: [{ doc: "cc2020", clause: "DISP-SELF" }],
      notes: "Learning evidence exists.",
    },
  ],
  gaps: [
    {
      competency: "Systems & Infrastructure",
      issue: "Raw LLM issue should not drive deterministic roadmap.",
      recommendation: "Raw recommendation should not drive deterministic build step.",
    },
  ],
};

describe("buildDashboard", () => {
  it("does not expose fake cohort data", () => {
    const dashboard = buildDashboard({ runId: "run-test", profile, analysis, manifest, narrative: "" });

    assert.equal(JSON.stringify(dashboard).includes("cohort"), false);
    for (const competency of dashboard.competencies) {
      assert.equal(Object.hasOwn(competency, "cohortAverage"), false);
    }
  });

  it("computes missing portfolio evidence from weak competencies", () => {
    const dashboard = buildDashboard({ runId: "run-test", profile, analysis, manifest, narrative: "" });

    assert.deepEqual(dashboard.skills.missing, [
      "deployment logs or runbook",
      "architecture diagram",
      "environment configuration evidence",
      "threat model or security checklist",
      "privacy or ethics reflection",
    ]);
    assert.equal(dashboard.skills.missing.includes("security testing"), false);
    assert.equal(dashboard.skills.missing.includes("technical writing"), false);
  });

  it("varies missing portfolio evidence by weak competency", () => {
    const dashboard = buildDashboard({
      runId: "run-test",
      profile,
      analysis: {
        ...analysis,
        competencies: analysis.competencies.map((competency) => ({
          ...competency,
          level: competency.name === "Professional Communication" ? "Emerging" : "Advanced",
        })),
      },
      manifest,
      narrative: "",
    });

    assert.deepEqual(dashboard.skills.missing, [
      "technical brief or README improvement",
      "presentation slides",
      "peer or advisor feedback",
    ]);
  });

  it("does not report missing evidence already represented by profile skills", () => {
    const dashboard = buildDashboard({
      runId: "run-test",
      profile: {
        ...profile,
        skills: [
          ...profile.skills,
          { name: "Deployment logs", rating: 70 },
          { name: "Architecture diagram", rating: 70 },
        ],
      },
      analysis,
      manifest,
      narrative: "",
    });

    assert.equal(dashboard.skills.missing.includes("deployment logs or runbook"), false);
    assert.equal(dashboard.skills.missing.includes("architecture diagram"), false);
    assert.ok(dashboard.skills.missing.includes("environment configuration evidence"));
  });

  it("keeps missing evidence bounded for sparse or unknown data", () => {
    const dashboard = buildDashboard({
      runId: "run-test",
      profile: { id: "sparse", skills: [{ name: "Unknown Skill", rating: 20 }] },
      analysis: {
        summary: "Sparse summary.",
        competencies: [],
        gaps: [],
      },
      manifest,
      narrative: "",
    });

    assert.deepEqual(dashboard.skills.missing, [
      "project artifact linked to a competency gap",
      "reflection note explaining what the artifact demonstrates",
    ]);
  });

  it("preserves recommendation source behavior for AI keywords", () => {
    const dashboard = buildDashboard({
      runId: "run-test",
      profile,
      analysis: {
        ...analysis,
        gaps: [
          {
            competency: "Systems & Infrastructure",
            recommendation: "Deploy a service with logs.",
            search_keywords: ["  Docker   containers  ", "https://example.test/course", "Docker containers"],
          },
        ],
      },
      manifest,
      narrative: "",
    });

    const systemsRecommendations = dashboard.recommendations.filter(
      (recommendation) => recommendation.relatedCompetency === "Systems & Infrastructure",
    );
    assert.ok(systemsRecommendations.length > 0);
    assert.equal(systemsRecommendations[0]?.source, "ai_keywords");
    assert.match(systemsRecommendations[0]?.url ?? "", /Docker\+containers/);
    assert.equal(systemsRecommendations.some((recommendation) => recommendation.url?.includes("example.test") ?? false), false);
  });

  it("derives framework-based roadmap gaps from weak competency scores", () => {
    const dashboard = buildDashboard({ runId: "run-test", profile, analysis, manifest, narrative: "" });

    const gapNodes = dashboard.roadmap.nodes.filter((node) => node.type === "gap");
    assert.deepEqual(gapNodes.map((node) => node.label), [
      "Systems & Infrastructure",
      "Security, Ethics & Professional Responsibility",
      "Data & Information Management",
    ]);
    assert.match(gapNodes[0].detail, /Little systems evidence\./);

    const topIssue = dashboard.overview.topIssues.find((issue) => issue.competency === "Systems & Infrastructure");
    assert.ok(topIssue, "expected a Systems & Infrastructure top issue");
    assert.equal(topIssue.level, "Emerging");
    assert.equal(topIssue.score, 25);
    assert.equal(topIssue.idealScore, 80);
    assert.equal(topIssue.summary, "Little systems evidence.");
    assert.equal(topIssue.status, "Currently Emerging (25/100), expected 80/100 for Year 4.");
    assert.deepEqual(topIssue.citations.slice(0, 1), [{ doc: "cc2020", clause: "KA-OS" }]);

    const learnNode = dashboard.roadmap.nodes.find((node) => node.id === "course-0");
    const buildNode = dashboard.roadmap.nodes.find((node) => node.id === "project-0");
    const documentNode = dashboard.roadmap.nodes.find((node) => node.id === "evidence-0");

    assert.match(learnNode?.detail ?? "", /operating systems, networking, architecture/);
    assert.match(buildNode?.detail ?? "", /Deploy a service/);
    assert.match(documentNode?.detail ?? "", /architecture diagram/);
  });
});
