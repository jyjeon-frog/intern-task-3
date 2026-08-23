"use server";

import { signOut } from "@/lib/auth";

// Edge 런타임을 지정하지 않으므로 Node.js 런타임에서 실행된다.

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}
