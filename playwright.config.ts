import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 600000, // 10分钟超时
  fullyParallel: false,
  retries: 0,
  workers: 1, // 录制视频时使用单线程
  
  use: {
    baseURL: "http://localhost:3000",
    trace: "off",
    screenshot: "off",
    video: {
      mode: "on",
      size: { width: 1080, height: 608 }, // 16:9 横版
    },
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120000,
  },
});
