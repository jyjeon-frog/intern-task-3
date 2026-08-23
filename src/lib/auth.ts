import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

import { authConfig } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validation";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  logger: {
    // 비밀번호가 틀린 건 정상적인 흐름이다. 서버 로그에 스택까지 남기지 않는다.
    error(error) {
      if (error.name === "CredentialsSignin") return;
      console.error(error.name, error.message);
    },
  },
  providers: [
    Credentials({
      credentials: {
        loginId: {},
        password: {},
      },
      /**
       * 실패 시에는 어떤 이유든 null 을 돌려준다.
       * (아이디가 없는지 / 비밀번호가 틀렸는지 / 비활성 계정인지를 알려주지 않기 위해서)
       * 화면에 보여줄 메시지는 항상 "아이디 또는 비밀번호가 올바르지 않습니다" 로 통일한다.
       */
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { loginId, password } = parsed.data;

        const user = await prisma.user.findUnique({ where: { loginId } });
        if (!user) return null;
        if (!user.isActive) return null; // 비활성 계정 로그인 차단

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          loginId: user.loginId,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
});
