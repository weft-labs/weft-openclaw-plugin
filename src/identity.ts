const DEFAULT_MCP_URL = "https://weft.network/mcp";
const ENV_NAME = /^[A-Z_][A-Z0-9_]*$/;

type Environment = Readonly<Record<string, string | undefined>>;
type ReportConfigurationError = (message: string) => void;

export interface RequesterBinding {
  readonly requesterSenderId: string;
  readonly messageChannel: string;
  readonly agentAccountId?: string;
  readonly credentialEnv: string;
}

export interface IdentityConfig {
  readonly baseUrl: string;
  readonly bindings: readonly RequesterBinding[];
}

export interface RequesterContext {
  readonly requesterSenderId: string;
  readonly messageChannel?: string;
  readonly agentAccountId?: string;
}

export interface McpConnectionResolver {
  readonly serverName: "weft";
  readonly resolve: (context: RequesterContext) => Promise<{
    readonly url: string;
    readonly headers: Readonly<Record<string, string>>;
  } | null>;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function requiredText(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Weft requester binding ${field} must be a non-empty string`);
  }
  return value.trim();
}

function optionalText(value: unknown, field: string): string | undefined {
  if (value === undefined) return undefined;
  return requiredText(value, field);
}

function normalizeMcpUrl(value: unknown): string {
  const raw = value === undefined ? DEFAULT_MCP_URL : requiredText(value, "baseUrl");
  const parsed = new URL(raw);
  const loopback = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && loopback)) {
    throw new Error("Weft MCP baseUrl must use HTTPS, except for localhost development");
  }
  parsed.pathname = parsed.pathname.replace(/\/+$/, "") || "/";
  return parsed.href.replace(/\/$/, "");
}

function parseBinding(value: unknown): RequesterBinding {
  const binding = record(value);
  if (!binding) throw new Error("Each Weft requester binding must be an object");

  const credentialEnv = requiredText(binding.credentialEnv, "credentialEnv");
  if (!ENV_NAME.test(credentialEnv)) {
    throw new Error(
      "Weft requester binding credentialEnv must be an uppercase environment variable name",
    );
  }

  const agentAccountId = optionalText(binding.agentAccountId, "agentAccountId");
  return {
    requesterSenderId: requiredText(binding.requesterSenderId, "requesterSenderId"),
    messageChannel: requiredText(binding.messageChannel, "messageChannel"),
    credentialEnv,
    ...(agentAccountId ? { agentAccountId } : {}),
  };
}

export function readIdentityConfig(pluginConfig: unknown): IdentityConfig {
  const identity = record(record(pluginConfig)?.identity);
  const rawBindings = identity?.bindings;
  if (rawBindings !== undefined && !Array.isArray(rawBindings)) {
    throw new Error("Weft identity bindings must be an array");
  }

  const bindings = (rawBindings ?? []).map(parseBinding);
  for (const [index, binding] of bindings.entries()) {
    for (const candidate of bindings.slice(index + 1)) {
      if (
        binding.requesterSenderId !== candidate.requesterSenderId ||
        binding.messageChannel !== candidate.messageChannel
      ) {
        continue;
      }
      if (binding.agentAccountId === candidate.agentAccountId) {
        throw new Error("Duplicate Weft requester binding for one trusted identity");
      }
      if (binding.agentAccountId === undefined || candidate.agentAccountId === undefined) {
        throw new Error(
          "Overlapping Weft requester bindings cannot mix channel-wide and account-specific identities",
        );
      }
    }
  }

  return { baseUrl: normalizeMcpUrl(identity?.baseUrl), bindings };
}

function matches(binding: RequesterBinding, context: RequesterContext): boolean {
  return (
    binding.requesterSenderId === context.requesterSenderId &&
    binding.messageChannel === context.messageChannel &&
    (binding.agentAccountId === undefined || binding.agentAccountId === context.agentAccountId)
  );
}

export function createMcpConnectionResolver(
  config: IdentityConfig,
  environment: Environment = process.env,
  reportConfigurationError: ReportConfigurationError = () => {},
): McpConnectionResolver {
  return {
    serverName: "weft",
    async resolve(context) {
      const binding = config.bindings.find((candidate) => matches(candidate, context));
      if (!binding) return null;

      const credential = environment[binding.credentialEnv]?.trim();
      if (!credential) {
        const message = `Weft requester credential ${binding.credentialEnv} is missing. Set it in the Gateway environment and restart OpenClaw.`;
        reportConfigurationError(message);
        throw new Error(message);
      }

      return {
        url: config.baseUrl,
        headers: { Authorization: `Bearer ${credential}` },
      };
    },
  };
}
