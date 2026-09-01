import { describe, expect, test } from "vitest";

import { normalizeResults } from "../src/normalize.js";

describe("provider result normalization", () => {
  test("normalizes You.com web and news rows", () => {
    expect(
      normalizeResults("you-com", {
        results: {
          web: [{ url: "https://a.example", title: "A", description: "Alpha", snippets: ["One"] }],
          news: [{ url: "https://b.example", title: "B", description: "Beta", age: "2026-08-31" }],
        },
      }),
    ).toEqual([
      {
        url: "https://a.example/",
        title: "A",
        snippet: "Alpha\nOne",
        siteName: "a.example",
      },
      {
        url: "https://b.example/",
        title: "B",
        snippet: "Beta",
        published: "2026-08-31T00:00:00.000Z",
        siteName: "b.example",
      },
    ]);
  });

  test.each([
    ["exa", { results: [{ url: "https://exa.example", title: "Exa", text: "Full text" }] }],
    [
      "parallel",
      { results: [{ url: "https://parallel.example", title: "Parallel", excerpts: ["One"] }] },
    ],
    [
      "tavily",
      { results: [{ url: "https://tavily.example", title: "Tavily", content: "Summary" }] },
    ],
  ])("normalizes %s rows", (provider, payload) => {
    const results = normalizeResults(provider, payload);
    expect(results).toHaveLength(1);
    expect(results[0]?.url).toMatch(/^https:\/\//);
    expect(results[0]?.snippet).toBeTruthy();
  });

  test("drops malformed rows and refuses an unknown provider", () => {
    expect(normalizeResults("exa", { results: [{ title: "missing URL" }] })).toEqual([]);
    expect(() => normalizeResults("unknown", {})).toThrow(/Unsupported provider/);
  });
});
