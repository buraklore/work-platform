import { defineConfig } from "vitest/config";
import { alias } from "./vitest.shared";

export default defineConfig({
  resolve: { alias },
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    setupFiles: ["tests/setup/env.ts"],
    globalSetup: ["tests/setup/global-db.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/app_it",
    },
  },
});
