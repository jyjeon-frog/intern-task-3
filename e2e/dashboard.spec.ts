import { expect, test } from "@playwright/test";

import { db } from "./db";
import { ADMIN, USER, login } from "./helpers";

/**
 * 대시보드 검증.
 * 다른 데이터와 섞이지 않도록 2020년 1월(실데이터가 없는 기간)에
 * 값을 아는 4건을 넣고, 기간 필터로 그 4건만 보이게 해서 확인한다.
 */
const TAG = "[E2E-DASH]";
const FROM = "2020-01-01";
const TO = "2020-01-31";

/** 넣을 데이터: 합계 77,000원 / 4건 / AOV 19,250원 */
const FIXTURE = [
  {
    orderDate: "2020-01-05",
    channel: "쿠팡",
    region: "국내",
    productName: `${TAG} 세럼`,
    category: "스킨케어",
    quantity: 2,
    unitPrice: 10000,
    customerType: "신규",
  },
  {
    orderDate: "2020-01-06",
    channel: "쿠팡",
    region: "국내",
    productName: `${TAG} 세럼`,
    category: "스킨케어",
    quantity: 1,
    unitPrice: 10000,
    customerType: "재구매",
  },
  {
    orderDate: "2020-01-07",
    channel: "자사몰",
    region: "국내",
    productName: `${TAG} 마스크팩`,
    category: "마스크",
    quantity: 3,
    unitPrice: 5000,
    customerType: "신규",
  },
  {
    orderDate: "2020-01-08",
    channel: "Amazon US",
    region: "미국",
    productName: `${TAG} 클렌저`,
    category: "클렌징",
    quantity: 1,
    unitPrice: 32000,
    customerType: "재구매",
  },
];

const won = (n: number) => `${n.toLocaleString("ko-KR")}원`;

test.describe.configure({ mode: "serial" });

async function cleanup() {
  await db.salesRecord.deleteMany({
    where: { productName: { startsWith: TAG } },
  });
}

test.beforeAll(async () => {
  await cleanup();
  const admin = await db.user.findUniqueOrThrow({
    where: { loginId: ADMIN.loginId },
  });
  await db.salesRecord.createMany({
    data: FIXTURE.map((row) => ({
      ...row,
      orderDate: new Date(`${row.orderDate}T00:00:00.000Z`),
      amount: row.quantity * row.unitPrice,
      sourceType: "MANUAL" as const,
      createdById: admin.id,
    })),
  });
});

test.afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

test("[8-대시보드] 요약 카드 4개 · 그래프 4개 · 표 2개가 모두 보인다", async ({
  page,
}) => {
  await login(page, ADMIN);
  await page.goto(`/dashboard?from=${FROM}&to=${TO}`);

  // 요약 카드 4개
  await expect(page.getByTestId("card-total-amount")).toHaveText(won(77000));
  await expect(page.getByTestId("card-order-count")).toHaveText("4건");
  await expect(page.getByTestId("card-aov")).toHaveText(won(19250));
  await expect(page.getByTestId("card-total-records")).toBeVisible();

  // 그래프 4개
  for (const title of [
    "일별 매출 추이",
    "채널별 매출",
    "카테고리별 매출 비중",
    "신규 vs 재구매 비중",
  ]) {
    await expect(page.getByText(title, { exact: true })).toBeVisible();
  }
  // Recharts 가 실제로 그려졌는지 (svg 4개)
  await expect(page.locator(".recharts-surface")).toHaveCount(4);

  // 표 2개
  await expect(page.getByTestId("top-products")).toBeVisible();
  await expect(page.getByTestId("recent-records")).toBeVisible();
});

test("[13] 대시보드 합계가 DB 실제 합계와 일치한다", async ({ page }) => {
  await login(page, ADMIN);

  // 필터 없는 전체 화면
  await page.goto("/dashboard");
  const all = await db.salesRecord.aggregate({
    _sum: { amount: true },
    _count: { _all: true },
  });
  const total = all._sum.amount ?? 0;
  const count = all._count._all;

  await expect(page.getByTestId("card-total-amount")).toHaveText(won(total));
  await expect(page.getByTestId("card-order-count")).toHaveText(
    `${count.toLocaleString("ko-KR")}건`,
  );
  await expect(page.getByTestId("card-aov")).toHaveText(
    won(count > 0 ? Math.round(total / count) : 0),
  );

  // 기간을 좁혔을 때도 DB 집계와 같은지
  await page.goto(`/dashboard?from=${FROM}&to=${TO}`);
  const ranged = await db.salesRecord.aggregate({
    where: {
      orderDate: {
        gte: new Date(`${FROM}T00:00:00.000Z`),
        lte: new Date(`${TO}T00:00:00.000Z`),
      },
    },
    _sum: { amount: true },
    _count: { _all: true },
  });
  await expect(page.getByTestId("card-total-amount")).toHaveText(
    won(ranged._sum.amount ?? 0),
  );
  await expect(page.getByTestId("card-order-count")).toHaveText(
    `${ranged._count._all}건`,
  );
});

test("[12] 필터를 바꾸면 카드·그래프·표가 함께 바뀐다", async ({ page }) => {
  await login(page, ADMIN);
  await page.goto(`/dashboard?from=${FROM}&to=${TO}`);

  // 필터 전: 4건 / 77,000원, TOP1 은 클렌저, 카테고리 3종
  await expect(page.getByTestId("card-order-count")).toHaveText("4건");
  const topRows = page.getByTestId("top-products").locator("tbody tr");
  await expect(topRows).toHaveCount(3);
  await expect(topRows.first()).toContainText(`${TAG} 클렌저`);
  await expect(topRows.first()).toContainText("41.6%");
  await expect(page.getByTestId("recent-records").locator("tbody tr")).toHaveCount(4);

  // 비중 그래프도 조건에 맞게 3종
  await expect(
    page.getByTestId("category-share").locator("li"),
  ).toHaveCount(3);
  await expect(page.getByTestId("customer-share")).toContainText("신규");

  // 채널 필터: 쿠팡 → 2건 / 30,000원
  await page.getByLabel("판매채널").selectOption("쿠팡");
  await page.getByRole("button", { name: "적용" }).click();
  await expect(page).toHaveURL(/channel=%EC%BF%A0%ED%8C%A1/);

  await expect(page.getByTestId("card-total-amount")).toHaveText(won(30000));
  await expect(page.getByTestId("card-order-count")).toHaveText("2건");
  await expect(page.getByTestId("card-aov")).toHaveText(won(15000));

  // 표도 함께 바뀐다
  await expect(topRows).toHaveCount(1);
  await expect(topRows.first()).toContainText(`${TAG} 세럼`);
  await expect(topRows.first()).toContainText("100.0%");
  await expect(
    page.getByTestId("recent-records").locator("tbody tr"),
  ).toHaveCount(2);

  // 그래프(비중 목록)도 함께 바뀐다 — 스킨케어만 남는다
  const categoryShare = page.getByTestId("category-share");
  await expect(categoryShare.locator("li")).toHaveCount(1);
  await expect(categoryShare).toContainText("스킨케어");
  await expect(categoryShare).toContainText("100.0%");

  // 카테고리 필터를 겹쳐도 반영된다 → 쿠팡 + 마스크 = 0건
  await page.getByLabel("카테고리").selectOption("마스크");
  await page.getByRole("button", { name: "적용" }).click();
  await expect(
    page.getByText("조건에 맞는 데이터가 없습니다.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByTestId("card-order-count")).toHaveText("0건");

  // 초기화하면 조건이 사라진다
  await page.getByRole("button", { name: "초기화" }).click();
  await expect(page).not.toHaveURL(/channel=/);
  await expect(page).not.toHaveURL(/from=/);
});

test("[12-1] 필터 상태가 주소에 남아 새로고침해도 유지된다", async ({
  page,
}) => {
  await login(page, ADMIN);
  await page.goto(
    `/dashboard?from=${FROM}&to=${TO}&channel=${encodeURIComponent("쿠팡")}`,
  );
  await expect(page.getByTestId("card-order-count")).toHaveText("2건");

  await page.reload();
  await expect(page.getByTestId("card-order-count")).toHaveText("2건");
  await expect(page.getByLabel("판매채널")).toHaveValue("쿠팡");
  await expect(page.getByLabel("시작일")).toHaveValue(FROM);
});

test("[6-1] 일반 계정도 대시보드는 볼 수 있다", async ({ page }) => {
  await login(page, USER);
  const res = await page.goto(`/dashboard?from=${FROM}&to=${TO}`);
  expect(res?.status()).toBe(200);
  await expect(page.getByTestId("card-total-amount")).toHaveText(won(77000));
  await expect(page.locator(".recharts-surface")).toHaveCount(4);
});

test("[19-1] 휴대폰 화면(375px)에서 대시보드가 깨지지 않는다", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await login(page, ADMIN);
  await page.goto(`/dashboard?from=${FROM}&to=${TO}`);

  await expect(page.getByTestId("card-total-amount")).toBeVisible();
  await expect(page.locator(".recharts-surface").first()).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(overflow).toBe(false);
});
