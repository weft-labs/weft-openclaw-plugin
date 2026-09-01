import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

const dockerfile = readFileSync(new URL("../Dockerfile.dogfood", import.meta.url), "utf8");

describe("Docker dogfood build context", () => {
  test("copies only the files needed by the staging lane", () => {
    expect(dockerfile).not.toMatch(/^COPY\s+(?:--\S+\s+)*\.\s+\.\s*$/m);
    expect(dockerfile).toContain("COPY src ./src");
    expect(dockerfile).toContain("COPY agent-plugin ./agent-plugin");
    expect(dockerfile).toContain("COPY scripts/check-openclaw.mjs scripts/dogfood.mjs ./scripts/");
  });
});
