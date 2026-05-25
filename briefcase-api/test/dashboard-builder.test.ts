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
      recommendation: "Deploy one backend project with documented Docker, logs, monitoring, and environment setup.",
      search_keywords: ["docker for developers", "cloud deployment"],
    },
    {
      competency: "Professional Communication",
      issue: "Communication artifacts are implied but not documented.",
      recommendation: "Publish a short technical write-up or project README explaining design decisions.",
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

  it("builds roadmap actions from generated analysis gaps", () => {
    const dashboard = buildDashboard({ runId: "run-test", profile, analysis, manifest, narrative: "" });

    const gapNodes = dashboard.roadmap.nodes.filter((node) => node.type === "gap");
    assert.deepEqual(gapNodes.map((node) => node.label), [
      "Systems & Infrastructure",
      "Professional Communication",
    ]);
    assert.equal(gapNodes[0].detail, "Raw LLM issue should not drive deterministic roadmap.");

    const learnNode = dashboard.roadmap.nodes.find((node) => node.id === "course-0");
    const buildNode = dashboard.roadmap.nodes.find((node) => node.id === "project-0");
    const documentNode = dashboard.roadmap.nodes.find((node) => node.id === "evidence-0");

    assert.match(learnNode?.detail ?? "", /docker for developers, cloud deployment/);
    assert.equal(buildNode?.detail, "Deploy one backend project with documented Docker, logs, monitoring, and environment setup.");
    assert.match(documentNode?.detail ?? "", /Raw LLM issue should not drive deterministic roadmap/);
  });

  it("keeps course-specific generated competencies even when they are not in the assessment list", () => {
    const dashboard = buildDashboard({
      runId: "run-test",
      profile,
      manifest,
      narrative: "",
      analysis: {
        ...analysis,
        gaps: [
          {
            area: "Capstone Research Methods",
            reason: "The course output requires stronger evidence of research design and validation.",
            recommendation: "Create a validation plan with research questions, metrics, and advisor feedback.",
            search_keywords: ["research design", "capstone validation"],
          },
        ],
      },
    });

    const gapNode = dashboard.roadmap.nodes.find((node) => node.type === "gap");
    const buildNode = dashboard.roadmap.nodes.find((node) => node.type === "project");

    assert.equal(gapNode?.label, "Capstone Research Methods");
    assert.equal(gapNode?.detail, "The course output requires stronger evidence of research design and validation.");
    assert.equal(buildNode?.detail, "Create a validation plan with research questions, metrics, and advisor feedback.");
  });

  it("accepts generated skill percentages as dashboard ratings", () => {
    const dashboard = buildDashboard({
      runId: "run-test",
      profile: {
        ...profile,
        skills: [{ name: "MongoDB", level: "Expert", percentage: 88 }],
      },
      analysis,
      manifest,
      narrative: "",
    });

    assert.deepEqual(dashboard.skills.hard, [{ name: "MongoDB", rating: 88 }]);
  });

  it("prefers generated analysis fields over profile fallbacks", () => {
    const dashboard = buildDashboard({
      runId: "run-test",
      profile: {
        ...profile,
        id: "profile-id",
        program: "profile-program",
        skills: [{ name: "Python", rating: 80 }],
      },
      analysis: {
        ...analysis,
        student_id: "analysis-id",
        program: "analysis-program",
        skills: {
          hard: [{ name: "Data Modeling", percentage: 91 }],
          soft: [{ name: "Stakeholder Communication", percentage: 76 }],
          uncategorized: [{ name: "Domain Discovery", percentage: 68 }],
        },
      },
      manifest,
      narrative: "",
    });

    assert.equal(dashboard.student.id, "analysis-id");
    assert.equal(dashboard.student.program, "analysis-program");
    assert.deepEqual(dashboard.skills.hard, [{ name: "Data Modeling", rating: 91 }]);
    assert.deepEqual(dashboard.skills.soft, [{ name: "Stakeholder Communication", rating: 76 }]);
    assert.deepEqual(dashboard.skills.uncategorized, [{ name: "Domain Discovery", rating: 68 }]);
  });
});
