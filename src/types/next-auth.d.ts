import type { Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    loginId: string;
    role: Role;
  }

  interface Session {
    user: {
      id: string;
      loginId: string;
      role: Role;
    } & DefaultSession["user"];
  }
}

// next-auth v5 의 JWT 타입은 @auth/core/jwt 에서 온다. 양쪽 모두 확장해 둔다.
declare module "next-auth/jwt" {
  interface JWT {
    uid: string;
    loginId: string;
    role: Role;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    uid: string;
    loginId: string;
    role: Role;
  }
}
