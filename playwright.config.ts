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

/**
 * PLAYWRIGHT_CHROME_PATH 를 지정하면 그 크롬으로 테스트한다.
 * 이 개발용 맥은 macOS 13이라 Playwright가 크로미움을 내려받지 못해서,
 * 별도로 받아둔 Chrome for Testing 을 가리킨다. (.env 참고)
 * 지정하지 않으면 Playwright 기본 크로미움을 쓴다.
 */
const chromePath = process.env.PLAYWRIGHT_CHROME_PATH;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  // 배포판은 네트워크·DB 왕복 때문에 로컬보다 느리다. 넉넉하게 잡는다.
  timeout: isLocal ? 60_000 : 120_000,
  expect: { timeout: isLocal ? 10_000 : 30_000 },
  use: {
    baseURL,
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
    trace: "retain-on-failure",
    launchOptions: chromePath ? { executablePath: chromePath } : {},
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
