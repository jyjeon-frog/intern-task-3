"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { callApi, errorMessage } from "@/lib/api-client";
import { formatNumber } from "@/lib/format";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type UploadBatchRow = {
  id: string;
  fileName: string;
  totalRows: number;
  successRows: number;
  failedRows: number;
  remainingRows: number;
  uploadedByLabel: string;
  createdAt: string;
};

export function UploadHistory({ batches }: { batches: UploadBatchRow[] }) {
  const router = useRouter();
  const [target, setTarget] = useState<UploadBatchRow | null>(null);
  const [busy, setBusy] = useState(false);

  async function remove(batch: UploadBatchRow) {
    setBusy(true);
    try {
      const res = await callApi<{ deleted: number }>(
        `/api/sales/batches/${batch.id}`,
        { method: "DELETE" },
      );
      toast.success(
        `${batch.fileName} 업로드 이력과 데이터 ${res.deleted}건을 삭제했습니다.`,
      );
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>업로드 이력</CardTitle>
        <CardDescription>
          잘못 올린 파일은 묶음째 되돌릴 수 있습니다. 이력을 지우면 그 파일로
          들어온 데이터도 함께 지워집니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {batches.length === 0 ? (
          <div className="text-muted-foreground rounded-lg border border-dashed py-10 text-center text-sm">
            아직 엑셀로 올린 기록이 없습니다.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>파일명</TableHead>
                  <TableHead className="text-right">읽은 행</TableHead>
                  <TableHead className="text-right">저장</TableHead>
                  <TableHead className="text-right">오류</TableHead>
                  <TableHead className="text-right">현재 남은 건수</TableHead>
                  <TableHead>업로더</TableHead>
                  <TableHead className="whitespace-nowrap">일시</TableHead>
                  <TableHead className="text-right">삭제</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((batch) => (
                  <TableRow key={batch.id} data-batch-id={batch.id}>
                    <TableCell className="min-w-44 font-medium">
                      {batch.fileName}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(batch.totalRows)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(batch.successRows)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(batch.failedRows)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatNumber(batch.remainingRows)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {batch.uploadedByLabel}
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {batch.createdAt}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="destructive"
                        size="icon-sm"
                        aria-label={`${batch.fileName} 업로드 되돌리기`}
                        disabled={busy}
                        onClick={() => setTarget(batch)}
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
      </CardContent>

      <AlertDialog
        open={!!target}
        onOpenChange={(open) => {
          if (!open) setTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>이 업로드를 되돌릴까요?</AlertDialogTitle>
            <AlertDialogDescription>
              <b>{target?.fileName}</b> 으로 들어온 데이터{" "}
              {formatNumber(target?.remainingRows ?? 0)}건과 업로드 이력을 함께
              삭제합니다. 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const batch = target;
                setTarget(null);
                if (batch) void remove(batch);
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
