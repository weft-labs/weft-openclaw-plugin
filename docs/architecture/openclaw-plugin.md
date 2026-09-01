# Weft for OpenClaw

Status: proposed end state

## Purpose

The Weft OpenClaw integration gives an agent the complete Weft workflow:

```text
discover a service -> inspect its contract and price -> check the wallet
-> pay and execute -> present the result and receipt
```

Web search is one service that Weft can discover. It is not the product
boundary.

## Layers

The repository ships three layers. Each layer has one owner.

### 1. Portable Agent Plugin bundle

`agent-plugin/` is a conforming Agent Plugins 1.0.0 bundle. It contains:

- the canonical `weft` skill, vendored byte-identical from
  `weft-labs/skills` at `SKILLS_REF`;
- one Streamable HTTP MCP connection to `https://weft.network/mcp`.

The hosted MCP server owns account OAuth, the four generic Weft tools, wallet
policy, paid execution, and receipts. The bundle contains no buyer runtime and
no payment code. Agent Plugins 1.0.0 cannot declare an OAuth mode. OpenClaw
users save the local server and its OAuth policy before login. The native
manifest also declares this policy for agent-side server discovery, but the
OpenClaw login command reads the saved local server list.

### 2. Native OpenClaw integration

The root OpenClaw plugin reuses the same vendored skill and declares the same
hosted MCP server. Native code adds only OpenClaw-specific behavior:

- optional requester-scoped MCP credentials for multi-user gateways;
- an optional native `web_search` provider.

The native plugin does not reimplement the generic MCP tools.

### 3. Optional web-search adapter

The `weft` web-search provider remains available for operators that explicitly
select it in OpenClaw's web-search configuration. It discovers and buys one
reviewed search operation through Weft and returns OpenClaw search rows.

This adapter is not the default Weft experience. It is a convenience facade
for one capability class. The generic MCP tools remain available independently.

## Generic MCP contract

The hosted server exposes these conceptual tools:

- `weft_search` — free discovery of data, APIs, agents, MCP tools, and actions;
- `weft_fetch` — paid execution with a caller-supplied price ceiling;
- `weft_balance` — read-only wallet and policy state;
- `weft_connection_status` — read-only connection state.

OpenClaw prefixes MCP tool names with the server identity. For server `weft`,
the provider-safe names are `weft__weft_search`, `weft__weft_fetch`,
`weft__weft_balance`, and `weft__weft_connection_status`. The underlying Weft
tool names and semantics do not change.

## Identity modes

Single-user installations use OpenClaw's normal MCP OAuth flow. No credential
is stored in the plugin package.

Multi-user gateways can configure exact requester bindings. Each binding uses
only host-trusted fields:

- `requesterSenderId`;
- `messageChannel`;
- optional `agentAccountId`;
- the name of an environment variable that contains the Weft credential.

When bindings exist, the native resolver is fail-closed:

- it returns a connection only for one exact matching binding;
- it does not invent requester identity;
- it does not fall back to a shared credential;
- a missing environment variable produces a specific remediation error;
- runs without trusted requester identity do not receive the scoped MCP tools.

Credential values are never accepted in the binding configuration and are
never logged or returned.

## Money and trust controls

The hosted Weft MCP server owns generic purchase policy and receipts. The
vendored skill requires a balance check, a tight `max_cost_usd`, no automatic
paid retry, and explicit confirmation for unclear side effects.

The optional web-search adapter keeps its additional controls:

- reviewed synchronous search operations only;
- HTTPS provider URLs;
- exact Weft attribution;
- one paid attempt with a strict ceiling;
- no provider credential or payment headers from catalog recipes;
- OpenClaw cancellation forwarded to network calls.

## Distribution

The public package is `@weft-labs/openclaw-plugin` in
`weft-labs/weft-openclaw-plugin`.

- Install the repository root for all three layers.
- Install `agent-plugin/` when only the portable skill and MCP bundle are
  allowed.
- Patrick owns merge, npm publication, and ClawHub publication.
