import { forbidden, redirect } from "next/navigation";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";

export type SessionUser = {
  id: string;
  loginId: string;
  name: string;
  role: "ADMIN" | "USER";
};

/** 페이지용: 로그인 안 했으면 /login 으로 보낸다 */
export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return session.user as SessionUser;
}

/** 페이지용: 어드민이 아니면 403 화면 (실제 HTTP 403 응답) */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") forbidden();
  return user;
}

/**
 * API 라우트용: 어드민이 아니면 JSON 403을 돌려준다.
 * 화면을 우회해 API를 직접 호출해도 막히도록 모든 관리용 API 첫 줄에서 호출한다.
 */
export async function requireAdminApi(): Promise<
  { ok: true; user: SessionUser } | { ok: false; response: NextResponse }
> {
  const session = await auth();
  if (!session?.user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 },
      ),
    };
  }
  if (session.user.role !== "ADMIN") {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "접근 권한이 없습니다." },
        { status: 403 },
      ),
    };
  }
  return { ok: true, user: session.user as SessionUser };
}
