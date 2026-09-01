# weft-openclaw-plugin

## Purpose

First-party OpenClaw 2.0 web-search provider for Weft. It discovers a current
provider operation, buys it through Weft, and returns conforming OpenClaw rows.

## Stack

- TypeScript ESM, Node 24, pnpm 10
- OpenClaw native plugin SDK `2026.8.1`
- `@weft-labs/sdk` buyer client
- Vitest, Biome, tsup

## Commands

```sh
mise exec -- pnpm install --frozen-lockfile
mise exec -- pnpm check
mise exec -- pnpm openclaw:validate
```

## Constraints

- Use OpenClaw's public plugin API. Do not patch OpenClaw core.
- Never accept or forward provider API keys.
- Every paid fetch has a strict `maxCostUsd` and exact Weft attribution.
- Check balance and policy before each paid fetch.
- Never retry an uncertain paid fetch.
- Pass OpenClaw cancellation to every Weft network call.
- Accept only reviewed You.com, Exa, Parallel, and Tavily operation ids.
- Return raw conforming rows. OpenClaw core owns untrusted-content wrapping.
- Keep secrets out of source, tests, fixtures, logs, and plugin output.
- Patrick owns merge, npm publication, and ClawHub publication.
