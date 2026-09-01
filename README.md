# Weft for OpenClaw 2.0

Find and buy paid data, APIs, agent services, and real-world actions from an
OpenClaw conversation.

Weft is not only web search. The default workflow is:

```text
search the service marketplace -> choose a contract -> check the wallet
-> pay and execute -> present the result and receipt
```

The plugin also includes an optional native web-search adapter for operators
who want OpenClaw's built-in `web_search` tool to buy a reviewed search
provider through Weft.

## What installs

| Layer | Default | Purpose |
| --- | --- | --- |
| Canonical `weft` skill | Yes | Teaches the agent service selection, payment, receipt, and safety loop. |
| Hosted Weft MCP | Yes | Supplies generic discovery, wallet, execution, and connection tools. |
| Requester identity resolver | When configured | Gives different trusted OpenClaw requesters different Weft credentials. |
| Native web-search adapter | When selected | Routes OpenClaw `web_search` through one Weft-bought search operation. |

OpenClaw prefixes MCP tools with their server name. The Weft tools appear as:

- `weft__weft_search`
- `weft__weft_fetch`
- `weft__weft_balance`
- `weft__weft_connection_status`

## Requirements

- OpenClaw `2026.8.1` or later
- Node.js 24.15 or later for the full native package
- a Weft account; paid calls also need a funded wallet

## Install the complete OpenClaw plugin

After the first npm release:

```sh
openclaw plugins install npm:@weft-labs/openclaw-plugin
openclaw gateway restart
```

For a source checkout:

```sh
openclaw plugins install --link .
openclaw gateway restart
```

Check the installation:

```sh
openclaw plugins inspect weft
openclaw mcp status --verbose
```

## Single-user setup

The default MCP connection uses OpenClaw's OAuth store. It does not need a key
in this package. Save the server in OpenClaw before login because the MCP
commands read the local server list:

```sh
openclaw mcp set weft '{"url":"https://weft.network/mcp","transport":"streamable-http","auth":"oauth","toolFilter":{"include":["weft_search","weft_fetch","weft_balance","weft_connection_status"]}}'
openclaw mcp login weft
openclaw mcp probe weft
```

Complete the browser sign-in, then start a new OpenClaw session. Ask for a
service, not only a web page. Examples:

- “Find an API that verifies this email address. Show the price before use.”
- “Find a company-data service and enrich these five domains.”
- “Find a service that can send this SMS. Do not execute until I confirm.”

The canonical skill requires a balance check before the first paid fetch, a
tight price ceiling, and no automatic retry of an uncertain paid call.

## Portable bundle only

Install the content-only Agent Plugins 1.0.0 bundle when native code is not
allowed:

```sh
openclaw plugins install ./agent-plugin
openclaw gateway restart
openclaw mcp set weft '{"url":"https://weft.network/mcp","transport":"streamable-http","auth":"oauth","toolFilter":{"include":["weft_search","weft_fetch","weft_balance","weft_connection_status"]}}'
openclaw mcp login weft
openclaw mcp probe weft
```

This loads the same canonical skill and hosted MCP server. It does not load the
requester resolver or the native web-search adapter. The portable Agent
Plugins format does not carry an OAuth mode, so the explicit `mcp set` step
adds OpenClaw's local authentication policy before login. The native manifest
also declares that policy for agent-side discovery, but its login command still
uses the saved local server entry.

## Multi-user requester identity

For a gateway shared by several message senders, keep each credential in a
Gateway environment variable and bind it to OpenClaw's trusted requester
identity:

```json5
{
  plugins: {
    entries: {
      weft: {
        enabled: true,
        config: {
          identity: {
            bindings: [
              {
                requesterSenderId: "123456",
                messageChannel: "telegram",
                agentAccountId: "main-bot",
                credentialEnv: "WEFT_PATRICK_API_KEY",
              },
            ],
          },
        },
      },
    },
  },
}
```

Set `WEFT_PATRICK_API_KEY` only in the environment that starts the Gateway.
Do not put a credential in the binding object.

Requester mode is fail-closed. An unmatched sender gets no Weft MCP connection.
A missing environment variable names the required variable but never prints a
credential. Runs without a trusted sender identity, such as cron and subagent
runs, do not receive requester-scoped Weft tools.

## Optional native web search

Set Weft as OpenClaw's web-search provider only when you want this shortcut:

```json5
{
  tools: {
    web: {
      search: {
        enabled: true,
        provider: "weft",
        weft: {
          provider: "auto",
          maxCostUsd: "0.01",
        },
      },
    },
  },
}
```

Set `WEFT_API_KEY` in the Gateway environment or use OpenClaw's web-provider
setup flow. This credential is only for the optional adapter; generic MCP OAuth
is independent.

Provider modes are `auto`, `youcom`, `exa`, `parallel`, and `tavily`. `auto`
uses the lowest-price compatible reviewed operation and uses catalog score only
to break equal-price ties. The adapter sends one paid request with a hard cost
ceiling and never retries an uncertain outcome.

## Development

```sh
mise exec -- pnpm install --frozen-lockfile
mise exec -- pnpm check
```

The `weft` skill is a byte-identical mirror of `weft-labs/skills` at the commit
in `SKILLS_REF`. Change it only in the canonical skills repository, then bump
the pin and re-vendor it here.

## Docker dogfood

The Docker lane is staging-only. It installs both plugin formats, checks the
generic MCP catalog and requester resolver, then exercises the optional native
web-search adapter with a strict `$0.01` ceiling:

```sh
WEFT_API_KEY="a short-lived staging buyer key" \
  mise exec -- pnpm run dogfood:docker
```

The container root filesystem is read-only. OpenClaw state, MCP credentials,
and caches live in temporary memory filesystems and disappear after the run.
The lane never prints the buyer key.

Staging uses Base Sepolia. A provider that advertises only a Base mainnet
challenge must be refused before signing. That safe refusal proves the control
path but is not a successful paid search.
