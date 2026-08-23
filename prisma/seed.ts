/**
 * 초기 계정 생성 스크립트
 * 실행: npm run db:seed
 * 여러 번 실행해도 안전합니다(있으면 그대로 두고, 없으면 만듭니다).
 */
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const BCRYPT_COST = 12;

async function ensureUser(
  loginId: string,
  name: string,
  plainPassword: string,
  role: Role,
) {
  const existing = await prisma.user.findUnique({ where: { loginId } });
  if (existing) {
    console.log(`- 이미 있음: ${loginId} (${existing.role})`);
    return existing;
  }
  const created = await prisma.user.create({
    data: {
      loginId,
      name,
      passwordHash: await bcrypt.hash(plainPassword, BCRYPT_COST),
      role,
      isActive: true,
    },
  });
  console.log(`- 생성됨: ${loginId} (${role})`);
  return created;
}

async function main() {
  const adminId = process.env.INITIAL_ADMIN_ID ?? "admin";
  const adminPw = process.env.INITIAL_ADMIN_PASSWORD;

  if (!adminPw) {
    throw new Error(
      "INITIAL_ADMIN_PASSWORD 환경변수가 없습니다. .env 파일을 확인하세요.",
    );
  }

  console.log("초기 계정을 준비합니다...");
  await ensureUser(adminId, "관리자", adminPw, Role.ADMIN);
  await ensureUser("user01", "일반사용자", "User!2026", Role.USER);
  console.log("완료.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
