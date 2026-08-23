"use server";

import { redirect } from "next/navigation";

import { signOut } from "@/lib/auth";

// Edge 런타임을 지정하지 않으므로 Node.js 런타임에서 실행된다.

export async function logoutAction() {
  // signOut 의 redirectTo 는 NEXTAUTH_URL 을 기준으로 절대 주소를 만든다.
  // 그 값이 잘못 설정돼 있으면 엉뚱한 주소로 보내므로,
  // 세션만 지우고 이동은 Next 의 redirect 로 직접 처리한다.
  await signOut({ redirect: false });
  redirect("/login");
}
