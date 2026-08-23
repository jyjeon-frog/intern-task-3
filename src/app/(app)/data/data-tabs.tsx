import Link from "next/link";

import { cn } from "@/lib/utils";

export const DATA_TABS = [
  { key: "input", label: "직접 입력" },
  { key: "upload", label: "엑셀 업로드" },
  { key: "list", label: "데이터 목록" },
] as const;

export type DataTabKey = (typeof DATA_TABS)[number]["key"];

/** 탭 상태를 주소(?tab=)에 담아 새로고침해도 유지되게 한다 */
export function DataTabs({ current }: { current: DataTabKey }) {
  return (
    <div
      role="tablist"
      aria-label="데이터 관리 탭"
      className="bg-muted/50 inline-flex w-full gap-1 overflow-x-auto rounded-lg border p-1 sm:w-auto"
    >
      {DATA_TABS.map((tab) => {
        const active = tab.key === current;
        return (
          <Link
            key={tab.key}
            href={`/data?tab=${tab.key}`}
            role="tab"
            aria-selected={active}
            className={cn(
              "flex-1 rounded-md px-4 py-1.5 text-center text-sm font-medium whitespace-nowrap transition-colors sm:flex-none",
              active
                ? "bg-background shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
