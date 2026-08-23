import { NextResponse } from "next/server";

import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/session";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/**
 * 업로드 묶음 단위 일괄 삭제 (실수로 올린 파일 되돌리기).
 * 스키마에서 SalesRecord 가 uploadBatch 에 Cascade 로 걸려 있어
 * 배치를 지우면 그 파일로 들어온 데이터도 함께 지워진다.
 */
export async function DELETE(_request: Request, { params }: Params) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const { id } = await params;

  const batch = await prisma.uploadBatch.findUnique({
    where: { id },
    select: { id: true, fileName: true, _count: { select: { records: true } } },
  });
  if (!batch) {
    return NextResponse.json(
      { error: "업로드 이력을 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  const deleted = batch._count.records;
  await prisma.uploadBatch.delete({ where: { id } });

  await writeAuditLog({
    actorId: guard.user.id,
    action: "SALES_DELETE_BATCH",
    targetType: "UploadBatch",
    targetId: id,
  });

  return NextResponse.json({ ok: true, deleted });
}
