import { defineConfig, devices } from "@playwright/test";
import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { BASE_URL, PORT } from "./e2e/config";

// A fresh scratch folder per run so raw logs and map images never land under data/.
// Worker processes re-import this file and make their own (empty) folder; only the
// runner's folder reaches the server.
const scratch = mkdtempSync(path.join(tmpdir(), "ow-scrims-e2e-"));
for (const sub of ["logs", "map-images"]) mkdirSync(path.join(scratch, sub), { recursive: true });

export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.spec.ts",
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm exec next build && pnpm exec next start -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      DATABASE_URL: "memory://",
      LOG_DIR: path.join(scratch, "logs"),
      MAP_IMAGE_DIR: path.join(scratch, "map-images"),
    },
  },
});
