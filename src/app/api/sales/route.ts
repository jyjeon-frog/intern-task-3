import { NextResponse } from "next/server";

import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { toDateOnly } from "@/lib/sales";
import { requireAdminApi } from "@/lib/session";
import { deleteManySchema, salesRecordSchema } from "@/lib/validation";

// Prisma 사용 → Node.js 런타임 고정
export const runtime = "nodejs";

/** 판매 데이터 직접 입력 */
export async function POST(request: Request) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "요청 형식이 올바르지 않습니다." },
      { status: 400 },
    );
  }

  const parsed = salesRecordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "입력값을 확인해주세요.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const d = parsed.data;

  // 매출액은 화면에서 보낸 값을 믿지 않고 서버에서 다시 계산한다
  const amount = d.quantity * d.unitPrice;

  const created = await prisma.salesRecord.create({
    data: {
      orderDate: toDateOnly(d.orderDate),
      channel: d.channel,
      region: d.region,
      productName: d.productName,
      category: d.category,
      quantity: d.quantity,
      unitPrice: d.unitPrice,
      amount,
      customerType: d.customerType,
      sourceType: "MANUAL",
      createdById: guard.user.id,
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: created.id, amount }, { status: 201 });
}

/** 선택한 여러 건 삭제 */
export async function DELETE(request: Request) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "요청 형식이 올바르지 않습니다." },
      { status: 400 },
    );
  }

  const parsed = deleteManySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "요청이 올바르지 않습니다." },
      { status: 400 },
    );
  }

  const result = await prisma.salesRecord.deleteMany({
    where: { id: { in: parsed.data.ids } },
  });

  await writeAuditLog({
    actorId: guard.user.id,
    action: "SALES_DELETE_MANY",
    targetType: "SalesRecord",
    targetId: `${result.count}건`,
  });

  return NextResponse.json({ ok: true, deleted: result.count });
}
