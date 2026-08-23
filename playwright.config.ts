import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

dotenv.config();

/**
 * 검증용 자동 테스트 설정.
 * BASE_URL 환경변수를 주면 배포된 Vercel 주소로도 그대로 돌릴 수 있다.
 *   예) BASE_URL=https://xxx.vercel.app npx playwright test
 */
const baseURL = process.env.BASE_URL ?? "http://localhost:3000";
const isLocal = baseURL.includes("localhost");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: isLocal
    ? {
        command: "npm run dev",
        url: "http://localhost:3000/login",
        reuseExistingServer: true,
        timeout: 120_000,
      }
    : undefined,
});
