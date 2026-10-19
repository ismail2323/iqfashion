import { defineConfig, devices } from "@playwright/test";

const E2E_DB = "postgresql://postgres:postgres@localhost:54329/iqfashion_e2e";
const PORT = 3200;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 180_000,
  expect: { timeout: 15_000 },
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: { ...devices["Desktop Chrome"], baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure", locale: "tr-TR", timezoneId: "Europe/Istanbul" },
  webServer: {
    command: "node scripts/e2e-sunucu.mjs",
    url: `http://localhost:${PORT}/giris`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL: E2E_DB,
      DIRECT_URL: E2E_DB,
      SESSION_SECRET: "e2e-secret-e2e-secret-e2e-secret-0123456789abcdef",
      GROQ_API_KEYS: "e2e-sahte-anahtar", // AI "hazır" görünsün; istekler testte yakalanıp sahte yanıt verilir
      GEMINI_API_KEY: "",
    },
  },
});