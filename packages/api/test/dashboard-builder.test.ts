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

  it("derives framework-based roadmap gaps from weak competency scores", () => {
    const dashboard = buildDashboard({ runId: "run-test", profile, analysis, manifest, narrative: "" });

    const gapNodes = dashboard.roadmap.nodes.filter((node) => node.type === "gap");
    assert.deepEqual(gapNodes.map((node) => node.label), [
      "Systems & Infrastructure",
      "Security, Ethics & Professional Responsibility",
      "Data & Information Management",
    ]);
    assert.match(gapNodes[0].detail, /Emerging vs ideal 80\/100/);
    assert.match(gapNodes[0].detail, /Framework basis: cc2020:KA-OS/);

    const learnNode = dashboard.roadmap.nodes.find((node) => node.id === "course-0");
    const buildNode = dashboard.roadmap.nodes.find((node) => node.id === "project-0");
    const documentNode = dashboard.roadmap.nodes.find((node) => node.id === "evidence-0");

    assert.match(learnNode?.detail ?? "", /operating systems, networking, architecture/);
    assert.match(buildNode?.detail ?? "", /Deploy a service/);
    assert.match(documentNode?.detail ?? "", /architecture diagram/);
  });
});
