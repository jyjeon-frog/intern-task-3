import { NextResponse } from "next/server";

import { writeAuditLog } from "@/lib/audit";
import { parseSalesWorkbook } from "@/lib/excel";
import { prisma } from "@/lib/prisma";
import { toDateOnly } from "@/lib/sales";
import { requireAdminApi } from "@/lib/session";

// SheetJS / Prisma 사용 → Node.js 런타임 고정
export const runtime = "nodejs";

/** Vercel 요청 본문 한도(약 4.5MB) */
const MAX_BYTES = 4 * 1024 * 1024;
const CHUNK_SIZE = 500;
const PREVIEW_ROWS = 10;
const MAX_ERRORS_SHOWN = 100;

export async function POST(request: Request) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const commit = new URL(request.url).searchParams.get("commit") === "1";

  const declaredSize = Number(request.headers.get("content-length") ?? 0);
  if (declaredSize > MAX_BYTES) {
    return NextResponse.json(
      {
        error:
          "파일이 너무 큽니다(4MB 초과). 파일을 나눠 올려주세요.",
      },
      { status: 413 },
    );
  }

  let file: File | null = null;
  try {
    const form = await request.formData();
    const value = form.get("file");
    if (value instanceof File) file = value;
  } catch {
    return NextResponse.json(
      { error: "파일을 읽지 못했습니다. 다시 시도해주세요." },
      { status: 400 },
    );
  }

  if (!file) {
    return NextResponse.json(
      { error: "엑셀 파일을 선택해주세요." },
      { status: 400 },
    );
  }

  if (!/\.(xlsx|xls)$/i.test(file.name)) {
    return NextResponse.json(
      { error: "엑셀 파일(.xlsx, .xls)만 올릴 수 있습니다." },
      { status: 400 },
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "파일이 너무 큽니다(4MB 초과). 파일을 나눠 올려주세요." },
      { status: 413 },
    );
  }

  // 디스크에 저장하지 않고 메모리에서만 처리한다 (Vercel은 파일 쓰기 불가)
  const buffer = await file.arrayBuffer();

  let parsed;
  try {
    parsed = parseSalesWorkbook(buffer);
  } catch {
    return NextResponse.json(
      { error: "엑셀 파일을 읽지 못했습니다. 파일이 손상되었을 수 있습니다." },
      { status: 400 },
    );
  }

  if (parsed.missingColumns.length > 0) {
    return NextResponse.json(
      {
        error: `필요한 컬럼을 찾지 못했습니다: ${parsed.missingColumns.join(", ")}. 양식 다운로드를 받아 확인해주세요.`,
      },
      { status: 400 },
    );
  }

  if (parsed.totalRows === 0) {
    return NextResponse.json(
      { error: "읽을 수 있는 데이터 행이 없습니다." },
      { status: 400 },
    );
  }

  const errorRowNumbers = new Set(parsed.errors.map((e) => e.excelRow));

  const summary = {
    fileName: file.name,
    sheetName: parsed.sheetName,
    totalRows: parsed.totalRows,
    successRows: parsed.validRows.length,
    failedRows: errorRowNumbers.size,
  };

  /* ---------------- 미리보기 ---------------- */
  if (!commit) {
    return NextResponse.json({
      ...summary,
      preview: parsed.validRows.slice(0, PREVIEW_ROWS).map((r) => ({
        excelRow: r.excelRow,
        ...r.data,
        amount: r.amount,
      })),
      errors: parsed.errors.slice(0, MAX_ERRORS_SHOWN),
      errorsTruncated: parsed.errors.length > MAX_ERRORS_SHOWN,
    });
  }

  /* ---------------- 저장 ---------------- */
  if (parsed.validRows.length === 0) {
    return NextResponse.json(
      { error: "저장할 수 있는 정상 행이 없습니다." },
      { status: 400 },
    );
  }

  const batch = await prisma.uploadBatch.create({
    data: {
      fileName: summary.fileName,
      totalRows: summary.totalRows,
      successRows: summary.successRows,
      failedRows: summary.failedRows,
      uploadedById: guard.user.id,
    },
    select: { id: true },
  });

  const records = parsed.validRows.map((r) => ({
    orderDate: toDateOnly(r.data.orderDate),
    channel: r.data.channel,
    region: r.data.region,
    productName: r.data.productName,
    category: r.data.category,
    quantity: r.data.quantity,
    unitPrice: r.data.unitPrice,
    amount: r.amount,
    customerType: r.data.customerType,
    sourceType: "EXCEL" as const,
    uploadBatchId: batch.id,
    createdById: guard.user.id,
  }));

  let inserted = 0;
  for (let i = 0; i < records.length; i += CHUNK_SIZE) {
    const chunk = records.slice(i, i + CHUNK_SIZE);
    const result = await prisma.salesRecord.createMany({ data: chunk });
    inserted += result.count;
  }

  await writeAuditLog({
    actorId: guard.user.id,
    action: "SALES_UPLOAD",
    targetType: "UploadBatch",
    targetId: batch.id,
  });

  return NextResponse.json({
    ...summary,
    ok: true,
    batchId: batch.id,
    inserted,
  });
}
