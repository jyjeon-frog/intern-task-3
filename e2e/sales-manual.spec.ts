import { expect, test } from "@playwright/test";

import { db } from "./db";
import { ADMIN, USER, login } from "./helpers";

/** 이 파일에서 만드는 데이터는 제품명 앞에 이 표시를 붙여 구분하고, 끝나면 지운다 */
const TAG = "[E2E]";

test.describe.configure({ mode: "serial" });

async function cleanup() {
  await db.salesRecord.deleteMany({
    where: { productName: { startsWith: TAG } },
  });
}

test.beforeAll(cleanup);
test.afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

test("[8] 어드민이 직접 입력하면 목록과 건수에 즉시 반영된다", async ({
  page,
}) => {
  const before = await db.salesRecord.count();

  await login(page, ADMIN);
  await page.goto("/data?tab=input");

  await page.getByLabel("주문일").fill("2026-06-15");
  await page.getByLabel("판매채널").selectOption("쿠팡");
  await page.getByLabel("제품명").fill(`${TAG} 하이드라 세럼`);
  await page.getByLabel("카테고리").selectOption("스킨케어");
  await page.getByLabel("수량").fill("3");
  await page.getByLabel("단가 (원)").fill("28000");
  await page.getByLabel("고객유형").selectOption("신규");

  // 매출액 자동 계산 (3 × 28,000 = 84,000)
  await expect(page.getByTestId("computed-amount")).toHaveText("84,000원");

  // 채널을 고르면 지역이 함께 맞춰진다
  await expect(page.getByLabel("지역")).toHaveValue("국내");

  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.getByText("판매 데이터를 저장했습니다.")).toBeVisible();

  // 상단 건수가 1 늘었다
  await expect(
    page.getByText(`등록된 판매 데이터 ${(before + 1).toLocaleString("ko-KR")}건`),
  ).toBeVisible();

  // 목록에도 보인다
  await page.goto("/data?tab=list");
  const row = page.locator("tr", { hasText: `${TAG} 하이드라 세럼` });
  await expect(row).toBeVisible();
  await expect(row).toContainText("2026-06-15");
  await expect(row).toContainText("84,000");
  await expect(row).toContainText("직접입력");
  await expect(row).toContainText("관리자");

  // DB 에도 매출액이 서버에서 계산된 값으로 저장됐다
  const saved = await db.salesRecord.findFirstOrThrow({
    where: { productName: `${TAG} 하이드라 세럼` },
  });
  expect(saved.amount).toBe(84000);
  expect(saved.sourceType).toBe("MANUAL");
});

test("[8-1] 매출액은 화면에서 조작해도 서버가 다시 계산한다", async ({
  page,
}) => {
  await login(page, ADMIN);

  // 매출액을 엉뚱하게 보내도 수량 × 단가로 저장돼야 한다
  const res = await page.request.post("/api/sales", {
    data: {
      orderDate: "2026-06-16",
      channel: "자사몰",
      region: "국내",
      productName: `${TAG} 매출액조작`,
      category: "클렌징",
      quantity: 2,
      unitPrice: 15000,
      amount: 999999999,
      customerType: "재구매",
    },
  });
  expect(res.status()).toBe(201);

  const saved = await db.salesRecord.findFirstOrThrow({
    where: { productName: `${TAG} 매출액조작` },
  });
  expect(saved.amount).toBe(30000);
});

test("[8-2] 잘못된 입력은 항목별 오류로 막힌다", async ({ page }) => {
  await login(page, ADMIN);
  await page.goto("/data?tab=input");

  await page.getByLabel("제품명").fill("");
  await page.getByLabel("수량").fill("0");
  await page.getByRole("button", { name: "저장" }).click();

  await expect(page.getByText("제품명을 입력해주세요.")).toBeVisible();
  await expect(page.getByText("수량은 1 이상이어야 합니다.")).toBeVisible();
});

test("[8-3] 목록 검색·필터·정렬·페이지 이동", async ({ page }) => {
  // 검색용 데이터를 준비한다
  const admin = await db.user.findUniqueOrThrow({
    where: { loginId: ADMIN.loginId },
  });
  await db.salesRecord.createMany({
    data: [
      {
        orderDate: new Date("2026-01-05T00:00:00Z"),
        channel: "무신사",
        region: "국내",
        productName: `${TAG} 검색용 선크림`,
        category: "선케어",
        quantity: 1,
        unitPrice: 10000,
        amount: 10000,
        customerType: "신규",
        sourceType: "MANUAL",
        createdById: admin.id,
      },
      {
        orderDate: new Date("2026-01-06T00:00:00Z"),
        channel: "Amazon US",
        region: "미국",
        productName: `${TAG} 검색용 마스크`,
        category: "마스크",
        quantity: 5,
        unitPrice: 20000,
        amount: 100000,
        customerType: "재구매",
        sourceType: "MANUAL",
        createdById: admin.id,
      },
    ],
  });

  await login(page, ADMIN);
  await page.goto("/data?tab=list");

  // 제품명 검색
  await page.getByLabel("제품명 검색").fill("검색용 선크림");
  await page.getByRole("button", { name: "조회" }).click();
  await expect(page).toHaveURL(/q=/);
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody tr").first()).toContainText("선크림");

  // 초기화하면 조건이 주소에서 사라진다
  await page.getByRole("button", { name: "초기화" }).click();
  await expect(page).not.toHaveURL(/q=/);

  // 채널 필터
  await page.goto("/data?tab=list");
  await page.getByLabel("판매채널").selectOption("Amazon US");
  await page.getByRole("button", { name: "조회" }).click();
  await expect(page).toHaveURL(/channel=Amazon/);
  const channelRows = page.locator("tbody tr");
  await expect(channelRows.first()).toContainText("Amazon US");
  for (const text of await channelRows.allTextContents()) {
    expect(text).toContain("Amazon US");
  }

  // 기간 필터 + 매출액 정렬 (URL 에 상태가 남는지도 확인)
  await page.goto("/data?tab=list");
  await page.getByLabel("시작일").fill("2026-01-01");
  await page.getByLabel("종료일").fill("2026-01-31");
  await page.getByRole("button", { name: "조회" }).click();
  await expect(page).toHaveURL(/from=2026-01-01/);
  await expect(page).toHaveURL(/to=2026-01-31/);
  await expect(page.locator("tbody tr")).toHaveCount(2);

  await page.getByRole("button", { name: "매출액" }).click();
  await expect(page).toHaveURL(/sort=amount/);
  await expect(page.locator("tbody tr").first()).toContainText("마스크");

  await page.getByRole("button", { name: "매출액" }).click();
  await expect(page).toHaveURL(/dir=asc/);
  await expect(page.locator("tbody tr").first()).toContainText("선크림");
});

test("[8-4] 개별 삭제와 다중 삭제", async ({ page }) => {
  await login(page, ADMIN);
  await page.goto("/data?tab=list&q=" + encodeURIComponent("검색용"));

  // 개별 삭제
  await page
    .getByRole("button", { name: `${TAG} 검색용 선크림 삭제` })
    .click();
  await expect(page.getByText("데이터를 삭제할까요?")).toBeVisible();
  await page.getByRole("button", { name: "삭제", exact: true }).click();
  await expect(page.getByText("1건을 삭제했습니다.")).toBeVisible();

  expect(
    await db.salesRecord.count({
      where: { productName: `${TAG} 검색용 선크림` },
    }),
  ).toBe(0);

  // 다중 삭제 (남은 E2E 데이터 전부)
  await page.goto("/data?tab=list&q=" + encodeURIComponent(TAG));
  await page.getByLabel("전체 선택").click();
  await expect(page.getByText(/건 선택됨/)).toBeVisible();
  await page.getByRole("button", { name: "선택 삭제" }).click();
  await page.getByRole("button", { name: "삭제", exact: true }).click();
  await expect(page.getByText(/건을 삭제했습니다\./)).toBeVisible();

  expect(
    await db.salesRecord.count({
      where: { productName: { startsWith: TAG } },
    }),
  ).toBe(0);
});

test("[7] 일반 계정 세션으로 데이터 등록·삭제 API를 직접 호출하면 403", async ({
  page,
}) => {
  // 어드민으로 데이터 한 건 만들어 둔다
  const admin = await db.user.findUniqueOrThrow({
    where: { loginId: ADMIN.loginId },
  });
  const record = await db.salesRecord.create({
    data: {
      orderDate: new Date("2026-02-01T00:00:00Z"),
      channel: "자사몰",
      region: "국내",
      productName: `${TAG} 권한테스트`,
      category: "바디",
      quantity: 1,
      unitPrice: 1000,
      amount: 1000,
      customerType: "신규",
      sourceType: "MANUAL",
      createdById: admin.id,
    },
  });

  await login(page, USER);

  const create = await page.request.post("/api/sales", {
    data: {
      orderDate: "2026-02-02",
      channel: "쿠팡",
      region: "국내",
      productName: `${TAG} 몰래등록`,
      category: "스킨케어",
      quantity: 1,
      unitPrice: 1000,
      customerType: "신규",
    },
  });
  expect(create.status()).toBe(403);

  const delOne = await page.request.delete(`/api/sales/${record.id}`);
  expect(delOne.status()).toBe(403);

  const delMany = await page.request.delete("/api/sales", {
    data: { ids: [record.id] },
  });
  expect(delMany.status()).toBe(403);

  // 실제로 아무것도 바뀌지 않았다
  expect(
    await db.salesRecord.count({ where: { productName: `${TAG} 몰래등록` } }),
  ).toBe(0);
  expect(await db.salesRecord.count({ where: { id: record.id } })).toBe(1);
});

test("[4-1] 일반 계정은 /data 화면 자체가 403", async ({ page }) => {
  await login(page, USER);
  const res = await page.goto("/data?tab=input");
  expect(res?.status()).toBe(403);
});
