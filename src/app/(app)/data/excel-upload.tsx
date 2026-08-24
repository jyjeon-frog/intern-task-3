"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  DownloadIcon,
  FileSpreadsheetIcon,
  Loader2Icon,
  UploadIcon,
} from "lucide-react";
import { toast } from "sonner";

import { errorMessage } from "@/lib/api-client";
import { formatNumber } from "@/lib/format";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type PreviewRow = {
  excelRow: number;
  orderDate: string;
  channel: string;
  region: string;
  productName: string;
  category: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  customerType: string;
};

type RowError = {
  excelRow: number;
  column: string;
  message: string;
  value: string;
};

type Preview = {
  fileName: string;
  sheetName: string;
  totalRows: number;
  successRows: number;
  failedRows: number;
  preview: PreviewRow[];
  errors: RowError[];
  errorsTruncated: boolean;
};

const MAX_BYTES = 4 * 1024 * 1024;

export function ExcelUpload() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);

  function reset() {
    setFile(null);
    setPreview(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function loadPreview(next: File) {
    setError(null);
    setPreview(null);
    setFile(next);

    if (!/\.(xlsx|xls)$/i.test(next.name)) {
      setError("엑셀 파일(.xlsx, .xls)만 올릴 수 있습니다.");
      return;
    }
    if (next.size > MAX_BYTES) {
      setError("파일이 너무 큽니다(4MB 초과). 파일을 나눠 올려주세요.");
      return;
    }

    setReading(true);
    try {
      const form = new FormData();
      form.append("file", next);
      const res = await fetch("/api/sales/upload", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "파일을 읽지 못했습니다.");
        return;
      }
      setPreview(data as Preview);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setReading(false);
    }
  }

  async function save() {
    if (!file) return;
    setSaving(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/sales/upload?commit=1", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "저장하지 못했습니다.");
        return;
      }
      toast.success(
        `${data.inserted}건을 저장했습니다.${
          data.failedRows > 0 ? ` (오류 ${data.failedRows}행은 건너뜀)` : ""
        }`,
      );
      reset();
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle>엑셀 업로드</CardTitle>
            <CardDescription>
              파일을 올리면 먼저 미리보기를 보여드립니다. 확인 후 저장하세요.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            nativeButton={false}
            render={<a href="/api/sales/template" download />}
          >
            <DownloadIcon className="size-4" />
            양식 다운로드
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* 파일 선택 영역 */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const dropped = e.dataTransfer.files?.[0];
            if (dropped) void loadPreview(dropped);
          }}
          className={cn(
            "flex flex-col items-center gap-3 rounded-lg border-2 border-dashed px-4 py-10 text-center transition-colors",
            dragging ? "border-primary bg-primary/5" : "border-muted",
          )}
        >
          <FileSpreadsheetIcon className="text-muted-foreground size-8" />
          <div className="space-y-1">
            <p className="text-sm font-medium">
              엑셀 파일을 여기에 끌어다 놓거나 아래에서 선택하세요
            </p>
            <p className="text-muted-foreground text-xs">
              .xlsx, .xls · 최대 4MB
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            aria-label="엑셀 파일 선택"
            className="text-sm file:mr-3 file:rounded-md file:border file:bg-secondary file:px-3 file:py-1.5 file:text-sm"
            onChange={(e) => {
              const chosen = e.target.files?.[0];
              if (chosen) void loadPreview(chosen);
            }}
          />
          {reading ? (
            <span className="text-muted-foreground flex items-center gap-2 text-sm">
              <Loader2Icon className="size-4 animate-spin" />
              파일을 읽는 중...
            </span>
          ) : null}
        </div>

        {error ? (
          <Alert variant="destructive" role="alert">
            <AlertCircleIcon className="size-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {preview ? (
          <div className="space-y-4">
            {/* 요약 */}
            <div className="grid gap-3 sm:grid-cols-3">
              <Summary label="읽어들인 행" value={preview.totalRows} />
              <Summary
                label="정상 행"
                value={preview.successRows}
                tone="ok"
                testId="preview-success"
              />
              <Summary
                label="오류 행"
                value={preview.failedRows}
                tone={preview.failedRows > 0 ? "bad" : undefined}
                testId="preview-failed"
              />
            </div>

            <p className="text-muted-foreground text-sm">
              파일: <b>{preview.fileName}</b> · 시트: {preview.sheetName}
            </p>

            {/* 오류 목록 */}
            {preview.errors.length > 0 ? (
              <div className="border-destructive/30 bg-destructive/5 space-y-2 rounded-lg border p-3">
                <p className="text-destructive text-sm font-medium">
                  오류가 있는 행 ({formatNumber(preview.failedRows)}행) — 저장 시
                  건너뜁니다
                </p>
                <ul
                  className="max-h-56 space-y-1 overflow-y-auto text-sm"
                  data-testid="error-list"
                >
                  {preview.errors.map((e, i) => (
                    <li key={`${e.excelRow}-${e.column}-${i}`}>
                      <b>{e.excelRow}행</b>: {e.column} — {e.message} (값: &apos;
                      {e.value}&apos;)
                    </li>
                  ))}
                </ul>
                {preview.errorsTruncated ? (
                  <p className="text-muted-foreground text-xs">
                    오류가 많아 100건까지만 보여드립니다.
                  </p>
                ) : null}
              </div>
            ) : (
              <Alert>
                <CheckCircle2Icon className="size-4" />
                <AlertDescription>
                  오류 없이 모두 읽었습니다.
                </AlertDescription>
              </Alert>
            )}

            {/* 앞 10행 미리보기 */}
            {preview.preview.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">
                  미리보기 (정상 행 앞 {preview.preview.length}건)
                </p>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>엑셀 행</TableHead>
                        <TableHead>주문일</TableHead>
                        <TableHead>판매채널</TableHead>
                        <TableHead>지역</TableHead>
                        <TableHead>제품명</TableHead>
                        <TableHead>카테고리</TableHead>
                        <TableHead className="text-right">수량</TableHead>
                        <TableHead className="text-right">단가</TableHead>
                        <TableHead className="text-right">매출액</TableHead>
                        <TableHead>고객유형</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.preview.map((row) => (
                        <TableRow key={row.excelRow}>
                          <TableCell className="text-muted-foreground">
                            {row.excelRow}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {row.orderDate}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {row.channel}
                          </TableCell>
                          <TableCell>{row.region}</TableCell>
                          <TableCell className="min-w-44">
                            {row.productName}
                          </TableCell>
                          <TableCell>{row.category}</TableCell>
                          <TableCell className="text-right">
                            {formatNumber(row.quantity)}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatNumber(row.unitPrice)}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatNumber(row.amount)}
                          </TableCell>
                          <TableCell>{row.customerType}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={reset} disabled={saving}>
                취소
              </Button>
              <Button
                onClick={save}
                disabled={saving || preview.successRows === 0}
              >
                {saving ? (
                  <Loader2Icon className="size-4 animate-spin" />
                ) : (
                  <UploadIcon className="size-4" />
                )}
                이대로 저장 ({formatNumber(preview.successRows)}건)
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Summary({
  label,
  value,
  tone,
  testId,
}: {
  label: string;
  value: number;
  tone?: "ok" | "bad";
  testId?: string;
}) {
  return (
    <div className="rounded-lg border px-4 py-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p
        data-testid={testId}
        className={cn(
          "text-xl font-semibold",
          tone === "ok" && "text-emerald-600",
          tone === "bad" && "text-destructive",
        )}
      >
        {formatNumber(value)}
      </p>
    </div>
  );
}
