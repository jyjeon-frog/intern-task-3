"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  Loader2Icon,
  SearchIcon,
  Trash2Icon,
} from "lucide-react";
import { toast } from "sonner";

import { callApi, errorMessage } from "@/lib/api-client";
import { formatNumber } from "@/lib/format";
import { CATEGORIES, CHANNELS, type SalesRow } from "@/lib/sales";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type SalesFilters = {
  q: string;
  channel: string;
  category: string;
  from: string;
  to: string;
  sort: "orderDate" | "amount";
  dir: "asc" | "desc";
};

type Props = {
  rows: SalesRow[];
  total: number;
  page: number;
  totalPages: number;
  filters: SalesFilters;
};

export function SalesList({ rows, total, page, totalPages, filters }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [navigating, startNavigation] = useTransition();
  const [deleting, setDeleting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<
    { kind: "one"; row: SalesRow } | { kind: "many" } | null
  >(null);

  const hasFilter =
    !!filters.q ||
    !!filters.channel ||
    !!filters.category ||
    !!filters.from ||
    !!filters.to;

  function updateParams(
    updates: Record<string, string | undefined>,
    keepPage = false,
  ) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (!value) params.delete(key);
      else params.set(key, value);
    }
    if (!keepPage) params.delete("page");
    setSelected(new Set());
    startNavigation(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function onFilterSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    updateParams({
      q: String(form.get("q") ?? "").trim(),
      channel: String(form.get("channel") ?? ""),
      category: String(form.get("category") ?? ""),
      from: String(form.get("from") ?? ""),
      to: String(form.get("to") ?? ""),
    });
  }

  function toggleSort(column: "orderDate" | "amount") {
    const dir =
      filters.sort === column && filters.dir === "desc" ? "asc" : "desc";
    updateParams({ sort: column, dir });
  }

  function toggleRow(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(rows.map((r) => r.id)) : new Set());
  }

  async function runDelete(fn: () => Promise<unknown>, message: string) {
    setDeleting(true);
    try {
      await fn();
      toast.success(message);
      setSelected(new Set());
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setDeleting(false);
    }
  }

  const allChecked = rows.length > 0 && selected.size === rows.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>데이터 목록</CardTitle>
        <CardDescription>
          전체 {formatNumber(total)}건
          {hasFilter ? " (조건 적용됨)" : ""} · 페이지당 20건
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 필터 */}
        <form
          onSubmit={onFilterSubmit}
          className="bg-muted/30 grid gap-3 rounded-lg border p-3 sm:grid-cols-2 lg:grid-cols-6"
        >
          <div className="space-y-1.5 lg:col-span-2">
            <Label htmlFor="q">제품명 검색</Label>
            <Input
              id="q"
              name="q"
              defaultValue={filters.q}
              placeholder="예) 세럼"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="channel">판매채널</Label>
            <NativeSelect id="channel" name="channel" defaultValue={filters.channel}>
              <option value="">전체</option>
              {CHANNELS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="category">카테고리</Label>
            <NativeSelect
              id="category"
              name="category"
              defaultValue={filters.category}
            >
              <option value="">전체</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="from">시작일</Label>
            <Input id="from" name="from" type="date" defaultValue={filters.from} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="to">종료일</Label>
            <Input id="to" name="to" type="date" defaultValue={filters.to} />
          </div>

          <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-6">
            <Button type="submit" disabled={navigating}>
              <SearchIcon className="size-4" />
              조회
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={navigating}
              onClick={() =>
                updateParams({
                  q: "",
                  channel: "",
                  category: "",
                  from: "",
                  to: "",
                })
              }
            >
              초기화
            </Button>
            {navigating ? (
              <span className="text-muted-foreground flex items-center gap-1 text-sm">
                <Loader2Icon className="size-4 animate-spin" />
                불러오는 중...
              </span>
            ) : null}
          </div>
        </form>

        {/* 선택 삭제 */}
        {selected.size > 0 ? (
          <div className="border-destructive/30 bg-destructive/5 flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2">
            <span className="text-sm">{selected.size}건 선택됨</span>
            <Button
              variant="destructive"
              size="sm"
              disabled={deleting}
              onClick={() => setConfirm({ kind: "many" })}
            >
              <Trash2Icon className="size-4" />
              선택 삭제
            </Button>
          </div>
        ) : null}

        {/* 표 */}
        {rows.length === 0 ? (
          <div className="text-muted-foreground rounded-lg border border-dashed py-16 text-center text-sm">
            {hasFilter
              ? "조건에 맞는 데이터가 없습니다. 필터를 바꿔보세요."
              : "등록된 데이터가 없습니다. 위에서 직접 입력하거나 엑셀을 올려주세요."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      aria-label="전체 선택"
                      checked={allChecked}
                      onCheckedChange={(v) => toggleAll(v === true)}
                    />
                  </TableHead>
                  <TableHead>
                    <SortButton
                      label="주문일"
                      active={filters.sort === "orderDate"}
                      dir={filters.dir}
                      onClick={() => toggleSort("orderDate")}
                    />
                  </TableHead>
                  <TableHead>판매채널</TableHead>
                  <TableHead>지역</TableHead>
                  <TableHead>제품명</TableHead>
                  <TableHead>카테고리</TableHead>
                  <TableHead className="text-right">수량</TableHead>
                  <TableHead className="text-right">단가</TableHead>
                  <TableHead className="text-right">
                    <SortButton
                      label="매출액"
                      active={filters.sort === "amount"}
                      dir={filters.dir}
                      onClick={() => toggleSort("amount")}
                    />
                  </TableHead>
                  <TableHead>고객유형</TableHead>
                  <TableHead>입력방법</TableHead>
                  <TableHead>등록자</TableHead>
                  <TableHead className="text-right">삭제</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} data-row-id={row.id}>
                    <TableCell>
                      <Checkbox
                        aria-label={`${row.productName} 선택`}
                        checked={selected.has(row.id)}
                        onCheckedChange={(v) => toggleRow(row.id, v === true)}
                      />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {row.orderDate}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {row.channel}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {row.region}
                    </TableCell>
                    <TableCell className="min-w-48">{row.productName}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {row.category}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(row.quantity)}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {formatNumber(row.unitPrice)}
                    </TableCell>
                    <TableCell className="text-right font-medium whitespace-nowrap">
                      {formatNumber(row.amount)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {row.customerType}
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {row.sourceLabel}
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {row.createdByLabel}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="destructive"
                        size="icon-sm"
                        aria-label={`${row.productName} 삭제`}
                        disabled={deleting}
                        onClick={() => setConfirm({ kind: "one", row })}
                      >
                        <Trash2Icon className="size-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* 페이지 이동 */}
        {rows.length > 0 ? (
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground text-sm">
              {page} / {totalPages} 페이지
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || navigating}
                onClick={() => updateParams({ page: String(page - 1) }, true)}
              >
                이전
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages || navigating}
                onClick={() => updateParams({ page: String(page + 1) }, true)}
              >
                다음
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>

      <AlertDialog
        open={!!confirm}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>데이터를 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === "one"
                ? `${confirm.row.orderDate} · ${confirm.row.productName} 1건을 삭제합니다.`
                : `선택한 ${selected.size}건을 삭제합니다.`}{" "}
              되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const target = confirm;
                setConfirm(null);
                if (!target) return;
                if (target.kind === "one") {
                  void runDelete(
                    () =>
                      callApi(`/api/sales/${target.row.id}`, {
                        method: "DELETE",
                      }),
                    "1건을 삭제했습니다.",
                  );
                } else {
                  const ids = [...selected];
                  void runDelete(
                    () =>
                      callApi("/api/sales", {
                        method: "DELETE",
                        body: JSON.stringify({ ids }),
                      }),
                    `${ids.length}건을 삭제했습니다.`,
                  );
                }
              }}
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function SortButton({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="hover:text-foreground inline-flex items-center gap-1 whitespace-nowrap"
    >
      {label}
      {active ? (
        dir === "asc" ? (
          <ArrowUpIcon className="size-3.5" />
        ) : (
          <ArrowDownIcon className="size-3.5" />
        )
      ) : null}
    </button>
  );
}
