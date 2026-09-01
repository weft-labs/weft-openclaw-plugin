import { describe, expect, test } from "vitest";

import { extractOperations, selectOperation } from "../src/catalog.js";
import { operation } from "./fixtures.js";

describe("catalog selection", () => {
  test("selects the cheapest allowed operation and uses score for an equal price", () => {
    const cheapest = selectOperation(
      [operation("parallel", "0.01"), operation("you-com", "0.005")],
      "auto",
      "0.01",
    );
    const highestScore = selectOperation(
      [operation("tavily", "0.01", { score: 0.7 }), operation("parallel", "0.01", { score: 0.9 })],
      "auto",
      "0.01",
    );

    expect(cheapest.provider.id).toBe("you-com");
    expect(highestScore.provider.id).toBe("parallel");
  });

  test("keeps a fixed provider and rejects prices above the ceiling", () => {
    expect(
      selectOperation(
        [operation("you-com", "0.005"), operation("tavily", "0.01")],
        "tavily",
        "0.01",
      ).provider.id,
    ).toBe("tavily");
    expect(() => selectOperation([operation("tavily", "0.01")], "auto", "0.005")).toThrow(
      /No compatible web-search operation/,
    );
  });
});

describe("catalog extraction", () => {
  test("accepts only the exact complete terminal search operation", () => {
    const results = extractOperations({
      queryTraceId: "trace-1",
      results: [
        {
          provider: { providerId: "you-com", displayName: "You.com" },
          score: 0.9,
          endpoints: [
            {
              url: "https://api.you.com/v1/search",
              call: {
                method: "GET",
                inputSchema: {
                  properties: { query: { type: "string" }, count: { type: "integer" } },
                },
              },
              price: { indexedUsd: "0.005" },
              accessMethods: [
                {
                  accessMethodId: "you-search-x402-base",
                  protocol: "x402",
                  price: { kind: "fixed", indexed_usd: "0.005" },
                  weftFetch: { state: "supported" },
                },
              ],
              operation: { id: "you-search-get", name: "Search the web" },
              execution: { mode: "sync" },
              callability: { state: "complete" },
              compatibility: { weft_fetch: { coverage: "terminal_response" } },
            },
            {
              url: "https://api.you.com/v1/contents",
              call: { method: "POST", inputSchema: { properties: {} } },
              price: { indexedUsd: "0.001" },
              accessMethods: [
                { accessMethodId: "wrong", protocol: "x402", weftFetch: { state: "supported" } },
              ],
              operation: { id: "you-contents", name: "Not search" },
              execution: { mode: "sync" },
              callability: { state: "complete" },
              compatibility: { weft_fetch: { coverage: "terminal_response" } },
            },
          ],
        },
      ],
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      provider: { id: "you-com", name: "You.com" },
      operation: { id: "you-search-get" },
      request: { method: "GET", query: { query: "query", count: "count" } },
      attribution: {
        search_id: "trace-1",
        operation_id: "you-search-get",
        access_method_id: "you-search-x402-base",
      },
    });
  });
});
