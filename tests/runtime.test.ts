import { describe, expect, test, vi } from "vitest";

import { assertSpendAvailable, createSearchExecutor } from "../src/runtime.js";
import { operation } from "./fixtures.js";

function config() {
  return { apiKey: "wk_test", provider: "auto" as const, maxCostUsd: "0.01" };
}

describe("search runtime", () => {
  test("checks balance, preserves attribution, and performs one paid call", async () => {
    const signal = new AbortController().signal;
    const selected = operation("you-com", "0.005", {
      request: { method: "GET", url: "https://api.you.com/v1/search", query: { query: "query" } },
    });
    const balance = vi.fn().mockResolvedValue({ wallet: { totalUsd: "1.00" } });
    const search = vi.fn().mockResolvedValue({ results: [selected] });
    const fetch = vi.fn().mockResolvedValue({
      bodyBase64: Buffer.from(
        JSON.stringify({ results: { web: [{ url: "https://result.example", title: "Result" }] } }),
      ).toString("base64"),
    });
    const execute = createSearchExecutor({ balance, search, fetch }, config());

    const output = await execute({ query: "weft" }, { signal });

    expect(balance).toHaveBeenCalledWith({ signal });
    expect(search).toHaveBeenCalledWith(expect.any(Object), { signal });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      expect.objectContaining({
        maxCostUsd: "0.01",
        searchId: "search-1",
        operationId: "you-search-get",
        accessMethodId: "you-com-access",
      }),
      expect.objectContaining({ idempotencyKey: expect.any(String), signal }),
    );
    expect(output.results[0]?.url).toBe("https://result.example/");
  });

  test("does not retry an ambiguous paid failure", async () => {
    const fetch = vi.fn().mockRejectedValue(new Error("request outcome is uncertain"));
    const execute = createSearchExecutor(
      {
        balance: vi.fn().mockResolvedValue({}),
        search: vi.fn().mockResolvedValue({ results: [operation("you-com", "0.005")] }),
        fetch,
      },
      config(),
    );

    await expect(
      execute({ query: "weft" }, { signal: new AbortController().signal }),
    ).rejects.toThrow(/uncertain/);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test("stops before network work without a key or spend headroom", async () => {
    const balance = vi.fn();
    const execute = createSearchExecutor(
      { balance, search: vi.fn(), fetch: vi.fn() },
      { provider: "auto", maxCostUsd: "0.01" },
    );

    await expect(
      execute({ query: "weft" }, { signal: new AbortController().signal }),
    ).rejects.toThrow(/buyer key/);
    expect(balance).not.toHaveBeenCalled();
    expect(() =>
      assertSpendAvailable(
        {
          wallet: { totalUsd: "0.004" },
          promo: { balanceUsd: "0.00" },
          policy: { maxTxUsd: "1.00" },
        },
        "0.005",
      ),
    ).toThrow(/balance is below/);
  });

  test("refuses provider responses above two megabytes", async () => {
    const execute = createSearchExecutor(
      {
        balance: vi.fn().mockResolvedValue({}),
        search: vi.fn().mockResolvedValue({ results: [operation("you-com", "0.005")] }),
        fetch: vi.fn().mockResolvedValue({ bodyBase64: "A".repeat(2_800_001) }),
      },
      config(),
    );

    await expect(
      execute({ query: "weft" }, { signal: new AbortController().signal }),
    ).rejects.toThrow(/2 MB limit/);
  });
});
