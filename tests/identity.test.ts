import { describe, expect, test } from "vitest";

import { createMcpConnectionResolver, readIdentityConfig } from "../src/identity.js";

const pluginConfig = {
  identity: {
    baseUrl: "https://staging.weft.network/mcp/",
    bindings: [
      {
        requesterSenderId: "patrick",
        messageChannel: "telegram",
        agentAccountId: "weft-bot",
        credentialEnv: "WEFT_PATRICK_API_KEY",
      },
    ],
  },
};

describe("requester-scoped MCP identity", () => {
  test("matches the complete trusted identity and reads only its named environment variable", async () => {
    const config = readIdentityConfig(pluginConfig);
    const resolver = createMcpConnectionResolver(config, {
      WEFT_PATRICK_API_KEY: "wk_private",
    });

    await expect(
      resolver.resolve({
        requesterSenderId: "patrick",
        messageChannel: "telegram",
        agentAccountId: "weft-bot",
      }),
    ).resolves.toEqual({
      url: "https://staging.weft.network/mcp",
      headers: { Authorization: "Bearer wk_private" },
    });
  });

  test("fails closed for an unmatched requester, channel, or account", async () => {
    const resolver = createMcpConnectionResolver(readIdentityConfig(pluginConfig), {
      WEFT_PATRICK_API_KEY: "wk_private",
    });

    await expect(
      resolver.resolve({ requesterSenderId: "other", messageChannel: "telegram" }),
    ).resolves.toBeNull();
    await expect(
      resolver.resolve({ requesterSenderId: "patrick", messageChannel: "slack" }),
    ).resolves.toBeNull();
    await expect(
      resolver.resolve({ requesterSenderId: "patrick", messageChannel: "telegram" }),
    ).resolves.toBeNull();
  });

  test("gives a specific setup error when the bound credential is missing", async () => {
    const reported: string[] = [];
    const resolver = createMcpConnectionResolver(readIdentityConfig(pluginConfig), {}, (message) =>
      reported.push(message),
    );

    await expect(
      resolver.resolve({
        requesterSenderId: "patrick",
        messageChannel: "telegram",
        agentAccountId: "weft-bot",
      }),
    ).rejects.toThrow(/WEFT_PATRICK_API_KEY.*Gateway environment/);
    expect(reported).toEqual([expect.stringMatching(/WEFT_PATRICK_API_KEY.*Gateway environment/)]);
  });

  test("rejects ambiguous, secret-bearing, and insecure binding configuration", () => {
    const binding = {
      requesterSenderId: "patrick",
      messageChannel: "telegram",
      credentialEnv: "WEFT_PATRICK_API_KEY",
    };

    expect(() => readIdentityConfig({ identity: { bindings: [binding, binding] } })).toThrow(
      /Duplicate Weft requester binding/,
    );
    expect(() =>
      readIdentityConfig({
        identity: {
          bindings: [binding, { ...binding, agentAccountId: "weft-bot" }],
        },
      }),
    ).toThrow(/Overlapping Weft requester bindings/);
    expect(() =>
      readIdentityConfig({
        identity: {
          bindings: [
            { ...binding, agentAccountId: "weft-bot" },
            { ...binding, agentAccountId: "other-bot" },
          ],
        },
      }),
    ).not.toThrow();
    expect(() =>
      readIdentityConfig({
        identity: { bindings: [{ ...binding, credentialEnv: "wk_not_an_env_name" }] },
      }),
    ).toThrow(/environment variable name/);
    expect(() =>
      readIdentityConfig({ identity: { baseUrl: "http://weft.example", bindings: [binding] } }),
    ).toThrow(/must use HTTPS/);
  });
});
