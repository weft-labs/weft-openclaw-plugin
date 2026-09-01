import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const stateDirectory = mkdtempSync(join(tmpdir(), "weft-openclaw-host-"));
const environment = { ...process.env, OPENCLAW_STATE_DIR: stateDirectory };

try {
  execFileSync(
    "openclaw",
    [
      "plugins",
      "install",
      "--link",
      ".",
      "--force",
      "--accept-capabilities",
      "--acknowledge-install-policy-warning",
    ],
    { env: environment, stdio: "ignore" },
  );
  const inspection = JSON.parse(
    execFileSync("openclaw", ["plugins", "inspect", "weft", "--json"], {
      encoding: "utf8",
      env: environment,
    }),
  );
  const plugin = inspection.plugin;
  if (
    plugin?.status !== "loaded" ||
    !plugin.webSearchProviderIds?.includes("weft") ||
    plugin.diagnostics?.length > 0
  ) {
    throw new Error(`OpenClaw did not load the Weft provider: ${JSON.stringify(inspection)}`);
  }
  execFileSync("openclaw", ["plugins", "doctor"], {
    env: environment,
    stdio: "ignore",
  });
  console.log("OpenClaw loaded the native Weft web-search provider without diagnostics.");
} finally {
  rmSync(stateDirectory, { force: true, recursive: true });
}
