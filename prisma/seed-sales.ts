/**
 * 샘플 판매 데이터 넣기 (대시보드가 비어 보이지 않도록)
 * 실행: npm run db:seed:sales
 *
 * sample-data/ 안의 엑셀을 화면 업로드와 똑같은 파서로 읽어서 넣는다.
 * 이미 같은 파일명으로 올린 기록이 있으면 건너뛴다(여러 번 실행해도 안전).
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { PrismaClient } from "@prisma/client";

import { parseSalesWorkbook } from "@/lib/excel";

const prisma = new PrismaClient();

const FILES = [
  "sample_sales_data.xlsx",
  "sample_sales_data_202608.xlsx",
];

const CHUNK_SIZE = 500;

async function main() {
  const adminLoginId = process.env.INITIAL_ADMIN_ID ?? "admin";
  const admin = await prisma.user.findUnique({
    where: { loginId: adminLoginId },
  });
  if (!admin) {
    throw new Error(
      `어드민 계정(${adminLoginId})이 없습니다. 먼저 npm run db:seed 를 실행해주세요.`,
    );
  }

  for (const fileName of FILES) {
    const filePath = path.join(process.cwd(), "sample-data", fileName);

    const already = await prisma.uploadBatch.findFirst({ where: { fileName } });
    if (already) {
      console.log(`- 건너뜀 (이미 있음): ${fileName}`);
      continue;
    }

    let buffer: Buffer;
    try {
      buffer = readFileSync(filePath);
    } catch {
      console.log(`- 건너뜀 (파일 없음): ${fileName}`);
      continue;
    }

    const parsed = parseSalesWorkbook(
      buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength,
      ) as ArrayBuffer,
    );

    if (parsed.missingColumns.length > 0) {
      console.log(
        `- 건너뜀 (컬럼 없음: ${parsed.missingColumns.join(", ")}): ${fileName}`,
      );
      continue;
    }

    const failedRows = new Set(parsed.errors.map((e) => e.excelRow)).size;

    const batch = await prisma.uploadBatch.create({
      data: {
        fileName,
        totalRows: parsed.totalRows,
        successRows: parsed.validRows.length,
        failedRows,
        uploadedById: admin.id,
      },
      select: { id: true },
    });

    const records = parsed.validRows.map((row) => ({
      orderDate: new Date(`${row.data.orderDate}T00:00:00.000Z`),
      channel: row.data.channel,
      region: row.data.region,
      productName: row.data.productName,
      category: row.data.category,
      quantity: row.data.quantity,
      unitPrice: row.data.unitPrice,
      amount: row.amount,
      customerType: row.data.customerType,
      sourceType: "EXCEL" as const,
      uploadBatchId: batch.id,
      createdById: admin.id,
    }));

    for (let i = 0; i < records.length; i += CHUNK_SIZE) {
      await prisma.salesRecord.createMany({
        data: records.slice(i, i + CHUNK_SIZE),
      });
    }

    console.log(
      `- 넣음: ${fileName} (${parsed.validRows.length}건, 오류 ${failedRows}행)`,
    );
  }

  const total = await prisma.salesRecord.count();
  console.log(`완료. 현재 판매 데이터 ${total.toLocaleString()}건.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
