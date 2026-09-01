import type { ProviderId } from "./catalog.js";

export interface WebSearchResult {
  readonly url: string;
  readonly title: string;
  readonly snippet?: string;
  readonly published?: string;
  readonly siteName?: string;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function texts(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(text).filter((item): item is string => Boolean(item))
    : [];
}

function published(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }
  const raw = text(value);
  if (!raw) return undefined;
  const timestamp = Date.parse(raw);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;
}

function validUrl(value: unknown): URL | undefined {
  const candidate = text(value);
  if (!candidate || candidate.length > 2_048) return undefined;
  try {
    const url = new URL(candidate);
    return url.protocol === "http:" || url.protocol === "https:" ? url : undefined;
  } catch {
    return undefined;
  }
}

function snippet(...parts: Array<string | undefined>): string | undefined {
  const values = parts.filter((part): part is string => Boolean(part));
  return values.length > 0 ? [...new Set(values)].join("\n") : undefined;
}

function result(
  value: unknown,
  snippetValue: string | undefined,
  publishedValue: unknown,
): WebSearchResult | undefined {
  const item = record(value);
  const url = validUrl(item?.url);
  if (!item || !url) return undefined;

  const title = text(item.title) ?? url.hostname;
  const publishedAt = published(publishedValue);
  return {
    url: url.href,
    title,
    ...(snippetValue ? { snippet: snippetValue } : {}),
    ...(publishedAt ? { published: publishedAt } : {}),
    ...(url.hostname ? { siteName: url.hostname } : {}),
  };
}

function normalizeYou(payload: Record<string, unknown>): WebSearchResult[] {
  const groups = record(payload.results);
  const web = Array.isArray(groups?.web) ? groups.web : [];
  const news = Array.isArray(groups?.news) ? groups.news : [];
  return [...web, ...news]
    .map((value) => {
      const item = record(value);
      return result(
        value,
        snippet(text(item?.description), snippet(...texts(item?.snippets))),
        item?.published_at ?? item?.publishedAt ?? item?.age,
      );
    })
    .filter((item): item is WebSearchResult => Boolean(item));
}

function normalizeExa(payload: Record<string, unknown>): WebSearchResult[] {
  const values = Array.isArray(payload.results) ? payload.results : [];
  return values
    .map((value) => {
      const item = record(value);
      return result(
        value,
        snippet(text(item?.text), text(item?.summary), snippet(...texts(item?.highlights))),
        item?.publishedDate ?? item?.published_date,
      );
    })
    .filter((item): item is WebSearchResult => Boolean(item));
}

function normalizeParallel(payload: Record<string, unknown>): WebSearchResult[] {
  const values = Array.isArray(payload.results) ? payload.results : [];
  return values
    .map((value) => {
      const item = record(value);
      return result(
        value,
        snippet(text(item?.content), text(item?.description), snippet(...texts(item?.excerpts))),
        item?.publish_date ?? item?.published_date ?? item?.publishedAt,
      );
    })
    .filter((item): item is WebSearchResult => Boolean(item));
}

function normalizeTavily(payload: Record<string, unknown>): WebSearchResult[] {
  const values = Array.isArray(payload.results) ? payload.results : [];
  return values
    .map((value) => {
      const item = record(value);
      return result(
        value,
        snippet(text(item?.content), text(item?.raw_content)),
        item?.published_date ?? item?.publishedAt,
      );
    })
    .filter((item): item is WebSearchResult => Boolean(item));
}

export function normalizeResults(
  provider: ProviderId | string,
  payloadValue: unknown,
): WebSearchResult[] {
  const payload = record(payloadValue);
  if (!payload) throw new Error("Web-search provider returned a non-object JSON response");

  const normalizers: Partial<
    Record<ProviderId, (value: Record<string, unknown>) => WebSearchResult[]>
  > = {
    "you-com": normalizeYou,
    exa: normalizeExa,
    parallel: normalizeParallel,
    tavily: normalizeTavily,
  };
  const normalizer = normalizers[provider as ProviderId];
  if (!normalizer) throw new Error(`Unsupported provider response: ${provider}`);
  return normalizer(payload);
}
