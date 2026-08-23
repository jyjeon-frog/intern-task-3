import type { NextAuthConfig } from "next-auth";

/**
 * middleware(Edge 런타임)에서도 안전하게 불러쓸 수 있는 최소 설정.
 * 여기에는 Prisma, bcrypt 등 Node 전용 코드를 절대 넣지 않는다.
 * 실제 로그인 검증(Credentials Provider)은 src/lib/auth.ts 에 있다.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 8, // 8시간
  },
  trustHost: true,
  callbacks: {
    // 로그인 시 사용자 정보를 토큰에 담는다
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id as string;
        token.loginId = user.loginId;
        token.role = user.role;
        token.name = user.name;
      }
      return token;
    },
    // 토큰의 정보를 세션으로 옮긴다
    session({ session, token }) {
      session.user.id = token.uid;
      session.user.loginId = token.loginId;
      session.user.role = token.role;
      session.user.name = token.name ?? "";
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
