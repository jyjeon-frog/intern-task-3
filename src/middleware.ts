import NextAuth from "next-auth";
import { NextResponse } from "next/server";

import { authConfig } from "@/lib/auth.config";

/**
 * 전역 접근 차단.
 * 로그인하지 않은 사람이 어떤 주소로 들어와도 /login 으로 보낸다.
 *
 * 여기서는 세션 쿠키(JWT)만 확인한다. 등급(ADMIN/USER)별 차단은
 * 각 페이지와 API 라우트에서 다시 검사한다. (권한 검사는 서버에서 3중으로)
 */
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;

  // Auth.js 내부 엔드포인트는 통과
  if (pathname.startsWith("/api/auth")) return NextResponse.next();

  if (!isLoggedIn) {
    // API는 리다이렉트 대신 401 JSON
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 },
      );
    }
    if (pathname === "/login") return NextResponse.next();
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  // 이미 로그인한 사람이 로그인 화면에 오면 대시보드로
  if (pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  // 정적 파일과 이미지 최적화 경로만 제외하고 전부 검사
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
