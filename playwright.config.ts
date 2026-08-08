import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 60000,
  // Serial, not parallel: multiple tests calling the Gemini API at the same
  // time can exceed the free-tier per-minute rate limit (this happened in
  // CI — one concurrent extraction call failed silently under load). See
  // DECISIONS.md.
  workers: 1,
  webServer: [
    {
      command: "npm run build && npm start",
      cwd: "server",
      url: "http://localhost:3000/api/health",
      timeout: 60000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "node scripts/serve-web.js",
      url: "http://localhost:8765",
      timeout: 30000,
      reuseExistingServer: !process.env.CI,
    },
  ],
  use: {
    baseURL: "http://localhost:8765",
  },
});
