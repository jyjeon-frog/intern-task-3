import { expect, test } from "@playwright/test";

import { db } from "./db";
import { ADMIN, login } from "./helpers";

/**
 * 마무리 검증 — 다른 파일에서 다루지 않은 항목들
 *  8: 직접 입력한 데이터가 대시보드 숫자에도 즉시 반영되는지
 * 13: 대시보드 합계가 SQL 로 직접 센 값과 같은지
 * 19: 휴대폰 화면에서 모든 페이지가 깨지지 않는지
 */
const TAG = "[E2E-FINAL]";

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

test("[8-대시보드반영] 직접 입력한 데이터가 대시보드 숫자에 즉시 반영된다", async ({
  page,
}) => {
  await login(page, ADMIN);

  // 입력 전 대시보드 숫자
  await page.goto("/dashboard");
  const beforeText =
    (await page.getByTestId("card-order-count").textContent()) ?? "";
  const beforeCount = Number(beforeText.replace(/[^0-9]/g, ""));
  const beforeAmountText =
    (await page.getByTestId("card-total-amount").textContent()) ?? "";
  const beforeAmount = Number(beforeAmountText.replace(/[^0-9]/g, ""));

  // 직접 입력 (3 x 12,000 = 36,000)
  await page.goto("/data?tab=input");
  await page.getByLabel("주문일").fill("2026-07-15");
  await page.getByLabel("판매채널").selectOption("자사몰");
  await page.getByLabel("제품명").fill(`${TAG} 대시보드확인용`);
  await page.getByLabel("카테고리").selectOption("바디");
  await page.getByLabel("수량").fill("3");
  await page.getByLabel("단가 (원)").fill("12000");
  await page.getByRole("button", { name: "저장" }).click();
  await expect(page.getByText("판매 데이터를 저장했습니다.")).toBeVisible();

  // 대시보드 숫자가 그만큼 늘었다
  await page.goto("/dashboard");
  await expect(page.getByTestId("card-order-count")).toHaveText(
    `${(beforeCount + 1).toLocaleString("ko-KR")}건`,
  );
  await expect(page.getByTestId("card-total-amount")).toHaveText(
    `${(beforeAmount + 36000).toLocaleString("ko-KR")}원`,
  );

  // 최근 등록 10건 표 맨 위에도 나온다
  await expect(
    page.getByTestId("recent-records").locator("tbody tr").first(),
  ).toContainText(`${TAG} 대시보드확인용`);
});

test("[13-SQL] 대시보드 합계가 SQL 로 직접 센 값과 일치한다", async ({
  page,
}) => {
  await login(page, ADMIN);
  await page.goto("/dashboard");

  // Prisma 를 거치지 않고 SQL 로 직접 확인한다
  const rows = await db.$queryRaw<
    { total: bigint | null; cnt: bigint }[]
  >`SELECT SUM("amount")::bigint AS total, COUNT(*)::bigint AS cnt FROM "SalesRecord"`;
  const total = Number(rows[0].total ?? 0);
  const count = Number(rows[0].cnt);

  await expect(page.getByTestId("card-total-amount")).toHaveText(
    `${total.toLocaleString("ko-KR")}원`,
  );
  await expect(page.getByTestId("card-order-count")).toHaveText(
    `${count.toLocaleString("ko-KR")}건`,
  );
  await expect(page.getByTestId("card-aov")).toHaveText(
    `${Math.round(total / count).toLocaleString("ko-KR")}원`,
  );

  // 채널별 합계도 SQL 과 대조한다
  const channelRows = await db.$queryRaw<
    { channel: string; total: bigint }[]
  >`SELECT "channel", SUM("amount")::bigint AS total FROM "SalesRecord" GROUP BY "channel" ORDER BY total DESC LIMIT 1`;
  const top = channelRows[0];
  await page.goto(`/dashboard?channel=${encodeURIComponent(top.channel)}`);
  await expect(page.getByTestId("card-total-amount")).toHaveText(
    `${Number(top.total).toLocaleString("ko-KR")}원`,
  );
});

test("[19-전체] 휴대폰 화면(375px)에서 모든 페이지가 깨지지 않는다", async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 780 });
  await login(page, ADMIN);

  const pages = [
    "/dashboard",
    "/data?tab=input",
    "/data?tab=upload",
    "/data?tab=list",
    "/accounts",
  ];

  for (const path of pages) {
    await page.goto(path);
    await expect(
      page.getByRole("navigation", { name: "주 메뉴" }),
    ).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(overflow, `${path} 에서 가로 스크롤이 생김`).toBe(false);
  }
});

test("[오류표시] 서버 오류 화면에 내부 정보가 드러나지 않는다", async ({
  page,
}) => {
  await login(page, ADMIN);

  // 없는 데이터 삭제 시도 → 사용자용 한국어 메시지만
  const res = await page.request.delete("/api/sales/존재하지않는id");
  expect(res.status()).toBe(404);
  const body = await res.text();
  expect(body).toContain("데이터를 찾을 수 없습니다");
  expect(body).not.toMatch(/prisma|PrismaClient|stack|at .*\.ts:/i);

  // 잘못된 형식의 요청 → 안내만
  const bad = await page.request.post("/api/sales", {
    data: { orderDate: "말도안되는날짜", quantity: "많이" },
  });
  expect(bad.status()).toBe(400);
  const badBody = await bad.text();
  expect(badBody).not.toMatch(/prisma|stack|node_modules/i);
});
