import { AppNav, type NavItem } from "@/components/app-nav";
import { LogoutButton } from "@/components/logout-button";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/lib/session";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 로그인하지 않았으면 여기서 /login 으로 보낸다 (middleware에 이은 2차 방어)
  const user = await requireUser();
  const isAdmin = user.role === "ADMIN";

  // 일반 계정에게는 대시보드 메뉴만 보인다.
  // (메뉴를 숨기는 것은 편의일 뿐이고, 실제 차단은 각 페이지에서 다시 검사한다)
  const items: NavItem[] = [
    { href: "/dashboard", label: "대시보드" },
    ...(isAdmin
      ? [
          { href: "/data", label: "데이터 관리" },
          { href: "/accounts", label: "계정 관리" },
        ]
      : []),
  ];

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="bg-background sticky top-0 z-10 border-b">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <p className="text-base font-semibold whitespace-nowrap">
            VeraNova <span className="hidden sm:inline">판매 데이터 관리</span>
          </p>

          <div className="order-3 w-full sm:order-none sm:w-auto">
            <AppNav items={items} />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <span className="text-sm font-medium">{user.name}</span>
            <Badge variant={isAdmin ? "default" : "secondary"}>
              {isAdmin ? "어드민" : "일반"}
            </Badge>
            <LogoutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
