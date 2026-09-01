import type { ProviderId } from "./catalog.js";
import { selectOperation } from "./catalog.js";
import type { RuntimeConfig } from "./config.js";
import { requireApiKey } from "./config.js";
import { usdToMicros } from "./money.js";
import { normalizeResults } from "./normalize.js";
import type { WebSearchResult } from "./normalize.js";
import { buildFetchRequest } from "./request.js";
import type { PaidRequest } from "./request.js";

export interface CatalogSearchRequest {
  readonly query: string;
  readonly maxResults: number;
  readonly filters: {
    readonly type: { readonly eq: "api" };
    readonly executionMode: { readonly eq: "sync" };
    readonly weftFetchCompatible: true;
    readonly price: { readonly lte: string };
    readonly includeUnknownPrices: true;
  };
}

interface CallOptions {
  readonly signal: AbortSignal;
}

interface FetchCallOptions extends CallOptions {
  readonly idempotencyKey: string;
}

export interface WeftGateway {
  balance(options: CallOptions): Promise<unknown>;
  search(
    request: CatalogSearchRequest,
    options: CallOptions,
  ): Promise<{ readonly results: readonly import("./catalog.js").CuratedOperation[] }>;
  fetch(request: PaidRequest, options: FetchCallOptions): Promise<{ readonly bodyBase64: string }>;
}

export interface SearchOutput extends Record<string, unknown> {
  readonly query: string;
  readonly provider: "weft";
  readonly count: number;
  readonly tookMs: number;
  readonly results: readonly WebSearchResult[];
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function money(value: unknown): bigint | undefined {
  if (typeof value !== "string") return undefined;
  try {
    return usdToMicros(value);
  } catch {
    return undefined;
  }
}

export function assertSpendAvailable(balanceValue: unknown, maxCostUsd: string): void {
  const balance = record(balanceValue);
  const wallet = record(balance?.wallet);
  const promo = record(balance?.promo);
  const policy = record(balance?.policy);
  const cost = usdToMicros(maxCostUsd);

  const walletAmount = money(wallet?.totalUsd);
  const promoAmount = money(promo?.balanceUsd) ?? 0n;
  if (walletAmount !== undefined && walletAmount + promoAmount < cost) {
    throw new Error(`Weft balance is below the $${maxCostUsd} web-search ceiling`);
  }

  const maxTransaction = money(policy?.maxTxUsd);
  if (maxTransaction !== undefined && maxTransaction < cost) {
    throw new Error(`Weft transaction policy is below the $${maxCostUsd} web-search ceiling`);
  }

  const spentToday = money(balance?.spentTodayUsd);
  const dailyLimit = money(policy?.dailyLimitUsd);
  if (spentToday !== undefined && dailyLimit !== undefined && spentToday + cost > dailyLimit) {
    throw new Error("Weft daily spending policy has insufficient headroom for web search");
  }

  const spentWeek = money(balance?.spentWeekUsd);
  const weeklyLimit = money(policy?.weeklyLimitUsd);
  if (spentWeek !== undefined && weeklyLimit !== undefined && spentWeek + cost > weeklyLimit) {
    throw new Error("Weft weekly spending policy has insufficient headroom for web search");
  }
}

function catalogQuery(provider: RuntimeConfig["provider"]): string {
  return provider === "auto"
    ? "You.com Exa Parallel Tavily synchronous web search API"
    : `${provider} provider synchronous web search API`;
}

function providerInputs(
  provider: ProviderId,
  query: string,
  count: number,
): Record<string, string | number> {
  switch (provider) {
    case "you-com":
      return { query, count };
    case "exa":
      return { query, numResults: count };
    case "parallel":
      return { query, mode: "fast" };
    case "tavily":
      return { query, max_results: count };
  }
}

function decodeJson(bodyBase64: string): unknown {
  if (bodyBase64.length > 2_800_000) {
    throw new Error("Web-search provider response exceeds the 2 MB limit");
  }
  try {
    return JSON.parse(Buffer.from(bodyBase64, "base64").toString("utf8"));
  } catch (error) {
    throw new Error("Web-search provider returned invalid JSON", { cause: error });
  }
}

function resultCount(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 10
    ? value
    : fallback;
}

export function createSearchExecutor(gateway: WeftGateway, config: RuntimeConfig) {
  return async (
    input: Readonly<Record<string, unknown>>,
    context: { readonly signal: AbortSignal },
  ): Promise<SearchOutput> => {
    const query = typeof input.query === "string" ? input.query.trim() : "";
    if (!query) throw new Error("Web-search query must not be empty");
    const count = resultCount(input.count, 5);
    context.signal.throwIfAborted();
    requireApiKey(config);

    const startedAt = Date.now();
    const balance = await gateway.balance({ signal: context.signal });
    assertSpendAvailable(balance, config.maxCostUsd);

    const search = await gateway.search(
      {
        query: catalogQuery(config.provider),
        maxResults: 20,
        filters: {
          type: { eq: "api" },
          executionMode: { eq: "sync" },
          weftFetchCompatible: true,
          price: { lte: config.maxCostUsd },
          includeUnknownPrices: true,
        },
      },
      { signal: context.signal },
    );
    const operation = selectOperation(search.results, config.provider, config.maxCostUsd);
    const request = buildFetchRequest(
      operation,
      providerInputs(operation.provider.id, query, count),
      config.maxCostUsd,
    );

    const response = await gateway.fetch(request, {
      idempotencyKey: crypto.randomUUID(),
      signal: context.signal,
    });
    const results = normalizeResults(operation.provider.id, decodeJson(response.bodyBase64)).slice(
      0,
      count,
    );
    return {
      query,
      provider: "weft",
      count: results.length,
      tookMs: Date.now() - startedAt,
      results,
    };
  };
}
