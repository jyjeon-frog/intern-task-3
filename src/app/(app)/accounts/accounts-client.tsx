"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRoundIcon, Loader2Icon, Trash2Icon, UserPlusIcon } from "lucide-react";
import { toast } from "sonner";

import type { AccountRow } from "@/lib/accounts";
import { callApi, errorMessage, type ApiError } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

type Props = {
  accounts: AccountRow[];
  currentUserId: string;
};

export function AccountsClient({ accounts, currentUserId }: Props) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AccountRow | null>(null);
  const [resetTarget, setResetTarget] = useState<AccountRow | null>(null);

  async function run(id: string, fn: () => Promise<unknown>, done: string) {
    setBusyId(id);
    try {
      await fn();
      toast.success(done);
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  }

  function changeRole(account: AccountRow, role: string) {
    if (role === account.role) return;
    void run(
      account.id,
      () =>
        callApi(`/api/accounts/${account.id}`, {
          method: "PATCH",
          body: JSON.stringify({ role }),
        }),
      `${account.loginId} 계정의 등급을 ${role === "ADMIN" ? "어드민" : "일반"}으로 바꿨습니다.`,
    );
  }

  function toggleActive(account: AccountRow) {
    void run(
      account.id,
      () =>
        callApi(`/api/accounts/${account.id}`, {
          method: "PATCH",
          body: JSON.stringify({ isActive: !account.isActive }),
        }),
      account.isActive
        ? `${account.loginId} 계정을 비활성화했습니다.`
        : `${account.loginId} 계정을 활성화했습니다.`,
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">계정 관리</h1>
          <p className="text-muted-foreground text-sm">
            전체 {accounts.length}개 계정
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <UserPlusIcon className="size-4" />
          계정 추가
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>계정 목록</CardTitle>
          <CardDescription>
            등급은 드롭다운에서 바로 바꿀 수 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>아이디</TableHead>
                  <TableHead>이름</TableHead>
                  <TableHead className="w-32">등급</TableHead>
                  <TableHead>상태</TableHead>
                  <TableHead className="whitespace-nowrap">
                    마지막 로그인
                  </TableHead>
                  <TableHead className="whitespace-nowrap">생성일</TableHead>
                  <TableHead className="text-right">관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account) => {
                  const isSelf = account.id === currentUserId;
                  const busy = busyId === account.id;
                  return (
                    <TableRow key={account.id} data-login-id={account.loginId}>
                      <TableCell className="font-medium whitespace-nowrap">
                        {account.loginId}
                        {isSelf ? (
                          <span className="text-muted-foreground ml-1 text-xs">
                            (나)
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {account.name}
                      </TableCell>
                      <TableCell>
                        <NativeSelect
                          aria-label={`${account.loginId} 등급`}
                          value={account.role}
                          disabled={busy || isSelf}
                          onChange={(e) => changeRole(account, e.target.value)}
                        >
                          <option value="USER">일반</option>
                          <option value="ADMIN">어드민</option>
                        </NativeSelect>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={account.isActive ? "default" : "secondary"}
                        >
                          {account.isActive ? "활성" : "비활성"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {account.lastLoginAt}
                      </TableCell>
                      <TableCell className="text-muted-foreground whitespace-nowrap">
                        {account.createdAt}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1 whitespace-nowrap">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busy || isSelf}
                            onClick={() => toggleActive(account)}
                          >
                            {account.isActive ? "비활성화" : "활성화"}
                          </Button>
                          <Button
                            variant="outline"
                            size="icon-sm"
                            aria-label={`${account.loginId} 비밀번호 초기화`}
                            title="비밀번호 초기화"
                            disabled={busy}
                            onClick={() => setResetTarget(account)}
                          >
                            <KeyRoundIcon className="size-3.5" />
                          </Button>
                          <Button
                            variant="destructive"
                            size="icon-sm"
                            aria-label={`${account.loginId} 삭제`}
                            title="삭제"
                            disabled={busy || isSelf}
                            onClick={() => setDeleteTarget(account)}
                          >
                            {busy ? (
                              <Loader2Icon className="size-3.5 animate-spin" />
                            ) : (
                              <Trash2Icon className="size-3.5" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          <p className="text-muted-foreground mt-3 text-xs">
            자기 계정은 등급 변경·비활성화·삭제를 할 수 없습니다. 활성 어드민이
            0명이 되는 변경도 막혀 있습니다.
          </p>
        </CardContent>
      </Card>

      <AddAccountDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onDone={() => router.refresh()}
      />

      <ResetPasswordDialog
        target={resetTarget}
        onClose={() => setResetTarget(null)}
      />

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>계정을 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              <b>{deleteTarget?.loginId}</b> ({deleteTarget?.name}) 계정을
              삭제합니다. 되돌릴 수 없습니다. 이 계정이 등록한 판매 데이터는
              남고, 등록자만 &quot;(삭제된 계정)&quot;으로 표시됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const target = deleteTarget;
                if (!target) return;
                setDeleteTarget(null);
                void run(
                  target.id,
                  () =>
                    callApi(`/api/accounts/${target.id}`, {
                      method: "DELETE",
                    }),
                  `${target.loginId} 계정을 삭제했습니다.`,
                );
              }}
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function AddAccountDialog({
  open,
  onOpenChange,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<
    Record<string, string[] | undefined>
  >({});

  function submit(formData: FormData) {
    const body = {
      loginId: String(formData.get("loginId") ?? "").trim(),
      name: String(formData.get("name") ?? "").trim(),
      role: String(formData.get("role") ?? "USER"),
      password: String(formData.get("password") ?? ""),
    };

    startTransition(async () => {
      try {
        await callApi("/api/accounts", {
          method: "POST",
          body: JSON.stringify(body),
        });
        setFieldErrors({});
        onOpenChange(false);
        toast.success(`${body.loginId} 계정을 만들었습니다.`);
        onDone();
      } catch (e) {
        const err = e as ApiError;
        setFieldErrors(err.fieldErrors ?? {});
        toast.error(errorMessage(e));
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setFieldErrors({});
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <form action={submit}>
          <DialogHeader>
            <DialogTitle>계정 추가</DialogTitle>
            <DialogDescription>
              새 계정을 만듭니다. 초기 비밀번호는 사용자에게 직접 전달해주세요.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <Field
              id="loginId"
              label="아이디"
              error={fieldErrors.loginId?.[0]}
              hint="영문, 숫자, . _ - 3~20자"
            >
              <Input id="loginId" name="loginId" autoComplete="off" />
            </Field>

            <Field id="name" label="이름" error={fieldErrors.name?.[0]}>
              <Input id="name" name="name" autoComplete="off" />
            </Field>

            <Field id="role" label="등급" error={fieldErrors.role?.[0]}>
              <NativeSelect id="role" name="role" defaultValue="USER">
                <option value="USER">일반</option>
                <option value="ADMIN">어드민</option>
              </NativeSelect>
            </Field>

            <Field
              id="password"
              label="초기 비밀번호"
              error={fieldErrors.password?.[0]}
              hint="8자 이상"
            >
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
              />
            </Field>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              취소
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
              만들기
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({
  target,
  onClose,
}: {
  target: AccountRow | null;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | undefined>();

  function submit(formData: FormData) {
    if (!target) return;
    const password = String(formData.get("password") ?? "");
    startTransition(async () => {
      try {
        await callApi(`/api/accounts/${target.id}`, {
          method: "PATCH",
          body: JSON.stringify({ password }),
        });
        setError(undefined);
        onClose();
        toast.success(`${target.loginId} 계정의 비밀번호를 바꿨습니다.`);
      } catch (e) {
        const err = e as ApiError;
        setError(err.fieldErrors?.password?.[0] ?? errorMessage(e));
      }
    });
  }

  return (
    <Dialog
      open={!!target}
      onOpenChange={(open) => {
        if (!open) {
          setError(undefined);
          onClose();
        }
      }}
    >
      <DialogContent>
        <form action={submit}>
          <DialogHeader>
            <DialogTitle>비밀번호 초기화</DialogTitle>
            <DialogDescription>
              <b>{target?.loginId}</b> 계정의 새 비밀번호를 정해주세요.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <Field id="new-password" label="새 비밀번호" error={error} hint="8자 이상">
              <Input
                id="new-password"
                name="password"
                type="password"
                autoComplete="new-password"
              />
            </Field>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={pending}
            >
              취소
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
              변경
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p className="text-destructive text-sm">{error}</p>
      ) : hint ? (
        <p className="text-muted-foreground text-xs">{hint}</p>
      ) : null}
    </div>
  );
}
