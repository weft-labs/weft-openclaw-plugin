# MCP-first Weft integration

Status: accepted 2026-09-01

## Decision

The OpenClaw plugin is a generic Weft integration, not a web-search plugin.

The canonical `weft` skill and hosted Weft MCP server are the primary product
surface. Native OpenClaw code is limited to requester-scoped identity and an
optional web-search adapter.

## Context

The first implementation copied the OpenCode web-search design. That design is
specific to OpenCode's provider surface. It reduced Weft to one search provider
and hid service discovery, contract selection, paid execution, composition,
side effects, and receipts.

OpenClaw 2.0 can load Agent Plugins bundles, skill roots, hosted MCP servers,
and requester-scoped MCP connection resolvers. A duplicate generic buyer
runtime is not necessary.

## Consequences

- Generic Weft behavior stays owned by the hosted MCP server and canonical
  skill.
- The package supports both a portable content-only bundle and the full native
  OpenClaw integration.
- Native and portable installs save OpenClaw's local OAuth policy before login.
  Agent Plugins 1.0.0 does not carry that host-specific field, and OpenClaw's
  login command reads the saved server list rather than manifest defaults.
- Multi-user identity is explicit and fail-closed.
- Web search remains useful but no longer defines the plugin.
- The repository keeps the existing tested web-search code as an optional
  adapter instead of deleting a working capability.

## Revisit triggers

Revisit this boundary if OpenClaw can no longer load hosted MCP tools from a
plugin, if its MCP OAuth cannot support single-user installation, or if a
measured requester-identity requirement cannot be expressed by the native
resolver contract.
