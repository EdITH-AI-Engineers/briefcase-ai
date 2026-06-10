import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Type } from "@google/genai";
import { COLUMNS, CONTEXT } from "../src/config.ts";

const requestedSections = [
  "skills",
  "certifications",
  "licenses_certifications",
  "awards",
  "honors_awards",
  "education",
  "projects",
  "experience",
  "work_experience",
  "seminars_trainings",
  "organizations_memberships",
] as const;

function objectProperties(section: keyof typeof COLUMNS) {
  const item = COLUMNS[section].items;
  assert.equal(item?.type, Type.OBJECT);
  assert.ok(item.properties);
  return item.properties;
}

describe("synth data profile sections", () => {
  it("includes every evidence section requested by the dashboard", () => {
    for (const section of requestedSections) {
      assert.ok(COLUMNS[section], `missing ${section}`);
      assert.equal(COLUMNS[section].type, Type.ARRAY);
    }
  });

  it("keeps skills richer but timeless", () => {
    const skillProperties = objectProperties("skills");

    assert.deepEqual(Object.keys(skillProperties), ["name", "level", "percentage"]);
    assert.match(COLUMNS.skills.description, /broader mix/i);
    assert.match(CONTEXT, /skills: 8-12 items/i);
    assert.match(CONTEXT, /skills: 16-22 items/i);
  });

  it("uses time fields only where they naturally belong", () => {
    for (const section of ["projects", "education", "experience", "work_experience"] as const) {
      assert.ok(objectProperties(section).date_range, `${section} should have date_range`);
    }

    for (const section of ["certifications", "licenses_certifications"] as const) {
      const properties = objectProperties(section);
      assert.ok(properties.issue_date, `${section} should have issue_date`);
      assert.ok(properties.expiry_date, `${section} should have expiry_date`);
    }

    for (const section of ["awards", "honors_awards", "seminars_trainings"] as const) {
      assert.ok(objectProperties(section).date, `${section} should have date`);
    }

    const organizationProperties = objectProperties("organizations_memberships");
    assert.ok(organizationProperties.start_date);
    assert.ok(organizationProperties.end_date);
  });

  it("anchors generated current-year evidence to 2026", () => {
    assert.match(CONTEXT, /June 10, 2026/);
    assert.match(CONTEXT, /Every project\s+date_range must overlap 2026/);
    assert.match(COLUMNS.projects.description, /overlap 2026/);
  });
});
