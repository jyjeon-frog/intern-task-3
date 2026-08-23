import { expect, test } from "@playwright/test";

import { db } from "./db";
import { ADMIN, USER, login, logout } from "./helpers";

/** 이 파일에서 만들었다 지우는 임시 계정들 */
const TEMP_IDS = ["newuser01", "promoteme", "tempadmin"];

test.describe.configure({ mode: "serial" });

/** 계정 추가 창을 열어 입력하고 [만들기] 를 누른다 */
async function fillAddAccountForm(
  page: import("@playwright/test").Page,
  values: { loginId: string; name: string; role?: string; password: string },
) {
  await page.getByRole("button", { name: "계정 추가" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("아이디").fill(values.loginId);
  await dialog.getByLabel("이름").fill(values.name);
  if (values.role) await dialog.getByLabel("등급").selectOption(values.role);
  await dialog.getByLabel("초기 비밀번호").fill(values.password);
  await dialog.getByRole("button", { name: "만들기" }).click();
}

async function cleanup() {
  await db.loginAttempt.deleteMany({ where: { loginId: { in: TEMP_IDS } } });
  await db.user.deleteMany({ where: { loginId: { in: TEMP_IDS } } });
}

test.beforeAll(cleanup);
test.afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

test("[9] 어드민이 계정 목록을 조회한다", async ({ page }) => {
  await login(page, ADMIN);
  await page.getByRole("link", { name: "계정 관리" }).click();
  await expect(page).toHaveURL(/\/accounts$/);

  await expect(page.locator('tr[data-login-id="admin"]')).toBeVisible();
  await expect(page.locator('tr[data-login-id="user01"]')).toBeVisible();
});

test("[14] 계정 추가 → 그 계정으로 로그인 성공", async ({ page }) => {
  await login(page, ADMIN);
  await page.goto("/accounts");

  await fillAddAccountForm(page, {
    loginId: "newuser01",
    name: "새사용자",
    role: "USER",
    password: "NewUser!2026",
  });

  await expect(page.locator('tr[data-login-id="newuser01"]')).toBeVisible();

  // 새 계정으로 실제 로그인이 되는지
  await logout(page);
  await login(page, { loginId: "newuser01", password: "NewUser!2026" });
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("[14-1] 중복 아이디는 만들 수 없다", async ({ page }) => {
  await login(page, ADMIN);
  await page.goto("/accounts");

  await fillAddAccountForm(page, {
    loginId: "admin",
    name: "중복테스트",
    password: "Dup!12345",
  });

  await expect(
    page.getByText("이미 사용 중인 아이디입니다.").first(),
  ).toBeVisible();
});

test("[14-2] 짧은 비밀번호는 항목별 오류가 보인다", async ({ page }) => {
  await login(page, ADMIN);
  await page.goto("/accounts");

  await fillAddAccountForm(page, {
    loginId: "shortpw",
    name: "짧은비번",
    password: "123",
  });

  await expect(
    page.getByText("비밀번호는 8자 이상이어야 합니다.").first(),
  ).toBeVisible();

  // 실제로 만들어지지 않았는지 확인
  expect(await db.user.count({ where: { loginId: "shortpw" } })).toBe(0);
});

test("[15] 권한을 USER→ADMIN 으로 바꾸면 /accounts 에 들어갈 수 있다", async ({
  page,
}) => {
  await login(page, ADMIN);
  await page.goto("/accounts");
  await fillAddAccountForm(page, {
    loginId: "promoteme",
    name: "승격대상",
    role: "USER",
    password: "Promote!2026",
  });
  await expect(page.locator('tr[data-login-id="promoteme"]')).toBeVisible();

  // 승격 전: 일반 계정이라 403
  await logout(page);
  await login(page, { loginId: "promoteme", password: "Promote!2026" });
  expect((await page.goto("/accounts"))?.status()).toBe(403);

  // 어드민으로 돌아가 등급 변경
  await logout(page);
  await login(page, ADMIN);
  await page.goto("/accounts");
  await page.getByLabel("promoteme 등급").selectOption("ADMIN");
  await expect(page.getByText("등급을 어드민으로 바꿨습니다.")).toBeVisible();

  // 승격 후: 접속 가능
  await logout(page);
  await login(page, { loginId: "promoteme", password: "Promote!2026" });
  expect((await page.goto("/accounts"))?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "계정 관리" })).toBeVisible();
});

test("[9-1] 활성/비활성 전환과 비밀번호 초기화가 동작한다", async ({ page }) => {
  await login(page, ADMIN);
  await page.goto("/accounts");

  const row = page.locator('tr[data-login-id="newuser01"]');

  await row.getByRole("button", { name: "비활성화" }).click();
  await expect(page.getByText("계정을 비활성화했습니다.")).toBeVisible();
  await expect(row.getByText("비활성")).toBeVisible();

  // 비활성 상태에서는 로그인 불가
  await logout(page);
  await page.goto("/login");
  await page.getByLabel("아이디").fill("newuser01");
  await page.getByLabel("비밀번호").fill("NewUser!2026");
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "아이디 또는 비밀번호가 올바르지 않습니다",
  );

  // 다시 활성화 + 비밀번호 초기화
  await login(page, ADMIN);
  await page.goto("/accounts");
  await row.getByRole("button", { name: "활성화" }).click();
  await expect(page.getByText("계정을 활성화했습니다.")).toBeVisible();

  await row.getByRole("button", { name: "newuser01 비밀번호 초기화" }).click();
  const resetDialog = page.getByRole("dialog");
  await resetDialog.getByLabel("새 비밀번호").fill("Changed!2026");
  await resetDialog.getByRole("button", { name: "변경" }).click();
  await expect(page.getByText("비밀번호를 바꿨습니다.")).toBeVisible();

  // 바뀐 비밀번호로 로그인
  await logout(page);
  await login(page, { loginId: "newuser01", password: "Changed!2026" });
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("[9-2] 계정 삭제 (확인 창을 거친다)", async ({ page }) => {
  await login(page, ADMIN);
  await page.goto("/accounts");

  await page.getByRole("button", { name: "newuser01 삭제" }).click();
  await expect(page.getByText("계정을 삭제할까요?")).toBeVisible();
  await page.getByRole("button", { name: "삭제", exact: true }).click();

  await expect(page.getByText("계정을 삭제했습니다.")).toBeVisible();
  await expect(page.locator('tr[data-login-id="newuser01"]')).toHaveCount(0);
  expect(await db.user.count({ where: { loginId: "newuser01" } })).toBe(0);
});

test("[17] 어드민은 자기 계정을 삭제·강등·비활성화할 수 없다 (화면)", async ({
  page,
}) => {
  await login(page, ADMIN);
  await page.goto("/accounts");

  const row = page.locator('tr[data-login-id="admin"]');
  await expect(row.getByRole("button", { name: "admin 삭제" })).toBeDisabled();
  await expect(row.getByLabel("admin 등급")).toBeDisabled();
  await expect(row.getByRole("button", { name: "비활성화" })).toBeDisabled();
});

test("[17-1] 자기 계정 삭제·강등·비활성화를 API로 직접 호출해도 막힌다", async ({
  page,
}) => {
  await login(page, ADMIN);
  const me = await db.user.findUniqueOrThrow({
    where: { loginId: ADMIN.loginId },
  });

  // page.request 는 로그인 쿠키를 그대로 쓴다
  const del = await page.request.delete(`/api/accounts/${me.id}`);
  expect(del.status()).toBe(409);
  expect((await del.json()).error).toContain("자기 계정은 삭제할 수 없습니다");

  const demote = await page.request.patch(`/api/accounts/${me.id}`, {
    data: { role: "USER" },
  });
  expect(demote.status()).toBe(409);

  const off = await page.request.patch(`/api/accounts/${me.id}`, {
    data: { isActive: false },
  });
  expect(off.status()).toBe(409);

  const after = await db.user.findUniqueOrThrow({ where: { id: me.id } });
  expect(after.role).toBe("ADMIN");
  expect(after.isActive).toBe(true);
});

test("[16] 활성 어드민이 0명이 되는 조작은 막힌다", async ({ page }) => {
  // 활성 어드민을 admin 한 명으로 맞춘다
  await db.user.updateMany({
    where: { role: "ADMIN", loginId: { not: ADMIN.loginId } },
    data: { role: "USER" },
  });

  // 임시 어드민을 만들고 그 계정으로 로그인한 뒤,
  // DB에서 임시 어드민을 일반으로 내린다. (세션 토큰에는 아직 ADMIN 이 남아 있다)
  // → 이 상태에서 admin 을 지우면 활성 어드민이 0명이 되므로 반드시 막혀야 한다.
  await login(page, ADMIN);
  const created = await page.request.post("/api/accounts", {
    data: {
      loginId: "tempadmin",
      name: "임시어드민",
      role: "ADMIN",
      password: "TempAdmin!2026",
    },
  });
  expect(created.status()).toBe(201);

  await logout(page);
  await login(page, { loginId: "tempadmin", password: "TempAdmin!2026" });

  const temp = await db.user.findUniqueOrThrow({
    where: { loginId: "tempadmin" },
  });
  await db.user.update({ where: { id: temp.id }, data: { role: "USER" } });

  const admin = await db.user.findUniqueOrThrow({
    where: { loginId: ADMIN.loginId },
  });
  expect(await db.user.count({ where: { role: "ADMIN", isActive: true } })).toBe(
    1,
  );

  const del = await page.request.delete(`/api/accounts/${admin.id}`);
  expect(del.status()).toBe(409);
  expect((await del.json()).error).toContain("마지막 어드민");

  const demote = await page.request.patch(`/api/accounts/${admin.id}`, {
    data: { role: "USER" },
  });
  expect(demote.status()).toBe(409);

  const off = await page.request.patch(`/api/accounts/${admin.id}`, {
    data: { isActive: false },
  });
  expect(off.status()).toBe(409);

  // admin 계정이 그대로인지 확인
  const after = await db.user.findUniqueOrThrow({ where: { id: admin.id } });
  expect(after.role).toBe("ADMIN");
  expect(after.isActive).toBe(true);
});

test("[6] 일반 계정 세션으로 계정 관리 API를 직접 호출하면 403", async ({
  page,
}) => {
  await login(page, USER);

  const create = await page.request.post("/api/accounts", {
    data: {
      loginId: "hackacct",
      name: "몰래생성",
      role: "ADMIN",
      password: "Hack!2026",
    },
  });
  expect(create.status()).toBe(403);
  expect(await db.user.count({ where: { loginId: "hackacct" } })).toBe(0);

  const admin = await db.user.findUniqueOrThrow({
    where: { loginId: ADMIN.loginId },
  });

  const list = await page.request.get("/api/accounts");
  expect(list.status()).toBe(403);

  const patch = await page.request.patch(`/api/accounts/${admin.id}`, {
    data: { role: "USER" },
  });
  expect(patch.status()).toBe(403);

  const del = await page.request.delete(`/api/accounts/${admin.id}`);
  expect(del.status()).toBe(403);

  // 아무것도 바뀌지 않았는지 확인
  const after = await db.user.findUniqueOrThrow({ where: { id: admin.id } });
  expect(after.role).toBe("ADMIN");
});
