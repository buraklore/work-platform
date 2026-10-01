import { defineConfig, devices } from "@playwright/test";

/**
 * Local end-to-end run against the production build, local Postgres and a fake Supabase
 * Auth (tests/e2e-local/fake-auth.mjs). See tests/e2e-local/README.md.
 */
export default defineConfig({
  testDir: ".",
  timeout: 60_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3100",
    locale: "tr-TR",
    timezoneId: "Europe/Istanbul",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  outputDir: "/tmp/e2e-results",
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1360, height: 860 } }, testMatch: /(desktop|audit)\.spec\.ts/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec\.ts/ },
  ],
});
