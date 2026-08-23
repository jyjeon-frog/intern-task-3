import type { Metadata } from "next";

import { formatDate, formatDateTime, formatNumber } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { listSales } from "@/lib/sales";
import { requireAdmin } from "@/lib/session";
import { DataTabs, type DataTabKey } from "./data-tabs";
import { ExcelUpload } from "./excel-upload";
import { ManualEntryForm } from "./manual-entry-form";
import { SalesList, type SalesFilters } from "./sales-list";
import { UploadHistory, type UploadBatchRow } from "./upload-history";

export const metadata: Metadata = {
  title: "데이터 관리 · VeraNova 판매 데이터 관리",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

async function listUploadBatches(): Promise<UploadBatchRow[]> {
  const batches = await prisma.uploadBatch.findMany({
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true,
      fileName: true,
      totalRows: true,
      successRows: true,
      failedRows: true,
      createdAt: true,
      uploadedBy: { select: { name: true } },
      _count: { select: { records: true } },
    },
  });

  return batches.map((b) => ({
    id: b.id,
    fileName: b.fileName,
    totalRows: b.totalRows,
    successRows: b.successRows,
    failedRows: b.failedRows,
    remainingRows: b._count.records,
    uploadedByLabel: b.uploadedBy?.name ?? "(삭제된 계정)",
    createdAt: formatDateTime(b.createdAt),
  }));
}

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

  const [totalCount, list, batches] = await Promise.all([
    prisma.salesRecord.count(),
    tab === "list" ? listSales({ ...filters, page }) : null,
    tab === "upload" ? listUploadBatches() : null,
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
        <>
          <ExcelUpload />
          <UploadHistory batches={batches ?? []} />
        </>
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
