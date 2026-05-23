import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  difficultyForLevel,
  linkedinLearningSearchUrl,
  pickKeywords,
} from "../src/services/linkedin-search.ts";

describe("linkedinLearningSearchUrl", () => {
  it("builds LinkedIn Learning course search URLs from profile level", () => {
    assert.equal(difficultyForLevel("Developing"), "INTERMEDIATE");
    assert.equal(
      linkedinLearningSearchUrl({ keywords: "docker containers", level: "Developing" }),
      "https://www.linkedin.com/learning/search?keywords=docker+containers&entityType=COURSE&difficultyLevel=INTERMEDIATE",
    );
  });

  it("allows explicit difficulty override", () => {
    assert.equal(
      linkedinLearningSearchUrl({ keywords: "threat modeling", difficulty: "ADVANCED" }),
      "https://www.linkedin.com/learning/search?keywords=threat+modeling&entityType=COURSE&difficultyLevel=ADVANCED",
    );
  });
});

describe("pickKeywords", () => {
  it("uses sanitized AI keywords before curated defaults", () => {
    assert.deepEqual(
      pickKeywords("Systems & Infrastructure", "deploy a service", [
        "  Docker   containers  ",
        "https://example.test/course",
        "Docker containers",
        "cloud deployment!!!",
        "this phrase is intentionally too long for a useful linkedin learning keyword search term",
      ]),
      { keywords: ["Docker containers", "cloud deployment"], source: "ai_keywords" },
    );
  });

  it("falls back to curated competency keywords when AI keywords are unusable", () => {
    assert.deepEqual(
      pickKeywords("Systems & Infrastructure", "deploy a service", ["", "https://example.test/course"]),
      { keywords: ["docker containers", "linux administration", "cloud deployment"], source: "curated_competency" },
    );
  });

  it("falls back to a sanitized recommendation or competency name", () => {
    assert.deepEqual(
      pickKeywords("Unknown Competency", "  Build   an API!!!  "),
      { keywords: ["Build an API"], source: "gap_recommendation" },
    );
    assert.deepEqual(
      pickKeywords("Unknown & Competency"),
      { keywords: ["unknown competency"], source: "competency_name" },
    );
  });
});
