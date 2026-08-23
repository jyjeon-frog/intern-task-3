import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, test } from "@playwright/test";
import * as XLSX from "xlsx";

import { db } from "./db";
import { ADMIN, USER, login } from "./helpers";

const FIXTURES = path.join(__dirname, "fixtures");
const SAMPLES = path.join(__dirname, "..", "sample-data");

const UPLOADED_FILE_NAMES = [
  "sample_sales_data_202608.xlsx",
  "errors.xlsx",
  "aliases.xlsx",
];

test.describe.configure({ mode: "serial" });

async function cleanup() {
  // 배치를 지우면 그 파일로 들어온 판매 데이터도 함께 지워진다 (Cascade)
  await db.uploadBatch.deleteMany({
    where: { fileName: { in: UPLOADED_FILE_NAMES } },
  });
}

test.beforeAll(cleanup);
test.afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

test("[9] 정상 엑셀 업로드 — 미리보기 건수가 맞고 저장 후 DB 건수가 일치한다", async ({
  page,
}) => {
  const before = await db.salesRecord.count();

  await login(page, ADMIN);
  await page.goto("/data?tab=upload");

  await page
    .getByLabel("엑셀 파일 선택")
    .setInputFiles(path.join(SAMPLES, "sample_sales_data_202608.xlsx"));

  // 미리보기: 57행 전부 정상
  await expect(page.getByTestId("preview-success")).toHaveText("57");
  await expect(page.getByTestId("preview-failed")).toHaveText("0");
  await expect(page.getByText("오류 없이 모두 읽었습니다.")).toBeVisible();

  // 앞 10행 미리보기
  await expect(
    page.getByText("미리보기 (정상 행 앞 10건)"),
  ).toBeVisible();

  // 아직 저장 전이므로 DB 는 그대로
  expect(await db.salesRecord.count()).toBe(before);

  await page.getByRole("button", { name: /이대로 저장/ }).click();
  await expect(page.getByText("57건을 저장했습니다.")).toBeVisible();

  // DB 건수 일치
  expect(await db.salesRecord.count()).toBe(before + 57);

  // 매출 합계도 파일과 일치한다 (수량 x 단가 재계산 결과)
  const batch = await db.uploadBatch.findFirstOrThrow({
    where: { fileName: "sample_sales_data_202608.xlsx" },
    orderBy: { createdAt: "desc" },
  });
  const agg = await db.salesRecord.aggregate({
    where: { uploadBatchId: batch.id },
    _sum: { amount: true },
    _count: true,
  });
  expect(agg._count).toBe(57);
  expect(agg._sum.amount).toBe(3_331_000);

  // 업로드 이력에 남는다
  await expect(
    page.locator(`tr[data-batch-id="${batch.id}"]`),
  ).toContainText("sample_sales_data_202608.xlsx");
  await expect(
    page.locator(`tr[data-batch-id="${batch.id}"]`),
  ).toContainText("관리자");
});

test("[9-1] 업로드한 데이터가 목록에서 '엑셀' 로 표시된다", async ({ page }) => {
  await login(page, ADMIN);
  await page.goto(
    "/data?tab=list&q=" + encodeURIComponent("VN 리프팅 마스크 5매"),
  );
  const first = page.locator("tbody tr").first();
  await expect(first).toContainText("엑셀");
});

test("[10] 오류가 섞인 엑셀 — 오류 행을 정확히 짚고 정상 행만 저장한다", async ({
  page,
}) => {
  const before = await db.salesRecord.count();

  await login(page, ADMIN);
  await page.goto("/data?tab=upload");
  await page
    .getByLabel("엑셀 파일 선택")
    .setInputFiles(path.join(FIXTURES, "errors.xlsx"));

  // 7행 중 정상 4 / 오류 3
  await expect(page.getByTestId("preview-success")).toHaveText("4");
  await expect(page.getByTestId("preview-failed")).toHaveText("3");

  // 몇 번째 행의 어떤 컬럼이 왜 문제인지 알려준다
  const errors = page.getByTestId("error-list");
  await expect(errors).toContainText("3행");
  await expect(errors).toContainText("수량이 숫자가 아닙니다.");
  await expect(errors).toContainText("두개");
  await expect(errors).toContainText("5행");
  await expect(errors).toContainText("날짜를 읽을 수 없습니다.");
  await expect(errors).toContainText("6행");
  await expect(errors).toContainText("카테고리가 목록에 없는 값입니다.");
  await expect(errors).toContainText("향수");

  await page.getByRole("button", { name: /이대로 저장/ }).click();
  await expect(
    page.getByText("4건을 저장했습니다. (오류 3행은 건너뜀)"),
  ).toBeVisible();

  expect(await db.salesRecord.count()).toBe(before + 4);

  const batch = await db.uploadBatch.findFirstOrThrow({
    where: { fileName: "errors.xlsx" },
    orderBy: { createdAt: "desc" },
  });
  expect(batch.totalRows).toBe(7);
  expect(batch.successRows).toBe(4);
  expect(batch.failedRows).toBe(3);

  // 오류 행은 저장되지 않았다
  expect(
    await db.salesRecord.count({
      where: { uploadBatchId: batch.id, productName: { contains: "퍼퓸" } },
    }),
  ).toBe(0);

  // 매출액이 비어 있던 행은 수량 x 단가로 채워졌다 (3 x 24000)
  const computed = await db.salesRecord.findFirstOrThrow({
    where: { uploadBatchId: batch.id, productName: { contains: "선크림" } },
  });
  expect(computed.amount).toBe(72000);
});

test("[11] 컬럼 이름이 조금 달라도 별칭으로 인식한다", async ({ page }) => {
  const before = await db.salesRecord.count();

  await login(page, ADMIN);
  await page.goto("/data?tab=upload");
  await page
    .getByLabel("엑셀 파일 선택")
    .setInputFiles(path.join(FIXTURES, "aliases.xlsx"));

  await expect(page.getByTestId("preview-success")).toHaveText("3");
  await expect(page.getByTestId("preview-failed")).toHaveText("0");

  await page.getByRole("button", { name: /이대로 저장/ }).click();
  await expect(page.getByText("3건을 저장했습니다.")).toBeVisible();

  expect(await db.salesRecord.count()).toBe(before + 3);

  const batch = await db.uploadBatch.findFirstOrThrow({
    where: { fileName: "aliases.xlsx" },
    orderBy: { createdAt: "desc" },
  });
  const rows = await db.salesRecord.findMany({
    where: { uploadBatchId: batch.id },
    orderBy: { orderDate: "asc" },
  });

  // 2026.06.02 / 2026/06/03 같은 날짜 표기도 읽는다
  expect(rows.map((r) => r.orderDate.toISOString().slice(0, 10))).toEqual([
    "2026-06-01",
    "2026-06-02",
    "2026-06-03",
  ]);
  // 금액이 비어 있던 행은 계산해서 채운다 (1 x 15000)
  expect(rows[1].amount).toBe(15000);
});

test("[10-1] 판매 데이터 형식이 아닌 파일은 안내 메시지를 보여준다", async ({
  page,
}) => {
  await login(page, ADMIN);
  await page.goto("/data?tab=upload");
  await page
    .getByLabel("엑셀 파일 선택")
    .setInputFiles(path.join(FIXTURES, "wrong-format.xlsx"));

  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "필요한 컬럼을 찾지 못했습니다",
  );
  await expect(
    page.getByRole("button", { name: /이대로 저장/ }),
  ).toHaveCount(0);
});

test("[양식] 양식 다운로드 — 헤더와 예시 1행이 든 엑셀이 받아진다", async ({
  page,
}) => {
  await login(page, ADMIN);
  await page.goto("/data?tab=upload");

  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "양식 다운로드" }).click(),
  ]);

  expect(download.suggestedFilename()).toBe("veranova-sales-template.xlsx");

  const filePath = await download.path();
  const workbook = XLSX.read(readFileSync(filePath!), { type: "buffer" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });

  expect(rows[0]).toEqual([
    "주문일",
    "판매채널",
    "지역",
    "제품명",
    "카테고리",
    "수량",
    "단가",
    "매출액",
    "고객유형",
  ]);
  expect(rows).toHaveLength(2); // 헤더 + 예시 1행
  expect(String(rows[1][3])).toContain("VN");
});

test("[배치삭제] 업로드 묶음 단위로 되돌린다", async ({ page }) => {
  const batch = await db.uploadBatch.findFirstOrThrow({
    where: { fileName: "aliases.xlsx" },
    orderBy: { createdAt: "desc" },
  });
  const before = await db.salesRecord.count();

  await login(page, ADMIN);
  await page.goto("/data?tab=upload");

  await page
    .getByRole("button", { name: "aliases.xlsx 업로드 되돌리기" })
    .click();
  await expect(page.getByText("이 업로드를 되돌릴까요?")).toBeVisible();
  await page.getByRole("button", { name: "삭제", exact: true }).click();

  await expect(page.getByText(/업로드 이력과 데이터 3건을 삭제했습니다/)).toBeVisible();

  expect(await db.salesRecord.count()).toBe(before - 3);
  expect(await db.uploadBatch.count({ where: { id: batch.id } })).toBe(0);
});

test("[7-1] 일반 계정 세션으로 업로드·양식·배치삭제 API를 직접 호출하면 403", async ({
  page,
}) => {
  const batch = await db.uploadBatch.findFirstOrThrow({
    where: { fileName: "errors.xlsx" },
    orderBy: { createdAt: "desc" },
  });
  const before = await db.salesRecord.count();

  await login(page, USER);

  const upload = await page.request.post("/api/sales/upload?commit=1", {
    multipart: {
      file: {
        name: "aliases.xlsx",
        mimeType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        buffer: readFileSync(path.join(FIXTURES, "aliases.xlsx")),
      },
    },
  });
  expect(upload.status()).toBe(403);

  const template = await page.request.get("/api/sales/template");
  expect(template.status()).toBe(403);

  const del = await page.request.delete(`/api/sales/batches/${batch.id}`);
  expect(del.status()).toBe(403);

  expect(await db.salesRecord.count()).toBe(before);
});
