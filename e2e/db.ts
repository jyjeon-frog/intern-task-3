import { PrismaClient } from "@prisma/client";

/** 테스트에서 DB 상태를 직접 확인·정리할 때 쓰는 연결 */
export const db = new PrismaClient();
