import { readFileSync } from "node:fs";

function readJson(path) {
  return JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
}

const packageJson = readJson("../package.json");
const plugin = readJson("../agent-plugin/plugin.json");
const mcp = readJson("../agent-plugin/mcp.json");
const skill = readFileSync(
  new URL("../agent-plugin/skills/weft/SKILL.md", import.meta.url),
  "utf8",
);
const readme = readFileSync(new URL("../agent-plugin/README.md", import.meta.url), "utf8");
const skillsRef = readFileSync(new URL("../SKILLS_REF", import.meta.url), "utf8").trim();

if (plugin.$schema !== "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json") {
  throw new Error("Agent Plugin manifest must target the 1.0.0 schema");
}
if (plugin.name !== "weft" || plugin.version !== packageJson.version) {
  throw new Error("Agent Plugin identity or version does not match the package");
}
if (mcp.$schema !== "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json") {
  throw new Error("Agent Plugin MCP config must target the 1.0.0 schema");
}
if (Object.keys(mcp).sort().join(",") !== "$schema,mcpServers") {
  throw new Error("Agent Plugin mcp.json must contain only $schema and mcpServers");
}
const server = mcp.mcpServers?.weft;
if (
  server?.type !== "streamable-http" ||
  server?.url !== "https://weft.network/mcp" ||
  Object.keys(server).sort().join(",") !== "type,url"
) {
  throw new Error("Agent Plugin must declare only the canonical hosted Weft MCP transport");
}
if (!skill.startsWith("---\nname: weft\n")) {
  throw new Error("Agent Plugin is missing the canonical Weft skill");
}
if (!/^[0-9a-f]{40}$/.test(skillsRef)) {
  throw new Error("SKILLS_REF must pin one canonical weftlabs/skills commit");
}
const oauthSetup = readme.indexOf('"auth":"oauth"');
const oauthLogin = readme.indexOf("openclaw mcp login weft");
if (
  !readme.includes("openclaw mcp set weft") ||
  oauthSetup < 0 ||
  oauthLogin < 0 ||
  oauthSetup >= oauthLogin
) {
  throw new Error("Portable bundle must configure OpenClaw OAuth before MCP login");
}

console.log(`Agent Plugins 1.0.0 bundle is valid and pins skill ${skillsRef.slice(0, 8)}.`);
