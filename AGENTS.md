# weft-openclaw-plugin

## Purpose

First-party generic Weft integration for OpenClaw 2.0. The canonical skill and
hosted MCP server provide discovery, wallet checks, paid execution, actions,
and receipts. Native code adds requester-scoped identity and an optional
web-search adapter.

## Stack

- Agent Plugins 1.0.0 bundle
- TypeScript ESM, Node 24, pnpm 10
- OpenClaw native plugin SDK `2026.8.1`
- `@weft-labs/sdk` only for the optional web-search adapter
- Vitest, Biome, tsup

## Commands

```sh
mise exec -- pnpm install --frozen-lockfile
mise exec -- pnpm check
mise exec -- pnpm run dogfood:docker
```

## Constraints

- The generic path is skill plus hosted MCP. Do not copy the buyer runtime into
  native code.
- `agent-plugin/skills/weft/` is a byte-identical mirror of
  `weftlabs/skills` at `SKILLS_REF`. Never edit it directly.
- Use OpenClaw's public plugin API. Do not patch OpenClaw core.
- Requester identity uses only host-trusted fields and environment-variable
  names. Never store, log, or return credential values.
- Requester mode has no shared fallback and does not invent identity for cron or
  subagent runs.
- Web search is optional. Keep its strict ceiling, exact attribution, reviewed
  operation allowlist, cancellation, and no-paid-retry controls.
- Provider credentials never enter this plugin.
- Keep secrets out of source, tests, fixtures, logs, and plugin output.
- Patrick owns merge, npm publication, and ClawHub publication.
