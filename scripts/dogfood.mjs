import { execFileSync } from "node:child_process";

import plugin from "../dist/index.js";

const STAGING_URL = "https://staging.weft.network";
const apiKey = process.env.WEFT_API_KEY?.trim();
const baseUrl = process.env.WEFT_BASE_URL?.trim();
const query =
  process.env.WEFT_DOGFOOD_QUERY?.trim() || "OpenClaw 2.0 plugin SDK web search provider";

if (!apiKey) throw new Error("WEFT_API_KEY must contain a short-lived staging buyer key");
if (baseUrl !== STAGING_URL) {
  throw new Error(`Docker dogfood is staging-only; WEFT_BASE_URL must be ${STAGING_URL}`);
}

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
  inspection.plugin.diagnostics?.length > 0
) {
  throw new Error(`OpenClaw did not load the Weft provider: ${JSON.stringify(inspection)}`);
}

let provider;
plugin.register({
  registerWebSearchProvider(candidate) {
    provider = candidate;
  },
});
if (!provider) throw new Error("Weft did not register a web-search provider");

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
          providerIds: inspection.plugin.webSearchProviderIds,
          status: inspection.plugin.status,
        },
        search: {
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
          providerIds: inspection.plugin.webSearchProviderIds,
          status: inspection.plugin.status,
        },
        search: {
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
