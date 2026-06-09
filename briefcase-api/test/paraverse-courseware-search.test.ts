import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseCoursewareIndex,
  searchParaverseCourseware,
} from "../src/services/paraverse-courseware-search.ts";

describe("searchParaverseCourseware", () => {
  it("requests the Paraverse index with the search query", async () => {
    const requestedUrls: string[] = [];
    const fetcher: typeof fetch = async (input: Parameters<typeof fetch>[0]) => {
      requestedUrls.push(input.toString());
      return new Response(
        '<a href="/mflix/course/programming-fundamentals">Computer Programming</a><p>Programming fundamentals</p>',
        { status: 200 },
      );
    };

    const results = await searchParaverseCourseware({
      keywords: ["Computer Programming", "fundamentals"],
      fetcher,
    });

    assert.equal(requestedUrls.length, 1);
    const requested = new URL(requestedUrls[0]);
    assert.equal(requested.origin, "https://paraverse.feutech.edu.ph");
    assert.equal(requested.pathname, "/mflix/course/");
    assert.equal(requested.searchParams.get("search"), "computer programming fundamentals");
    assert.equal(results[0]?.title, "Computer Programming");
  });

  it("uses a local fallback block when an anchor has no preceding div", () => {
    const results = parseCoursewareIndex(`
      <p>Unrelated page introduction</p>
      <a href="/mflix/course/programming-fundamentals">Computer Programming</a>
      <p>Programming fundamentals course description</p>
    `);

    assert.equal(results[0]?.description, "Programming fundamentals course description");
    assert.doesNotMatch(results[0]?.haystack ?? "", /Unrelated page introduction/);
  });
});
