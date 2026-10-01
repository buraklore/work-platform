import path from "node:path";

export const alias = {
  "@": path.resolve(__dirname, "src"),
  // `server-only` throws outside the React Server runtime; services are plain Node here.
  "server-only": path.resolve(__dirname, "tests/support/empty.ts"),
};
