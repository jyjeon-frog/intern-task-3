import { NextResponse } from "next/server";

import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/session";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/** 판매 데이터 한 건 삭제 */
export async function DELETE(_request: Request, { params }: Params) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const { id } = await params;

  const found = await prisma.salesRecord.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!found) {
    return NextResponse.json(
      { error: "데이터를 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  await prisma.salesRecord.delete({ where: { id } });

  await writeAuditLog({
    actorId: guard.user.id,
    action: "SALES_DELETE",
    targetType: "SalesRecord",
    targetId: id,
  });

  return NextResponse.json({ ok: true });
}
