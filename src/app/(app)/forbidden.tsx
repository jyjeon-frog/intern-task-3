import Link from "next/link";
import { ShieldXIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * 권한이 없는 페이지에 접근했을 때 (실제 HTTP 403 응답과 함께 렌더된다).
 * 상단바가 있는 앱 레이아웃 안에서 보여줘서 로그아웃·대시보드 이동을 할 수 있게 한다.
 */
export default function Forbidden() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <ShieldXIcon className="text-muted-foreground size-10" />
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">403 · 접근 권한이 없습니다</h1>
        <p className="text-muted-foreground text-sm">
          이 페이지는 어드민 계정만 이용할 수 있습니다.
        </p>
      </div>
      <Button render={<Link href="/dashboard" />}>대시보드로 돌아가기</Button>
    </div>
  );
}
