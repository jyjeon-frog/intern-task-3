import type { Metadata } from "next";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = {
  title: "계정 관리 · VeraNova 판매 데이터 관리",
};

export default async function AccountsPage() {
  // 어드민이 아니면 여기서 403
  await requireAdmin();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">계정 관리</h1>
      <Card>
        <CardHeader>
          <CardTitle>준비 중</CardTitle>
          <CardDescription>
            계정 조회·추가·삭제·권한 수정은 다음 단계에서 만듭니다.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
