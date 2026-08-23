import type { Role, User } from "@prisma/client";

import { formatDate, formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const BCRYPT_COST = 12;

/** 화면에 그대로 뿌릴 수 있는 형태 (날짜는 서버에서 문자열로 바꿔서 넘긴다) */
export type AccountRow = {
  id: string;
  loginId: string;
  name: string;
  role: Role;
  isActive: boolean;
  lastLoginAt: string;
  createdAt: string;
};

export async function listAccounts(): Promise<AccountRow[]> {
  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      loginId: true,
      name: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });

  return users.map((u) => ({
    ...u,
    lastLoginAt: formatDateTime(u.lastLoginAt),
    createdAt: formatDate(u.createdAt),
  }));
}

/** 활성 상태인 어드민 수 */
export function countActiveAdmins() {
  return prisma.user.count({ where: { role: "ADMIN", isActive: true } });
}

type Target = Pick<User, "id" | "role" | "isActive">;

/**
 * 계정 변경/삭제가 허용되는지 검사한다.
 * 막아야 하면 사용자에게 보여줄 한국어 사유를, 괜찮으면 null 을 돌려준다.
 *
 * 규칙
 *  - 어드민은 자기 계정을 삭제하거나, 자기 권한을 내리거나, 자기를 비활성화할 수 없다
 *  - 어떤 조작이든 결과적으로 활성 어드민이 0명이 되면 안 된다
 */
export async function checkAccountChange(
  actorId: string,
  target: Target,
  change: { delete?: true; role?: Role; isActive?: boolean },
): Promise<string | null> {
  const isSelf = actorId === target.id;

  if (isSelf) {
    if (change.delete) return "자기 계정은 삭제할 수 없습니다.";
    if (change.role === "USER")
      return "자기 계정의 권한은 일반으로 내릴 수 없습니다.";
    if (change.isActive === false)
      return "자기 계정은 비활성화할 수 없습니다.";
  }

  // 대상이 지금 "활성 어드민" 일 때만 어드민 수가 줄어들 수 있다
  const targetIsActiveAdmin = target.role === "ADMIN" && target.isActive;
  const losesAdmin =
    targetIsActiveAdmin &&
    (change.delete === true ||
      change.role === "USER" ||
      change.isActive === false);

  if (losesAdmin) {
    const activeAdmins = await countActiveAdmins();
    if (activeAdmins <= 1) {
      return "마지막 어드민 계정입니다. 다른 어드민을 먼저 만들어주세요.";
    }
  }

  return null;
}
