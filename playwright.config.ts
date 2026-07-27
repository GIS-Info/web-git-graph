import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: {
    baseURL: "http://127.0.0.1:4173",
    viewport: { width: 1440, height: 1000 }
  },
  webServer: {
    command: "pnpm --filter @web-git-graph/demo dev --host 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173/web-git-graph/",
    reuseExistingServer: true
  }
});
