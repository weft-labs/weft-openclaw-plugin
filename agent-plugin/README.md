# Weft portable agent bundle

This Agent Plugins 1.0.0 bundle contains the canonical Weft skill and the
hosted Weft MCP connection. It does not contain native code.

Install it in OpenClaw:

```sh
openclaw plugins install ./agent-plugin
openclaw gateway restart
```

The portable MCP format does not carry an OAuth mode. Tell OpenClaw to use
OAuth for this server before you sign in:

```sh
openclaw mcp set weft '{"url":"https://weft.network/mcp","transport":"streamable-http","auth":"oauth","toolFilter":{"include":["weft_search","weft_fetch","weft_balance","weft_connection_status"]}}'
openclaw mcp login weft
openclaw mcp probe weft
```

The full native package declares the server for agent use, but its login
command also needs this saved local server entry.
