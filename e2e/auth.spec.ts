import { expect, test } from "@playwright/test";

import { ADMIN, USER, login, logout, tryLogin } from "./helpers";

test.describe("로그인 · 접근 권한", () => {
  test("[1] 로그아웃 상태에서 모든 페이지 접근 시 /login 으로 이동", async ({
    page,
  }) => {
    for (const path of ["/", "/dashboard", "/data", "/accounts"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login$/);
    }
  });

  test("[1-1] 로그아웃 상태에서 API 직접 호출 시 401", async ({ request }) => {
    const res = await request.get("/api/accounts");
    expect(res.status()).toBe(401);
  });

  test("[2-1] 비밀번호가 틀리면 통일된 실패 메시지", async ({ page }) => {
    await tryLogin(page, ADMIN.loginId, "틀린비밀번호");
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "아이디 또는 비밀번호가 올바르지 않습니다",
    );
    await expect(page).toHaveURL(/\/login$/);
  });

  test("[2-2] 없는 아이디도 같은 메시지 (계정 존재 여부 노출 안 함)", async ({
    page,
  }) => {
    await tryLogin(page, "존재하지않는계정", "아무비밀번호");
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "아이디 또는 비밀번호가 올바르지 않습니다",
    );
  });

  test("[7] 어드민 로그인 → 메뉴 3개 전부 보임", async ({ page }) => {
    await login(page, ADMIN);
    const nav = page.getByRole("navigation", { name: "주 메뉴" });
    await expect(nav.getByRole("link", { name: "대시보드" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "데이터 관리" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "계정 관리" })).toBeVisible();
    await expect(page.locator('[data-slot="badge"]')).toHaveText("어드민");
  });

  test("[6] 일반 계정 로그인 → 대시보드 메뉴만 보임", async ({ page }) => {
    await login(page, USER);
    const nav = page.getByRole("navigation", { name: "주 메뉴" });
    await expect(nav.getByRole("link", { name: "대시보드" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "데이터 관리" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "계정 관리" })).toHaveCount(0);
    await expect(page.locator('[data-slot="badge"]')).toHaveText("일반");
  });

  test("[4] 일반 계정이 /data 주소 직접 입력 → 403", async ({ page }) => {
    await login(page, USER);
    const res = await page.goto("/data");
    expect(res?.status()).toBe(403);
    await expect(page.getByText("403 · 접근 권한이 없습니다")).toBeVisible();
  });

  test("[5] 일반 계정이 /accounts 주소 직접 입력 → 403", async ({ page }) => {
    await login(page, USER);
    const res = await page.goto("/accounts");
    expect(res?.status()).toBe(403);
    await expect(page.getByText("403 · 접근 권한이 없습니다")).toBeVisible();
  });

  test("[공통] 로그아웃하면 다시 접근이 막힌다", async ({ page }) => {
    await login(page, ADMIN);
    await logout(page);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("[공통] 로그인한 채로 /login 에 가면 대시보드로 보낸다", async ({
    page,
  }) => {
    await login(page, ADMIN);
    await page.goto("/login");
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("[19] 휴대폰 화면(375px)에서 상단바가 깨지지 않는다", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 700 });
    await login(page, ADMIN);
    await expect(
      page.getByRole("navigation", { name: "주 메뉴" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "로그아웃" })).toBeVisible();
    // 가로 스크롤이 생기지 않아야 한다
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(overflow).toBe(false);
  });
});
