import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
const pluginManifest = JSON.parse(
  readFileSync(new URL("../openclaw.plugin.json", import.meta.url), "utf8"),
);
const bundleManifest = JSON.parse(
  readFileSync(new URL("../agent-plugin/plugin.json", import.meta.url), "utf8"),
);
const bundleMcp = JSON.parse(
  readFileSync(new URL("../agent-plugin/mcp.json", import.meta.url), "utf8"),
);
const bundleReadme = readFileSync(new URL("../agent-plugin/README.md", import.meta.url), "utf8");

describe("native OpenClaw package contract", () => {
  test("declares the generic skill and MCP server before the optional provider", () => {
    expect(pluginManifest.id).toBe("weft");
    expect(pluginManifest.description).toMatch(/data, APIs, and actions/i);
    expect(pluginManifest.skills).toEqual(["agent-plugin/skills"]);
    expect(pluginManifest.mcpServers.weft).toMatchObject({
      transport: "streamable-http",
      url: "https://weft.network/mcp",
      auth: "oauth",
      toolFilter: {
        include: ["weft_search", "weft_fetch", "weft_balance", "weft_connection_status"],
      },
    });
    expect(pluginManifest.contracts.webSearchProviders).toEqual(["weft"]);
    expect(pluginManifest.activation.onStartup).toBe(true);
    expect(pluginManifest.configSchema.additionalProperties).toBe(false);
    expect(pluginManifest.configSchema.properties.identity).toBeDefined();
    expect(packageJson.openclaw.extensions).toEqual(["./src/index.ts"]);
    expect(packageJson.openclaw.runtimeExtensions).toEqual(["./dist/index.js"]);
    expect(packageJson.peerDependencies.openclaw).toBe(">=2026.8.1");
    expect(readme).toContain("openclaw mcp set weft");
    expect(readme.indexOf('"auth":"oauth"')).toBeLessThan(
      readme.indexOf("openclaw mcp login weft"),
    );
  });

  test("ships an independently installable Agent Plugins bundle", () => {
    expect(bundleManifest).toMatchObject({
      $schema: "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json",
      name: "weft",
      version: packageJson.version,
    });
    expect(bundleMcp).toEqual({
      $schema: "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json",
      mcpServers: {
        weft: {
          type: "streamable-http",
          url: "https://weft.network/mcp",
        },
      },
    });

    const skill = readFileSync(
      new URL("../agent-plugin/skills/weft/SKILL.md", import.meta.url),
      "utf8",
    );
    const ref = readFileSync(new URL("../SKILLS_REF", import.meta.url), "utf8").trim();
    expect(skill).toMatch(/^---\nname: weft\n/);
    expect(ref).toMatch(/^[0-9a-f]{40}$/);
    expect(bundleReadme).toContain("openclaw mcp set weft");
    expect(bundleReadme.indexOf('"auth":"oauth"')).toBeLessThan(
      bundleReadme.indexOf("openclaw mcp login weft"),
    );
  });
});
