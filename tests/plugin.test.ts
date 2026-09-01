import { describe, expect, test, vi } from "vitest";

import plugin from "../src/index.js";

describe("OpenClaw plugin", () => {
  test("registers the optional web-search provider without a shared identity resolver", () => {
    const registerWebSearchProvider = vi.fn();
    const registerMcpServerConnectionResolver = vi.fn();

    plugin.register({ registerWebSearchProvider, registerMcpServerConnectionResolver } as never);

    expect(registerWebSearchProvider).toHaveBeenCalledTimes(1);
    expect(registerMcpServerConnectionResolver).not.toHaveBeenCalled();
    const provider = registerWebSearchProvider.mock.calls[0]?.[0];
    expect(provider).toMatchObject({
      id: "weft",
      requiresCredential: true,
      envVars: ["WEFT_API_KEY"],
      credentialPath: "plugins.entries.weft.config.webSearch.apiKey",
      createTool: expect.any(Function),
    });
  });

  test("registers requester-scoped MCP identity only when bindings exist", () => {
    const registerWebSearchProvider = vi.fn();
    const registerMcpServerConnectionResolver = vi.fn();

    plugin.register({
      pluginConfig: {
        identity: {
          bindings: [
            {
              requesterSenderId: "patrick",
              messageChannel: "telegram",
              credentialEnv: "WEFT_PATRICK_API_KEY",
            },
          ],
        },
      },
      registerWebSearchProvider,
      registerMcpServerConnectionResolver,
    } as never);

    expect(registerMcpServerConnectionResolver).toHaveBeenCalledWith({
      serverName: "weft",
      resolve: expect.any(Function),
    });
    expect(registerWebSearchProvider).toHaveBeenCalledTimes(1);
  });

  test("reads and writes the credential in the provider scope", () => {
    const registerWebSearchProvider = vi.fn();
    plugin.register({
      registerWebSearchProvider,
      registerMcpServerConnectionResolver: vi.fn(),
    } as never);
    const provider = registerWebSearchProvider.mock.calls[0]?.[0];
    const searchConfig: Record<string, unknown> = {};

    provider.setCredentialValue(searchConfig, "wk_test");

    expect(searchConfig).toEqual({ weft: { apiKey: "wk_test" } });
    expect(provider.getCredentialValue(searchConfig)).toBe("wk_test");
    expect(
      provider.getConfiguredCredentialValue({
        plugins: { entries: { weft: { config: { webSearch: { apiKey: "wk_saved" } } } } },
      }),
    ).toBe("wk_saved");

    const config: Record<string, unknown> = {};
    provider.setConfiguredCredentialValue(config, "wk_resolved");
    expect(config).toEqual({
      plugins: {
        entries: {
          weft: { enabled: true, config: { webSearch: { apiKey: "wk_resolved" } } },
        },
      },
    });
  });
});
