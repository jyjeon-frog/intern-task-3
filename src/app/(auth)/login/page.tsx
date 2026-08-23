import type { Metadata } from "next";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "로그인 · VeraNova 판매 데이터 관리",
};

export default function LoginPage() {
  return (
    <main className="bg-muted/40 flex min-h-dvh items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">VeraNova 판매 데이터 관리</CardTitle>
          <CardDescription>
            사내 계정으로 로그인해주세요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  );
}
