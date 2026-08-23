import type { Metadata } from "next";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = {
  title: "데이터 관리 · VeraNova 판매 데이터 관리",
};

export default async function DataPage() {
  // 어드민이 아니면 여기서 403
  await requireAdmin();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">데이터 관리</h1>
      <Card>
        <CardHeader>
          <CardTitle>준비 중</CardTitle>
          <CardDescription>
            직접 입력·엑셀 업로드·데이터 목록은 다음 단계에서 만듭니다.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
