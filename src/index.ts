import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { Type } from "typebox";

import { readConfig, record } from "./config.js";
import { createMcpConnectionResolver, readIdentityConfig } from "./identity.js";
import { createSearchExecutor } from "./runtime.js";
import { createSdkGateway } from "./sdk.js";

const WEFT_CREDENTIAL_PATH = "plugins.entries.weft.config.webSearch.apiKey";

const SearchParameters = Type.Object(
  {
    query: Type.String({ description: "Search query." }),
    count: Type.Optional(
      Type.Integer({
        description: "Number of results to return (1-10).",
        minimum: 1,
        maximum: 10,
      }),
    ),
  },
  { additionalProperties: true },
);

function weftConfig(searchConfig?: Record<string, unknown>): Record<string, unknown> | undefined {
  return record(searchConfig?.weft);
}

function setWeftCredential(searchConfigTarget: Record<string, unknown>, value: unknown): void {
  const existing = record(searchConfigTarget.weft);
  const target = existing ?? {};
  target.apiKey = value;
  searchConfigTarget.weft = target;
}

function configuredCredential(config?: unknown): unknown {
  const root = record(config);
  const plugins = record(root?.plugins);
  const entries = record(plugins?.entries);
  const entry = record(entries?.weft);
  const pluginConfig = record(entry?.config);
  return record(pluginConfig?.webSearch)?.apiKey;
}

function ensureRecord(target: Record<string, unknown>, key: string): Record<string, unknown> {
  const existing = record(target[key]);
  if (existing) return existing;
  const created: Record<string, unknown> = {};
  target[key] = created;
  return created;
}

function setConfiguredCredential(configTarget: unknown, value: unknown): void {
  const root = record(configTarget);
  if (!root) throw new Error("OpenClaw configuration must be an object");
  const plugins = ensureRecord(root, "plugins");
  const entries = ensureRecord(plugins, "entries");
  const entry = ensureRecord(entries, "weft");
  if (entry.enabled === undefined) entry.enabled = true;
  const pluginConfig = ensureRecord(entry, "config");
  const webSearch = ensureRecord(pluginConfig, "webSearch");
  webSearch.apiKey = value;
}

function mergedSearchConfig(
  searchConfig: Record<string, unknown> | undefined,
  config: unknown,
): Record<string, unknown> | undefined {
  const pluginConfig = record(
    record(record(record(record(config)?.plugins)?.entries)?.weft)?.config,
  );
  const configuredSearch = record(pluginConfig?.webSearch);
  const toolSearch = weftConfig(searchConfig);
  if (!configuredSearch && !toolSearch) return searchConfig;
  return {
    ...searchConfig,
    weft: { ...configuredSearch, ...toolSearch },
  };
}

export default definePluginEntry({
  id: "weft",
  name: "Weft",
  description: "Find and buy paid data, APIs, and actions through Weft.",
  register(api) {
    const identity = readIdentityConfig(api.pluginConfig);
    if (identity.bindings.length > 0) {
      api.registerMcpServerConnectionResolver(
        createMcpConnectionResolver(identity, process.env, (message) => api.logger?.warn(message)),
      );
    }

    api.registerWebSearchProvider({
      id: "weft",
      label: "Weft",
      hint: "One balance · You.com, Exa, Parallel, or Tavily · strict spend ceiling",
      onboardingScopes: ["text-inference"],
      requiresCredential: true,
      credentialLabel: "Weft API key",
      envVars: ["WEFT_API_KEY"],
      placeholder: "wk_...",
      signupUrl: "https://weft.network",
      docsUrl: "https://weft.network/setup.md",
      autoDetectOrder: 40,
      credentialPath: WEFT_CREDENTIAL_PATH,
      getCredentialValue: (searchConfig) => weftConfig(searchConfig)?.apiKey,
      setCredentialValue: setWeftCredential,
      getConfiguredCredentialValue: configuredCredential,
      setConfiguredCredentialValue: setConfiguredCredential,
      createTool: ({ config: openClawConfig, searchConfig }) => {
        const runtimeConfig = readConfig(mergedSearchConfig(searchConfig, openClawConfig));
        const execute = createSearchExecutor(createSdkGateway(runtimeConfig), runtimeConfig);
        return {
          description:
            "Search the current web through a Weft-bought provider operation. Every search has a hard cost ceiling and no paid retry.",
          parameters: SearchParameters,
          execute: async (args, context) => {
            const signal = context?.signal ?? new AbortController().signal;
            return execute(args, { signal });
          },
        };
      },
    });
  },
});

export { extractOperations, selectOperation } from "./catalog.js";
export { readConfig } from "./config.js";
export { createMcpConnectionResolver, readIdentityConfig } from "./identity.js";
export { normalizeResults } from "./normalize.js";
export { buildFetchRequest } from "./request.js";
export { assertSpendAvailable, createSearchExecutor } from "./runtime.js";
