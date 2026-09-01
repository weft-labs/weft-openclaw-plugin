import { usdToMicros } from "./money.js";

export type ProviderMode = "auto" | "youcom" | "exa" | "parallel" | "tavily";

export interface RuntimeConfig {
  readonly apiKey?: string;
  readonly provider: ProviderMode;
  readonly maxCostUsd: string;
  readonly baseUrl?: string;
}

type Environment = Readonly<Record<string, string | undefined>>;

export function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function scopedSearchConfig(
  searchConfig: Readonly<Record<string, unknown>> | undefined,
): Record<string, unknown> | undefined {
  return record(searchConfig?.weft);
}

function providerMode(value: string | undefined): ProviderMode {
  const mode = value ?? "auto";
  if (["auto", "youcom", "exa", "parallel", "tavily"].includes(mode)) {
    return mode as ProviderMode;
  }
  throw new Error(`Invalid Weft web-search provider: ${mode}`);
}

function normalizeBaseUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;

  const parsed = new URL(value);
  const local = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && local)) {
    throw new Error("Weft base URL must use HTTPS, except for localhost development");
  }
  let end = value.length;
  while (end > 0 && value.charCodeAt(end - 1) === 47) end -= 1;
  return value.slice(0, end);
}

export function readConfig(
  searchConfig: Readonly<Record<string, unknown>> | undefined,
  environment: Environment = process.env,
): RuntimeConfig {
  const scoped = scopedSearchConfig(searchConfig);
  const maxCostUsd =
    stringValue(scoped?.maxCostUsd) ?? environment.WEFT_WEBSEARCH_MAX_COST_USD ?? "0.01";
  if (usdToMicros(maxCostUsd) <= 0n) {
    throw new Error("Weft web-search maxCostUsd must be greater than zero");
  }

  const provider = providerMode(
    stringValue(scoped?.provider) ?? environment.WEFT_WEBSEARCH_PROVIDER,
  );
  const baseUrl = normalizeBaseUrl(stringValue(scoped?.baseUrl) ?? environment.WEFT_BASE_URL);
  const apiKey = stringValue(scoped?.apiKey) ?? (environment.WEFT_API_KEY?.trim() || undefined);

  return {
    provider,
    maxCostUsd,
    ...(apiKey ? { apiKey } : {}),
    ...(baseUrl ? { baseUrl } : {}),
  };
}

export function requireApiKey(config: RuntimeConfig): string {
  if (!config.apiKey) {
    throw new Error(
      "Weft web search needs a buyer key. Run `openclaw configure --section web` or set WEFT_API_KEY in the Gateway environment.",
    );
  }
  return config.apiKey;
}
