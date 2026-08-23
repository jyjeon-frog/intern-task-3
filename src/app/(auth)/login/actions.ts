"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

import { signIn } from "@/lib/auth";
import { getLockState, recordAttempt } from "@/lib/login-attempts";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validation";

// 이 서버 액션은 bcrypt / Prisma 를 쓴다.
// Next.js 서버 액션은 페이지와 같은 런타임에서 돌고, 이 프로젝트는 Edge 런타임을
// 어디에도 지정하지 않으므로 항상 Node.js 런타임에서 실행된다.

export type LoginState = {
  error?: string;
  fieldErrors?: { loginId?: string; password?: string };
};

/** 실패 이유를 구분해서 알려주지 않는다 (계정 존재 여부 노출 방지) */
const GENERIC_ERROR = "아이디 또는 비밀번호가 올바르지 않습니다.";

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  // 1) 서버에서 Zod로 검증
  const parsed = loginSchema.safeParse({
    loginId: formData.get("loginId"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const flat = parsed.error.flatten().fieldErrors;
    return {
      fieldErrors: {
        loginId: flat.loginId?.[0],
        password: flat.password?.[0],
      },
    };
  }

  const { loginId, password } = parsed.data;

  // 2) 잠금 상태 확인 (DB 기록 기준)
  const lock = await getLockState(loginId);
  if (lock.locked) {
    return {
      error: `로그인 시도가 5회 실패하여 잠겼습니다. ${lock.remainingSeconds}초 후에 다시 시도해주세요.`,
    };
  }

  // 3) 비밀번호 검증
  let success = false;
  try {
    await signIn("credentials", { loginId, password, redirect: false });
    success = true;
  } catch (error) {
    if (!(error instanceof AuthError)) throw error;
    success = false;
  }

  // 4) 시도 결과를 DB에 기록
  await recordAttempt(loginId, success);

  if (!success) {
    const after = await getLockState(loginId);
    if (after.locked) {
      return {
        error: `${GENERIC_ERROR} 5회 연속 실패하여 ${after.remainingSeconds}초간 로그인이 잠깁니다.`,
      };
    }
    return { error: GENERIC_ERROR };
  }

  await prisma.user.update({
    where: { loginId },
    data: { lastLoginAt: new Date() },
  });

  redirect("/dashboard");
}
