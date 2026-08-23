import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";

dotenv.config();

/**
 * 테스트를 돌리기 전에 기준 계정을 항상 같은 상태로 되돌린다.
 * (비밀번호 초기화·비활성화·잠금 테스트가 다음 실행에 영향을 주지 않게 하기 위해서)
 */
const BASE_ACCOUNTS = [
  {
    loginId: "admin",
    name: "관리자",
    password: "Admin!2026",
    role: "ADMIN" as const,
  },
  {
    loginId: "user01",
    name: "일반사용자",
    password: "User!2026",
    role: "USER" as const,
  },
];

export default async function globalSetup() {
  const db = new PrismaClient();
  try {
    for (const account of BASE_ACCOUNTS) {
      const passwordHash = await bcrypt.hash(account.password, 12);
      await db.user.upsert({
        where: { loginId: account.loginId },
        update: {
          name: account.name,
          passwordHash,
          role: account.role,
          isActive: true,
        },
        create: {
          loginId: account.loginId,
          name: account.name,
          passwordHash,
          role: account.role,
          isActive: true,
        },
      });
      await db.loginAttempt.deleteMany({
        where: { loginId: account.loginId },
      });
    }
    console.log("[테스트 준비] 기준 계정 admin / user01 복구 완료");
  } finally {
    await db.$disconnect();
  }
}
