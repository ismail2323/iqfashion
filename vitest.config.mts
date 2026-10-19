import { defineConfig } from "vitest/config";
import path from "node:path";

const TEST_DB = "postgresql://postgres:postgres@localhost:54329/iqfashion_test";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "tests/setup/server-only.ts"),
    },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    globalSetup: ["tests/setup/global.ts"],
    env: { DATABASE_URL: TEST_DB, DIRECT_URL: TEST_DB, SESSION_SECRET: "test-secret-test-secret-test-secret-0123456789" },
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});