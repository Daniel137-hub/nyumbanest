import { defineConfig } from "@playwright/test";

const mockAuthPort = 54329;
const appPort = 3137;

export default defineConfig({
  testDir: "./tests",
  outputDir: "./.playwright-results",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${appPort}`,
    browserName: "chromium",
  },
  webServer: [
    {
      command: "node tests/mock-supabase.mjs",
      url: `http://127.0.0.1:${mockAuthPort}/__health`,
      reuseExistingServer: false,
    },
    {
      command: `node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port ${appPort}`,
      url: `http://127.0.0.1:${appPort}/signup`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        NYUMBANEST_PLAYWRIGHT: "1",
        NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${mockAuthPort}`,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "nyumbanest-playwright-test-key",
      },
    },
  ],
});
