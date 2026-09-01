import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const outputDirectory = mkdtempSync(join(tmpdir(), "weft-openclaw-package-"));
execFileSync("pnpm", ["pack", "--pack-destination", outputDirectory], {
  stdio: "ignore",
});

const archive = join(outputDirectory, "weft-labs-openclaw-plugin-0.1.0.tgz");
const listing = execFileSync("tar", ["-tzf", archive], { encoding: "utf8" });
const files = new Set(listing.trim().split("\n"));
const required = [
  "package/package.json",
  "package/openclaw.plugin.json",
  "package/agent-plugin/plugin.json",
  "package/agent-plugin/mcp.json",
  "package/agent-plugin/README.md",
  "package/agent-plugin/skills/weft/SKILL.md",
  "package/agent-plugin/skills/weft/rules/cli.md",
  "package/SKILLS_REF",
  "package/src/index.ts",
  "package/src/identity.ts",
  "package/dist/index.js",
  "package/dist/index.d.ts",
  "package/docs/architecture/openclaw-plugin.md",
  "package/docs/specs/openclaw-plugin.md",
  "package/docs/decisions/2026-09-01-mcp-first-weft-integration.md",
  "package/README.md",
  "package/LICENSE",
];

const missing = required.filter((file) => !files.has(file));
if (missing.length > 0) {
  throw new Error(`Packed plugin is missing: ${missing.join(", ")}`);
}

console.log(`Packed plugin contains ${files.size} files and all required entries.`);
