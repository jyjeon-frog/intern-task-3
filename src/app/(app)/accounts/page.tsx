import type { Metadata } from "next";

import { listAccounts } from "@/lib/accounts";
import { requireAdmin } from "@/lib/session";
import { AccountsClient } from "./accounts-client";

export const metadata: Metadata = {
  title: "계정 관리 · VeraNova 판매 데이터 관리",
};

export default async function AccountsPage() {
  // 어드민이 아니면 여기서 403
  const me = await requireAdmin();
  const accounts = await listAccounts();

  return <AccountsClient accounts={accounts} currentUserId={me.id} />;
}
