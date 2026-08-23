import type { Metadata } from "next";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = {
  title: "대시보드 · VeraNova 판매 데이터 관리",
};

export default async function DashboardPage() {
  const user = await requireUser();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">대시보드</h1>
        <p className="text-muted-foreground text-sm">
          {user.name}님, 안녕하세요.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>준비 중</CardTitle>
          <CardDescription>
            요약 카드·그래프·표는 다음 단계에서 만듭니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-muted-foreground text-sm">
          현재 로그인한 계정: <b>{user.loginId}</b> (
          {user.role === "ADMIN" ? "어드민" : "일반"})
        </CardContent>
      </Card>
    </div>
  );
}
