import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { searchParaverseCourseware } from "../src/services/paraverse-courseware-search.ts";

describe("searchParaverseCourseware", () => {
  it("requests the Paraverse index with the search query", async () => {
    const requestedUrls: string[] = [];
    const fetcher: typeof fetch = async (input) => {
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
});
