import { execFileSync } from "node:child_process";

import plugin, { createMcpConnectionResolver, readIdentityConfig } from "../dist/index.js";

const STAGING_URL = "https://staging.weft.network";
const MCP_TOOLS = ["weft_search", "weft_fetch", "weft_balance", "weft_connection_status"];
const apiKey = process.env.WEFT_API_KEY?.trim();
const baseUrl = process.env.WEFT_BASE_URL?.trim();
const query =
  process.env.WEFT_DOGFOOD_QUERY?.trim() || "OpenClaw generic agent service marketplace";

if (!apiKey) throw new Error("WEFT_API_KEY must contain a short-lived staging buyer key");
if (baseUrl !== STAGING_URL) {
  throw new Error(`Docker dogfood is staging-only; WEFT_BASE_URL must be ${STAGING_URL}`);
}

execFileSync("node", ["scripts/check-openclaw.mjs"], { stdio: "ignore" });
execFileSync(
  "openclaw",
  [
    "plugins",
    "install",
    "--link",
    ".",
    "--force",
    "--accept-capabilities",
    "--acknowledge-install-policy-warning",
  ],
  { stdio: "ignore" },
);

const inspection = JSON.parse(
  execFileSync("openclaw", ["plugins", "inspect", "weft", "--json"], {
    encoding: "utf8",
  }),
);
if (
  inspection.plugin?.status !== "loaded" ||
  !inspection.plugin.webSearchProviderIds?.includes("weft") ||
  !inspection.mcpServers?.some((server) => server.name === "weft") ||
  inspection.plugin.diagnostics?.length > 0 ||
  inspection.diagnostics?.length > 0
) {
  throw new Error(`OpenClaw did not load the full Weft plugin: ${JSON.stringify(inspection)}`);
}

const resolver = createMcpConnectionResolver(
  readIdentityConfig({
    identity: {
      baseUrl: `${baseUrl}/mcp`,
      bindings: [
        {
          requesterSenderId: "docker-dogfood",
          messageChannel: "test",
          credentialEnv: "WEFT_API_KEY",
        },
      ],
    },
  }),
);
const requesterConnection = await resolver.resolve({
  requesterSenderId: "docker-dogfood",
  messageChannel: "test",
});
if (
  requesterConnection?.url !== `${baseUrl}/mcp` ||
  requesterConnection.headers.Authorization !== `Bearer ${apiKey}`
) {
  throw new Error("Requester-scoped Weft MCP identity did not resolve the staging connection");
}

execFileSync(
  "openclaw",
  [
    "mcp",
    "set",
    "weft",
    JSON.stringify({
      url: `${baseUrl}/mcp`,
      transport: "streamable-http",
      headers: { Authorization: "Bearer $" + "{WEFT_API_KEY}" },
      toolFilter: { include: MCP_TOOLS },
      connectionTimeoutMs: 10_000,
      requestTimeoutMs: 30_000,
    }),
  ],
  { stdio: "ignore" },
);
const probe = JSON.parse(
  execFileSync("openclaw", ["mcp", "probe", "weft", "--json"], {
    encoding: "utf8",
  }),
);

function collectToolNames(value, output = new Set()) {
  if (Array.isArray(value)) {
    for (const item of value) collectToolNames(item, output);
    return output;
  }
  if (!value || typeof value !== "object") return output;
  if (Array.isArray(value.tools)) {
    for (const tool of value.tools) {
      if (typeof tool === "string") output.add(tool);
      else if (tool && typeof tool.name === "string") output.add(tool.name);
    }
  }
  for (const child of Object.values(value)) collectToolNames(child, output);
  return output;
}

const probedTools = [...collectToolNames(probe)].sort();
const missingTools = MCP_TOOLS.filter(
  (required) => !probedTools.some((name) => name === required || name.endsWith(`__${required}`)),
);
if (missingTools.length > 0) {
  throw new Error(`Weft MCP probe is missing tools: ${missingTools.join(", ")}`);
}

let provider;
plugin.register({
  registerMcpServerConnectionResolver() {},
  registerWebSearchProvider(candidate) {
    provider = candidate;
  },
});
if (!provider) throw new Error("Weft did not register the optional web-search provider");

const tool = provider.createTool({
  searchConfig: {
    provider: "weft",
    weft: {
      apiKey,
      baseUrl,
      maxCostUsd: "0.01",
      provider: "auto",
    },
  },
});
if (!tool) throw new Error("Weft web-search tool is unavailable");

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(new Error("Dogfood search timed out")), 60_000);
try {
  const output = await tool.execute({ query, count: 3 }, { signal: controller.signal });
  const results = Array.isArray(output.results) ? output.results : [];
  if (results.length === 0) throw new Error("Weft web search returned no results");

  console.log(
    JSON.stringify(
      {
        host: {
          openclawVersion: inspection.plugin.builtWithOpenClawVersion,
          pluginVersion: inspection.plugin.version,
          status: inspection.plugin.status,
        },
        genericWeft: {
          bundle: "loaded",
          requesterIdentity: "resolved",
          mcpTools: probedTools,
        },
        optionalWebSearch: {
          query: output.query,
          provider: output.provider,
          count: output.count,
          tookMs: output.tookMs,
          results: results.map(({ title, url, published, siteName }) => ({
            title,
            url,
            ...(published ? { published } : {}),
            ...(siteName ? { siteName } : {}),
          })),
        },
      },
      null,
      2,
    ),
  );
} catch (error) {
  if (error?.code !== "WALLET_ENVIRONMENT_MISMATCH") throw error;

  console.log(
    JSON.stringify(
      {
        host: {
          openclawVersion: inspection.plugin.builtWithOpenClawVersion,
          pluginVersion: inspection.plugin.version,
          status: inspection.plugin.status,
        },
        genericWeft: {
          bundle: "loaded",
          requesterIdentity: "resolved",
          mcpTools: probedTools,
        },
        optionalWebSearch: {
          query,
          status: "safe_blocked",
          code: error.code,
          requestId: error.requestId,
          walletNetwork: error.details?.details?.wallet_network,
          challengeNetwork: error.details?.details?.challenge_network,
          message: "Staging refused a mainnet provider challenge before signing or settlement.",
        },
      },
      null,
      2,
    ),
  );
} finally {
  clearTimeout(timeout);
}
