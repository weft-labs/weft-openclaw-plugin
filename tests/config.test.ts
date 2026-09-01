import { describe, expect, test } from "vitest";

import { readConfig, requireApiKey } from "../src/config.js";

describe("configuration", () => {
  test("uses safe defaults and reads the OpenClaw provider scope", () => {
    expect(readConfig({}, {})).toEqual({ provider: "auto", maxCostUsd: "0.01" });
    expect(
      readConfig({ weft: { apiKey: " wk_test ", provider: "tavily", maxCostUsd: "0.005" } }, {}),
    ).toEqual({ apiKey: "wk_test", provider: "tavily", maxCostUsd: "0.005" });
  });

  test("accepts environment fallback and rejects unsafe configuration", () => {
    expect(readConfig({}, { WEFT_API_KEY: " wk_env " }).apiKey).toBe("wk_env");
    expect(() => readConfig({ weft: { provider: "random" } }, {})).toThrow(/Invalid Weft/);
    expect(() => readConfig({ weft: { maxCostUsd: "1.2345678" } }, {})).toThrow(
      /Invalid USD amount/,
    );
    expect(() => readConfig({ weft: { baseUrl: "http://weft.example" } }, {})).toThrow(
      /must use HTTPS/,
    );
  });

  test("requires a buyer key before network work starts", () => {
    expect(() => requireApiKey({ provider: "auto", maxCostUsd: "0.01" })).toThrow(/buyer key/);
  });
});
