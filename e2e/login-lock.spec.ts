import { expect, test } from "@playwright/test";
import bcrypt from "bcryptjs";

import { db } from "./db";
import { tryLogin } from "./helpers";

const LOCK_ID = "locktest";
const LOCK_PW = "Lock!2026";
const INACTIVE_ID = "inactivetest";
const INACTIVE_PW = "Inactive!2026";

test.describe.configure({ mode: "serial" });

test.beforeAll(async () => {
  await db.loginAttempt.deleteMany({
    where: { loginId: { in: [LOCK_ID, INACTIVE_ID] } },
  });
  await db.user.deleteMany({
    where: { loginId: { in: [LOCK_ID, INACTIVE_ID] } },
  });
  await db.user.create({
    data: {
      loginId: LOCK_ID,
      name: "잠금테스트",
      passwordHash: await bcrypt.hash(LOCK_PW, 12),
      role: "USER",
      isActive: true,
    },
  });
  await db.user.create({
    data: {
      loginId: INACTIVE_ID,
      name: "비활성테스트",
      passwordHash: await bcrypt.hash(INACTIVE_PW, 12),
      role: "USER",
      isActive: false, // 비활성 계정
    },
  });
});

test.afterAll(async () => {
  await db.loginAttempt.deleteMany({
    where: { loginId: { in: [LOCK_ID, INACTIVE_ID] } },
  });
  await db.user.deleteMany({
    where: { loginId: { in: [LOCK_ID, INACTIVE_ID] } },
  });
  await db.$disconnect();
});

test("[3] 비활성 계정으로는 로그인할 수 없다", async ({ page }) => {
  await tryLogin(page, INACTIVE_ID, INACTIVE_PW);
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "아이디 또는 비밀번호가 올바르지 않습니다",
  );
  await expect(page).toHaveURL(/\/login$/);
});

test("[2] 5회 연속 실패하면 잠기고, 1분이 지나면 풀린다", async ({ page }) => {
  // 1~4회 실패: 아직 잠기지 않는다
  for (let i = 1; i <= 4; i++) {
    await tryLogin(page, LOCK_ID, "틀린비밀번호");
    const alert = page.getByRole("main").getByRole("alert");
    await expect(alert).toContainText("아이디 또는 비밀번호가 올바르지 않습니다");
    await expect(alert).not.toContainText("잠깁니다");
  }

  // 5회째 실패: 잠김 안내가 나온다
  await tryLogin(page, LOCK_ID, "틀린비밀번호");
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "잠깁니다",
  );

  // 잠긴 동안에는 올바른 비밀번호로도 로그인되지 않는다
  await tryLogin(page, LOCK_ID, LOCK_PW);
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "초 후에 다시 시도해주세요",
  );
  await expect(page).toHaveURL(/\/login$/);

  // 잠금 기록을 1분 전으로 되돌려 "1분 경과" 상황을 만든다
  const attempts = await db.loginAttempt.findMany({
    where: { loginId: LOCK_ID },
  });
  for (const a of attempts) {
    await db.loginAttempt.update({
      where: { id: a.id },
      data: { attemptedAt: new Date(a.attemptedAt.getTime() - 61_000) },
    });
  }

  // 이제는 올바른 비밀번호로 로그인된다
  await tryLogin(page, LOCK_ID, LOCK_PW);
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("[기록] 로그인 시도가 DB(LoginAttempt)에 남는다", async () => {
  const attempts = await db.loginAttempt.findMany({
    where: { loginId: LOCK_ID },
    orderBy: { attemptedAt: "asc" },
  });
  const failed = attempts.filter((a) => !a.success).length;
  const ok = attempts.filter((a) => a.success).length;
  expect(failed).toBe(5); // 실패 5회 (잠긴 상태에서의 시도는 기록하지 않는다)
  expect(ok).toBe(1); // 마지막 성공 1회

  // 로그인 성공 시 lastLoginAt 이 기록된다
  const user = await db.user.findUnique({ where: { loginId: LOCK_ID } });
  expect(user?.lastLoginAt).not.toBeNull();
});
