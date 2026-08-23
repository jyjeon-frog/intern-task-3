import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { BCRYPT_COST, listAccounts } from "@/lib/accounts";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/session";
import { createAccountSchema } from "@/lib/validation";

// bcrypt / Prisma 사용 → Node.js 런타임 고정
export const runtime = "nodejs";

/** 계정 목록 */
export async function GET() {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  return NextResponse.json({ accounts: await listAccounts() });
}

/** 계정 추가 */
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

  const parsed = createAccountSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "입력값을 확인해주세요.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const { loginId, name, role, password } = parsed.data;

  const duplicated = await prisma.user.findUnique({ where: { loginId } });
  if (duplicated) {
    return NextResponse.json(
      { error: "이미 사용 중인 아이디입니다.", fieldErrors: { loginId: ["이미 사용 중인 아이디입니다."] } },
      { status: 409 },
    );
  }

  const created = await prisma.user.create({
    data: {
      loginId,
      name,
      role,
      passwordHash: await bcrypt.hash(password, BCRYPT_COST),
      isActive: true,
    },
    select: { id: true, loginId: true },
  });

  await writeAuditLog({
    actorId: guard.user.id,
    action: "ACCOUNT_CREATE",
    targetType: "User",
    targetId: created.id,
  });

  return NextResponse.json({ ok: true, id: created.id }, { status: 201 });
}
