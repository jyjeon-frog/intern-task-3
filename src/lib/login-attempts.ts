import { prisma } from "@/lib/prisma";

/**
 * 로그인 시도 제한
 *
 * 서버리스(Vercel)에서는 인스턴스가 매 요청마다 달라질 수 있어서
 * 메모리 변수/Map 에 시도 횟수를 두면 동작하지 않는다.
 * 반드시 LoginAttempt 테이블에 기록하고 조회한다.
 */

export const MAX_FAILURES = 5;
export const LOCK_WINDOW_MS = 60 * 1000; // 1분

export type LockState = {
  locked: boolean;
  remainingSeconds: number;
};

/** 같은 아이디로 5회 연속 실패했고, 마지막 실패가 1분 이내면 잠금 */
export async function getLockState(loginId: string): Promise<LockState> {
  const recent = await prisma.loginAttempt.findMany({
    where: { loginId },
    orderBy: { attemptedAt: "desc" },
    take: MAX_FAILURES,
    select: { success: true, attemptedAt: true },
  });

  // 최근 5건이 모두 실패여야 잠금 대상 (중간에 성공이 있으면 연속 실패가 끊긴 것)
  if (recent.length < MAX_FAILURES || recent.some((a) => a.success)) {
    return { locked: false, remainingSeconds: 0 };
  }

  const elapsed = Date.now() - recent[0].attemptedAt.getTime();
  if (elapsed >= LOCK_WINDOW_MS) {
    return { locked: false, remainingSeconds: 0 };
  }

  return {
    locked: true,
    remainingSeconds: Math.max(1, Math.ceil((LOCK_WINDOW_MS - elapsed) / 1000)),
  };
}

export async function recordAttempt(loginId: string, success: boolean) {
  await prisma.loginAttempt.create({ data: { loginId, success } });
}
