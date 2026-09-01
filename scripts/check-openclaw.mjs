import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function isolatedEnvironment(prefix) {
  const root = mkdtempSync(join(tmpdir(), prefix));
  const state = join(root, "state");
  const cache = join(root, "cache");
  mkdirSync(state);
  mkdirSync(cache);
  return {
    root,
    environment: {
      ...process.env,
      OPENCLAW_STATE_DIR: state,
      XDG_CACHE_HOME: cache,
    },
  };
}

function installAndInspect(path, prefix, configureOauth = false) {
  const isolated = isolatedEnvironment(prefix);
  try {
    execFileSync(
      "openclaw",
      [
        "plugins",
        "install",
        "--link",
        path,
        "--force",
        "--accept-capabilities",
        "--acknowledge-install-policy-warning",
      ],
      { env: isolated.environment, stdio: "ignore" },
    );
    if (configureOauth) {
      execFileSync(
        "openclaw",
        [
          "mcp",
          "set",
          "weft",
          JSON.stringify({
            url: "https://weft.network/mcp",
            transport: "streamable-http",
            auth: "oauth",
            toolFilter: {
              include: ["weft_search", "weft_fetch", "weft_balance", "weft_connection_status"],
            },
          }),
        ],
        { env: isolated.environment, stdio: "ignore" },
      );
    }
    const inspection = JSON.parse(
      execFileSync("openclaw", ["plugins", "inspect", "weft", "--json"], {
        encoding: "utf8",
        env: isolated.environment,
      }),
    );
    execFileSync("openclaw", ["plugins", "doctor"], {
      env: isolated.environment,
      stdio: "ignore",
    });
    const mcpStatus = JSON.parse(
      execFileSync("openclaw", ["mcp", "status", "--json"], {
        encoding: "utf8",
        env: isolated.environment,
      }),
    );
    return { inspection, mcpStatus };
  } finally {
    rmSync(isolated.root, { force: true, recursive: true });
  }
}

const nativeResult = installAndInspect(".", "weft-openclaw-native-", true);
const native = nativeResult.inspection;
const nativeServer = nativeResult.mcpStatus.servers?.find((server) => server.name === "weft");
const nativeAuth = nativeServer?.auth;
if (
  native.plugin?.status !== "loaded" ||
  native.plugin?.format !== "openclaw" ||
  !native.plugin?.webSearchProviderIds?.includes("weft") ||
  !native.mcpServers?.some((server) => server.name === "weft") ||
  (nativeAuth !== "oauth" && nativeAuth?.type !== "oauth") ||
  native.plugin?.diagnostics?.length > 0 ||
  native.diagnostics?.length > 0
) {
  throw new Error(
    `OpenClaw did not load the full Weft plugin with saved OAuth: ${JSON.stringify(nativeResult)}`,
  );
}

const bundleResult = installAndInspect("./agent-plugin", "weft-openclaw-bundle-", true);
const bundle = bundleResult.inspection;
const bundleServer = bundleResult.mcpStatus.servers?.find((server) => server.name === "weft");
const bundleAuth = bundleServer?.auth;
if (
  bundle.plugin?.status !== "loaded" ||
  bundle.plugin?.format !== "bundle" ||
  bundle.plugin?.bundleFormat !== "agent" ||
  !bundle.plugin?.bundleCapabilities?.includes("skills") ||
  !bundle.plugin?.bundleCapabilities?.includes("mcpServers") ||
  !bundle.mcpServers?.some((server) => server.name === "weft") ||
  (bundleAuth !== "oauth" && bundleAuth?.type !== "oauth") ||
  bundle.plugin?.diagnostics?.length > 0 ||
  bundle.diagnostics?.length > 0
) {
  throw new Error(
    `OpenClaw did not load the portable Weft bundle with OAuth: ${JSON.stringify(bundleResult)}`,
  );
}

console.log(
  "OpenClaw loaded the generic Weft skill and MCP bundle, requester-capable native plugin, and optional web-search provider without diagnostics.",
);
