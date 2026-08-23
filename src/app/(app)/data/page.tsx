import type { Metadata } from "next";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate, formatNumber } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { listSales } from "@/lib/sales";
import { requireAdmin } from "@/lib/session";
import { DataTabs, type DataTabKey } from "./data-tabs";
import { ManualEntryForm } from "./manual-entry-form";
import { SalesList, type SalesFilters } from "./sales-list";

export const metadata: Metadata = {
  title: "데이터 관리 · VeraNova 판매 데이터 관리",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function DataPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // 어드민이 아니면 여기서 403
  await requireAdmin();

  const sp = await searchParams;
  const one = (key: string) =>
    typeof sp[key] === "string" ? (sp[key] as string) : "";

  const tabParam = one("tab");
  const tab: DataTabKey =
    tabParam === "input" || tabParam === "upload" ? tabParam : "list";

  const filters: SalesFilters = {
    q: one("q"),
    channel: one("channel"),
    category: one("category"),
    from: one("from"),
    to: one("to"),
    sort: one("sort") === "amount" ? "amount" : "orderDate",
    dir: one("dir") === "asc" ? "asc" : "desc",
  };
  const page = Math.max(1, Number(one("page")) || 1);

  const [totalCount, list] = await Promise.all([
    prisma.salesRecord.count(),
    tab === "list" ? listSales({ ...filters, page }) : null,
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">데이터 관리</h1>
        <p className="text-muted-foreground text-sm">
          등록된 판매 데이터 {formatNumber(totalCount)}건
        </p>
      </div>

      <DataTabs current={tab} />

      {tab === "input" ? (
        <ManualEntryForm today={formatDate(new Date())} />
      ) : null}

      {tab === "upload" ? (
        <Card>
          <CardHeader>
            <CardTitle>엑셀 업로드</CardTitle>
            <CardDescription>다음 단계에서 만듭니다.</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {tab === "list" && list ? (
        <SalesList
          rows={list.rows}
          total={list.total}
          page={list.page}
          totalPages={list.totalPages}
          filters={filters}
        />
      ) : null}
    </div>
  );
}
