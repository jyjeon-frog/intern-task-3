import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

export const ADMIN = { loginId: "admin", password: "Admin!2026" };
export const USER = { loginId: "user01", password: "User!2026" };

/** 로그인 화면에서 로그인하고 대시보드로 넘어갈 때까지 기다린다 */
export async function login(
  page: Page,
  account: { loginId: string; password: string },
) {
  await page.goto("/login");
  await page.getByLabel("아이디").fill(account.loginId);
  await page.getByLabel("비밀번호").fill(account.password);
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

/** 로그인 시도만 하고 결과는 확인하지 않는다 (실패 케이스용) */
export async function tryLogin(page: Page, loginId: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("아이디").fill(loginId);
  await page.getByLabel("비밀번호").fill(password);
  await page.getByRole("button", { name: "로그인" }).click();
}

export async function logout(page: Page) {
  await page.getByRole("button", { name: "로그아웃" }).click();
  await expect(page).toHaveURL(/\/login$/);
}
