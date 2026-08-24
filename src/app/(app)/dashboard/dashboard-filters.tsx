"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Loader2Icon, SearchIcon } from "lucide-react";

import { CATEGORIES, CHANNELS } from "@/lib/sales";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

export type DashboardFilterValues = {
  from: string;
  to: string;
  channel: string;
  category: string;
};

/** 필터 상태는 주소(쿼리스트링)에 담는다 — 새로고침·공유해도 그대로 */
export function DashboardFilters({
  values,
}: {
  values: DashboardFilterValues;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  function apply(next: DashboardFilterValues) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value);
    }
    const query = params.toString();
    startTransition(() => {
      router.push(query ? `${pathname}?${query}` : pathname);
    });
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    apply({
      from: String(form.get("from") ?? ""),
      to: String(form.get("to") ?? ""),
      channel: String(form.get("channel") ?? ""),
      category: String(form.get("category") ?? ""),
    });
  }

  return (
    <Card>
      <CardContent>
        <form
          onSubmit={onSubmit}
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
        >
          <div className="space-y-1.5">
            <Label htmlFor="from">시작일</Label>
            <Input id="from" name="from" type="date" defaultValue={values.from} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="to">종료일</Label>
            <Input id="to" name="to" type="date" defaultValue={values.to} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="channel">판매채널</Label>
            <NativeSelect
              id="channel"
              name="channel"
              defaultValue={values.channel}
            >
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
              defaultValue={values.category}
            >
              <option value="">전체</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex items-end gap-2">
            <Button type="submit" disabled={pending}>
              <SearchIcon className="size-4" />
              적용
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() =>
                apply({ from: "", to: "", channel: "", category: "" })
              }
            >
              초기화
            </Button>
            {pending ? (
              <Loader2Icon className="text-muted-foreground size-4 animate-spin" />
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
