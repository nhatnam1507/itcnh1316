import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      // SwiftShader gives headless Chromium a software WebGL context for MapLibre.
      use: { ...devices["Desktop Chrome"], launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] } },
    },
  ],
  webServer: {
    command: "npm run start",
    url: "http://localhost:3000/unlock",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
