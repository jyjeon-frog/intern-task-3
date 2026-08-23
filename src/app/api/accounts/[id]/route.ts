import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { BCRYPT_COST, checkAccountChange } from "@/lib/accounts";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/session";
import { updateAccountSchema } from "@/lib/validation";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/** 권한 변경 / 활성 전환 / 비밀번호 초기화 */
export async function PATCH(request: Request, { params }: Params) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "요청 형식이 올바르지 않습니다." },
      { status: 400 },
    );
  }

  const parsed = updateAccountSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "입력값을 확인해주세요." },
      { status: 400 },
    );
  }

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, isActive: true },
  });
  if (!target) {
    return NextResponse.json(
      { error: "계정을 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  const { role, isActive, password } = parsed.data;

  const blocked = await checkAccountChange(guard.user.id, target, {
    role,
    isActive,
  });
  if (blocked) {
    return NextResponse.json({ error: blocked }, { status: 409 });
  }

  if (password !== undefined) {
    await prisma.user.update({
      where: { id },
      data: { passwordHash: await bcrypt.hash(password, BCRYPT_COST) },
    });
    await writeAuditLog({
      actorId: guard.user.id,
      action: "ACCOUNT_RESET_PASSWORD",
      targetType: "User",
      targetId: id,
    });
    return NextResponse.json({ ok: true });
  }

  await prisma.user.update({
    where: { id },
    data: { ...(role !== undefined ? { role } : {}), ...(isActive !== undefined ? { isActive } : {}) },
  });

  await writeAuditLog({
    actorId: guard.user.id,
    action: role !== undefined ? "ACCOUNT_CHANGE_ROLE" : "ACCOUNT_TOGGLE_ACTIVE",
    targetType: "User",
    targetId: id,
  });

  return NextResponse.json({ ok: true });
}

/** 계정 삭제 */
export async function DELETE(_request: Request, { params }: Params) {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const { id } = await params;

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, isActive: true },
  });
  if (!target) {
    return NextResponse.json(
      { error: "계정을 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  const blocked = await checkAccountChange(guard.user.id, target, {
    delete: true,
  });
  if (blocked) {
    return NextResponse.json({ error: blocked }, { status: 409 });
  }

  // 이 계정이 등록한 판매 데이터는 남기고 등록자만 비운다 (스키마의 onDelete: SetNull)
  await prisma.user.delete({ where: { id } });

  await writeAuditLog({
    actorId: guard.user.id,
    action: "ACCOUNT_DELETE",
    targetType: "User",
    targetId: id,
  });

  return NextResponse.json({ ok: true });
}
