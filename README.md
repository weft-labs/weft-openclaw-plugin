# Weft web search for OpenClaw 2.0

Use Weft as a native OpenClaw web-search provider. OpenClaw can search through
You.com, Exa, Parallel, or Tavily with one Weft buyer key. You do not need a
separate key for each search provider.

This plugin removes separate provider-key setup. It does not make search
unlimited. Your Weft balance, wallet policy, per-search ceiling, and provider
capacity still apply.

## Requirements

- OpenClaw `2026.8.1` or later
- Node.js 24.15 or later
- A Weft account with a buyer key and funded balance

## Install

After the first npm release, install the package:

```sh
openclaw plugins install npm:@weft-labs/openclaw-plugin
```

For a source checkout, install a linked development copy:

```sh
openclaw plugins install --link .
```

Set the buyer key in the environment that starts the OpenClaw Gateway:

```sh
export WEFT_API_KEY="your Weft buyer key"
```

Do not commit the key to a file. You can also store the key through OpenClaw's
web setup flow:

```sh
openclaw configure --section web
```

Then select Weft in `openclaw.json`:

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
  plugins: {
    entries: {
      weft: {
        enabled: true,
      },
    },
  },
}
```

Restart the Gateway after you change its environment or plugin configuration.
Run `openclaw plugins list` to confirm that the plugin is loaded.

## Provider modes

| Value | Behavior |
| --- | --- |
| `auto` | Select the lowest-price compatible operation within the ceiling. |
| `youcom` | Use only the reviewed You.com search operation. |
| `exa` | Use only the reviewed Exa search operation. |
| `parallel` | Use only the reviewed Parallel search operation. |
| `tavily` | Use only the reviewed Tavily search operation. |

For equal prices, `auto` uses the catalog score. A fixed mode does not silently
change the provider.

## Configuration

The provider scope takes precedence over the equivalent environment variable.

| Provider setting | Environment variable | Default |
| --- | --- | --- |
| `provider` | `WEFT_WEBSEARCH_PROVIDER` | `auto` |
| `maxCostUsd` | `WEFT_WEBSEARCH_MAX_COST_USD` | `0.01` |
| `baseUrl` | `WEFT_BASE_URL` | Weft SDK default |

`maxCostUsd` is a hard limit for one search. The live payment challenge is
authoritative. Weft refuses a request when its price exceeds this limit or the
wallet policy.

## Paid-call safety

For each OpenClaw search, the plugin:

1. Reads the current Weft balance and policy.
2. Runs a free Weft catalog search.
3. Selects one reviewed synchronous search operation.
4. Sends one paid Weft fetch with exact catalog attribution.
5. Converts the provider response to OpenClaw web-search rows.

The plugin does not retry an uncertain paid request. If cancellation or a
network error races with payment, inspect Weft purchase history before you run
the query again.

OpenClaw validates result URLs, limits external data, and wraps provider text as
untrusted content before it reaches the model.

## Development

```sh
mise exec -- pnpm install --frozen-lockfile
mise exec -- pnpm check
mise exec -- pnpm openclaw:check
```

Tests use local fixtures. They do not make paid calls.

## Docker dogfood

The Docker lane is staging-only. It refuses every other Weft base URL. Use a
short-lived staging buyer key and revoke it after the run:

```sh
WEFT_API_KEY="your short-lived staging key" \
  mise exec -- pnpm run dogfood:docker
```

The container:

1. Builds the plugin with Node.js 24.
2. Installs it into an isolated OpenClaw state directory.
3. Confirms that OpenClaw loads native provider `weft` without diagnostics.
4. Attempts one search with a hard `$0.01` ceiling.
5. Prints host metadata and either normalized result URLs or a structured safe
   refusal. It never prints the buyer key.

The root filesystem stays read-only. Temporary OpenClaw state and its private
SQLite worker cache use in-memory filesystems and disappear after the run.

Staging buyers use Base Sepolia. If an upstream provider advertises only a Base
mainnet challenge, Weft must stop before signing. The lane reports
`safe_blocked` with both network names. This proves the provider path and safety
gate, but it is not a successful paid search. A successful result needs a
reviewed provider operation with a testnet payment challenge.
