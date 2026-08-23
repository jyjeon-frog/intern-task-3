import { PrismaClient } from "@prisma/client";

// 서버리스(Vercel)에서는 요청마다 모듈이 다시 평가될 수 있다.
// globalThis에 한 번만 만들어 재사용해야 DB 커넥션이 폭증하지 않는다.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
