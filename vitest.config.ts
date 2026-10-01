import { defineConfig } from "vitest/config";
import { alias } from "./vitest.shared";

export default defineConfig({
  resolve: { alias },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    setupFiles: ["tests/setup/env.ts"],
  },
});
