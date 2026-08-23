import { prisma } from "@/lib/prisma";

/**
 * 관리 행위 기록.
 * 계정 추가/삭제/권한변경, 데이터 삭제처럼 되돌리기 어려운 작업을 남긴다.
 * 기록 실패가 본 작업을 막지 않도록 오류는 삼킨다.
 */
export async function writeAuditLog(params: {
  actorId: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: params.actorId,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId ?? null,
      },
    });
  } catch {
    // 감사 로그 실패로 본 작업을 되돌리지는 않는다
  }
}
