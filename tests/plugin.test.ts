import { describe, expect, test, vi } from "vitest";

import plugin from "../src/index.js";

describe("OpenClaw plugin", () => {
  test("registers one native Weft web-search provider", () => {
    const registerWebSearchProvider = vi.fn();

    plugin.register({ registerWebSearchProvider } as never);

    expect(registerWebSearchProvider).toHaveBeenCalledTimes(1);
    const provider = registerWebSearchProvider.mock.calls[0]?.[0];
    expect(provider).toMatchObject({
      id: "weft",
      requiresCredential: true,
      envVars: ["WEFT_API_KEY"],
      credentialPath: "plugins.entries.weft.config.webSearch.apiKey",
      createTool: expect.any(Function),
    });
  });

  test("reads and writes the credential in the provider scope", () => {
    const registerWebSearchProvider = vi.fn();
    plugin.register({ registerWebSearchProvider } as never);
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
