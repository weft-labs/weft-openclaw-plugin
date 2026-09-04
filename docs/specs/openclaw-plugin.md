---
id: openclaw-plugin
status: active
depends-on: []
---

# Weft OpenClaw plugin

## Goal

Ship the complete Weft workflow in OpenClaw through a portable skill plus the
hosted Weft MCP server. Add a thin native identity resolver for multi-user
gateways and retain native web search as an explicit optional adapter.

## Layer choice

The skill carries the search, choose, fetch, receipt, and safety procedure. MCP
is the generic executor because Weft is authenticated, customer-facing, and
used by unattended agents. Native TypeScript exists only for OpenClaw-specific
requester identity and web-search provider registration.

## Files to touch

- `agent-plugin/plugin.json`, `agent-plugin/mcp.json`, and
  `agent-plugin/skills/weft/`
- `SKILLS_REF` and the skill drift gate
- `openclaw.plugin.json`
- `src/identity.ts` and `src/index.ts`
- the existing optional web-search implementation
- package, host-load, identity, and Docker dogfood tests
- README and repository operating instructions

## Contracts in

- Agent Plugins 1.0.0 manifest and MCP schemas
- canonical `weftlabs/skills/skills/weft` at `SKILLS_REF`
- hosted Weft MCP at `https://weft.network/mcp`
- OpenClaw `2026.8.1` native manifest, skill, MCP, requester resolver, and
  web-search provider APIs
- trusted resolver fields supplied by OpenClaw
- existing Weft catalog, balance, fetch, attribution, and receipt contracts for
  the optional web-search adapter

## Contracts out

- portable bundle id: `weft`
- native plugin id: `weft`
- package: `@weft-labs/openclaw-plugin`
- generic MCP server id: `weft`
- generic tool semantics: `weft_search`, `weft_fetch`, `weft_balance`, and
  `weft_connection_status`
- requester binding: exact trusted identity tuple plus an environment-variable
  name; never a credential value
- optional native web-search provider id: `weft`

## Acceptance

- OpenClaw installs `agent-plugin/` as an Agent Plugins bundle and discovers
  its canonical skill and hosted MCP server.
- The native plugin declares the same skill root and MCP server without copying
  the generic Weft runtime.
- The vendored skill is byte-identical to the canonical repository at the
  pinned `SKILLS_REF`; CI rejects drift.
- A single-user install can use OpenClaw MCP OAuth without a plugin credential.
  Native and portable instructions save the local server and OAuth mode before
  login.
- Requester-scoped identity registers only when bindings exist, matches only
  host-trusted fields, loads credentials only from named environment variables,
  and fails closed for unmatched or untrusted runs.
- Missing requester credentials state the missing variable and the next setup
  action without exposing any secret.
- The optional web-search provider remains available only when the operator
  selects provider `weft`; generic Weft does not depend on it.
- The web-search adapter preserves its strict ceiling, attribution,
  cancellation, URL/header validation, and no-paid-retry controls.
- The package contains the portable bundle, native manifest, skill pin, source,
  built runtime, documentation, and license.
- Docker dogfood proves native load, portable-bundle load, the generic MCP tool
  catalog, requester resolution, and the optional staging web-search safety
  path.

## Acceptance command

```sh
mise exec -- pnpm install --frozen-lockfile
mise exec -- pnpm check
mise exec -- pnpm run dogfood:docker
```

## Verification query

Install the root plugin in OpenClaw. Confirm the four Weft MCP tools and the
canonical skill are present. Run one free service discovery. Then select the
optional `weft` web-search provider and confirm either a settled staging result
or the expected environment-mismatch refusal without a signed payment.
