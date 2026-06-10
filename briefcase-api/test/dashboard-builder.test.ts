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

  it("returns full evidence section lists instead of counts", () => {
    const dashboard = buildDashboard({
      runId: "run-test",
      profile: {
        ...profile,
        skills: [{ name: "Python", rating: 80 }],
        projects: [{ title: "Portfolio API" }],
        experience: [{ company: "Campus Lab" }],
        work_experience: [{ company: "Internship" }],
        educational_qualification: [{ school: "FEU Tech" }],
        educational_qualifications: [{ school: "Online Program" }],
        licenses_certifications: [{ name: "Cloud Foundations" }],
        honors_awards: [{ title: "Dean's Lister" }],
        seminars_trainings: [{ title: "AI Bootcamp" }],
        organizations_memberships: [{ name: "Computer Society" }],
      },
      analysis,
      manifest,
      narrative: "",
    });

    assert.equal(Object.hasOwn(dashboard.student.evidenceCounts, "skills"), false);
    assert.deepEqual(dashboard.student.evidenceCounts.projects, [{ title: "Portfolio API" }]);
    assert.deepEqual(dashboard.student.evidenceCounts.experience, [
      { company: "Campus Lab" },
      { company: "Internship" },
    ]);
    assert.deepEqual(dashboard.student.evidenceCounts.education, [
      { school: "FEU Tech" },
      { school: "Online Program" },
    ]);
    assert.deepEqual(dashboard.student.evidenceCounts.certifications, [{ name: "Cloud Foundations" }]);
    assert.deepEqual(dashboard.student.evidenceCounts.awards, [{ title: "Dean's Lister" }]);
    assert.deepEqual(dashboard.student.evidenceCounts.trainings, [{ title: "AI Bootcamp" }]);
    assert.deepEqual(dashboard.student.evidenceCounts.organizations, [{ name: "Computer Society" }]);
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

  it("builds a curriculum learning map from courses.json", () => {
    const dashboard = buildDashboard({
      runId: "run-test",
      profile: { ...profile, program: "BSCSAI", year_level: 1 },
      analysis: { ...analysis, program: "BSCSAI" },
      manifest,
      narrative: "",
    });

    assert.match(dashboard.learningMap.programCode, /^BSCS/);
    assert.equal(dashboard.learningMap.targetYearLevel, 1);
    assert.ok(dashboard.learningMap.idealSkills.length > 0);
    assert.ok(dashboard.learningMap.nodes.length > 0);
    assert.ok(dashboard.learningMap.nodes.every((node) => node.courseCode && node.skill));
  });

  it("targets only the student's exact year level", () => {
    const dashboard = buildDashboard({
      runId: "run-test",
      profile: { ...profile, program: "BSIT", specialization: "Web and Mobile Application", year_level: 4 },
      analysis: { ...analysis, program: "BSIT" },
      manifest,
      narrative: "",
    });

    assert.equal(dashboard.learningMap.targetYearLevel, 4);
    assert.ok(dashboard.learningMap.idealSkills.length > 0);
    assert.equal(dashboard.learningMap.idealSkills.every((skill) => skill.year === "Senior"), true);
    assert.equal(dashboard.learningMap.idealSkills.some((skill) => skill.year === "Freshman"), false);
  });

  it("reports the fallback target year level when the profile year is unknown", () => {
    const dashboard = buildDashboard({
      runId: "run-test",
      profile: { ...profile, program: "BSIT", specialization: "Web and Mobile Application", year_level: undefined },
      analysis: { ...analysis, program: "BSIT" },
      manifest,
      narrative: "",
    });

    assert.equal(dashboard.student.yearLevel, null);
    assert.equal(dashboard.learningMap.targetYearLevel, 4);
    assert.ok(dashboard.learningMap.idealSkills.length > 0);
    assert.equal(dashboard.learningMap.idealSkills.every((skill) => skill.year === "Senior"), true);
  });

  it("maps course titles to skill-level targets", () => {
    const dashboard = buildDashboard({
      runId: "run-test",
      profile: { ...profile, program: "BSCSAI", year_level: 1 },
      analysis: { ...analysis, program: "BSCSAI" },
      manifest,
      narrative: "",
    });
    const programming = dashboard.learningMap.idealSkills.find((skill) => skill.courseTitle === "Computer Programming 1");

    assert.equal(programming?.courseCode, "CCS0003");
    assert.equal(programming?.name, "Programming Fundamentals");
    assert.notEqual(programming?.name, "Introduction to C++ Programming");
    assert.notEqual(programming?.name, "C++");
    assert.match(programming?.coursewareUrl ?? "", /paraverse\.feutech\.edu\.ph\/mflix\/course\/[a-f0-9]+$/);
    assert.doesNotMatch(programming?.coursewareUrl ?? "", /search=/);
  });

  it("deduplicates repeated title and skill pairs", () => {
    const dashboard = buildDashboard({
      runId: "run-test",
      profile: { ...profile, program: "BSCSAI", year_level: 1 },
      analysis: { ...analysis, program: "BSCSAI" },
      manifest,
      narrative: "",
    });
    const titleSkillPairs = dashboard.learningMap.idealSkills.map((skill) => `${skill.courseTitle}|${skill.name}`);

    assert.equal(new Set(titleSkillPairs).size, titleSkillPairs.length);
  });

  it("uses common skill names instead of narrow module labels", () => {
    const dashboard = buildDashboard({
      runId: "run-test",
      profile: { ...profile, program: "BSCPE", year_level: 2 },
      analysis: { ...analysis, program: "BSCPE" },
      manifest,
      narrative: "",
    });
    const hardware = dashboard.learningMap.idealSkills.find((skill) => skill.courseTitle === "Computer Hardware Fundamentals");

    assert.equal(hardware?.name, "Computer Hardware");
    assert.equal(dashboard.learningMap.idealSkills.some((skill) => skill.name === "Cases Cooling And Peripherals"), false);
    assert.equal(dashboard.learningMap.idealSkills.some((skill) => /cpe curriculum/i.test(skill.name)), false);
  });

  it("maps machine learning specialization titles to the right skills", () => {
    const dashboard = buildDashboard({
      runId: "run-test",
      profile: { ...profile, program: "BSCSDS", year_level: 3 },
      analysis: { ...analysis, program: "BSCSDS" },
      manifest,
      narrative: "",
    });
    const machineLearningAlgorithms = dashboard.learningMap.idealSkills
      .filter((skill) => skill.courseTitle === "CS SPECIALIZATION 3 - MACHINE LEARNING ALGORITHMS")
      .map((skill) => skill.name)
      .sort();
    const advancedMachineLearning = dashboard.learningMap.idealSkills
      .filter((skill) => skill.courseCode === "CS0077")
      .map((skill) => skill.name);

    assert.deepEqual(machineLearningAlgorithms, ["Algorithms", "Machine Learning"]);
    assert.deepEqual(advancedMachineLearning, ["Machine Learning"]);
    assert.equal(
      dashboard.learningMap.idealSkills.some((skill) => skill.name === "CS SPECIALIZATION 4 - ADVANCE MACHINE LEARNING"),
      false,
    );
  });

  it("uses courseware links and excludes CS0016", () => {
    const dashboard = buildDashboard({
      runId: "run-test",
      profile: { ...profile, program: "BSCSDS", year_level: 3 },
      analysis: { ...analysis, program: "BSCSDS" },
      manifest,
      narrative: "",
    });
    const statistics = dashboard.learningMap.idealSkills.find((skill) => skill.courseCode === "CS0073");

    assert.equal(dashboard.learningMap.idealSkills.some((skill) => skill.courseCode === "CS0016"), false);
    assert.match(statistics?.coursewareUrl ?? "", /paraverse\.feutech\.edu\.ph\/mflix\/course/);
    assert.match(statistics?.coursewareUrl ?? "", /search=/);
    assert.match(statistics?.linkedinLearningUrl ?? "", /linkedin\.com\/learning\/search/);
    assert.match(statistics?.linkedinLearningUrl ?? "", /keywords=Statistics/);
  });

  it("maps CS project courses to a common project skill", () => {
    const dashboard = buildDashboard({
      runId: "run-test",
      profile: { ...profile, program: "BSCSDS", year_level: 3 },
      analysis: { ...analysis, program: "BSCSDS" },
      manifest,
      narrative: "",
    });
    const csProject = dashboard.learningMap.idealSkills.find((skill) => skill.courseTitle === "CS Project 1");

    assert.equal(csProject?.name, "Software Project Development");
    assert.equal(dashboard.learningMap.idealSkills.some((skill) => skill.name === "CS Project 1"), false);
  });
});
