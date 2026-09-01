import { describe, expect, test } from "vitest";

import { buildFetchRequest } from "../src/request.js";
import { operation } from "./fixtures.js";

describe("paid request construction", () => {
  test("maps inputs and keeps exact Weft attribution", () => {
    const selected = operation("you-com", "0.005", {
      request: {
        method: "GET",
        url: "https://api.you.com/v1/search",
        query: { query: "query", count: "count" },
      },
    });

    expect(buildFetchRequest(selected, { query: "agent search", count: 8 }, "0.01")).toEqual({
      url: "https://api.you.com/v1/search?query=agent+search&count=8",
      method: "GET",
      headers: undefined,
      body: undefined,
      maxCostUsd: "0.01",
      searchId: "search-1",
      operationId: "you-search-get",
      accessMethodId: "you-com-access",
    });
  });

  test("refuses insecure URLs and provider credential headers", () => {
    const insecure = operation("exa", "0.007", {
      request: { method: "POST", url: "http://exa.example/search" },
    });
    const credential = operation("exa", "0.007", {
      request: {
        method: "POST",
        url: "https://exa.example/search",
        headers: { "x-api-key": "provider secret" },
      },
    });

    expect(() => buildFetchRequest(insecure, { query: "weft" }, "0.01")).toThrow(/HTTPS/);
    expect(() => buildFetchRequest(credential, { query: "weft" }, "0.01")).toThrow(
      /forbidden header/,
    );
  });
});
