import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const pluginManifest = JSON.parse(
  readFileSync(new URL("../openclaw.plugin.json", import.meta.url), "utf8"),
);

describe("native OpenClaw package contract", () => {
  test("declares a matching plugin and provider contract", () => {
    expect(pluginManifest.id).toBe("weft");
    expect(pluginManifest.contracts.webSearchProviders).toEqual(["weft"]);
    expect(pluginManifest.activation.onStartup).toBe(true);
    expect(pluginManifest.configSchema.additionalProperties).toBe(false);
    expect(packageJson.openclaw.extensions).toEqual(["./src/index.ts"]);
    expect(packageJson.openclaw.runtimeExtensions).toEqual(["./dist/index.js"]);
    expect(packageJson.peerDependencies.openclaw).toBe(">=2026.8.1");
  });
});
