"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";
import { toast } from "sonner";

import { callApi, errorMessage, type ApiError } from "@/lib/api-client";
import { formatWon } from "@/lib/format";
import {
  CATEGORIES,
  CHANNELS,
  CHANNEL_DEFAULT_REGION,
  CUSTOMER_TYPES,
  REGIONS,
} from "@/lib/sales";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

type FieldErrors = Record<string, string[] | undefined>;

const EMPTY = {
  productName: "",
  quantity: "1",
  unitPrice: "",
};

export function ManualEntryForm({ today }: { today: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const [orderDate, setOrderDate] = useState(today);
  const [channel, setChannel] = useState<string>(CHANNELS[0]);
  const [region, setRegion] = useState<string>(
    CHANNEL_DEFAULT_REGION[CHANNELS[0]],
  );
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [customerType, setCustomerType] = useState<string>(CUSTOMER_TYPES[0]);
  const [values, setValues] = useState(EMPTY);

  const quantity = Number(values.quantity);
  const unitPrice = Number(values.unitPrice);
  const amount =
    Number.isFinite(quantity) && Number.isFinite(unitPrice)
      ? Math.max(0, Math.trunc(quantity)) * Math.max(0, Math.trunc(unitPrice))
      : 0;

  function onChannelChange(next: string) {
    setChannel(next);
    const defaultRegion = CHANNEL_DEFAULT_REGION[next];
    if (defaultRegion) setRegion(defaultRegion);
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const body = {
      orderDate,
      channel,
      region,
      productName: values.productName.trim(),
      category,
      quantity: values.quantity === "" ? NaN : Number(values.quantity),
      unitPrice: values.unitPrice === "" ? NaN : Number(values.unitPrice),
      customerType,
    };

    startTransition(async () => {
      try {
        await callApi("/api/sales", {
          method: "POST",
          body: JSON.stringify(body),
        });
        setFieldErrors({});
        setValues(EMPTY);
        toast.success("판매 데이터를 저장했습니다.");
        router.refresh();
      } catch (e) {
        const err = e as ApiError;
        setFieldErrors(err.fieldErrors ?? {});
        toast.error(errorMessage(e));
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>직접 입력</CardTitle>
        <CardDescription>
          한 건씩 입력합니다. 매출액은 수량 × 단가로 자동 계산됩니다.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} noValidate className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field id="orderDate" label="주문일" error={fieldErrors.orderDate?.[0]}>
              <Input
                id="orderDate"
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
              />
            </Field>

            <Field id="channel" label="판매채널" error={fieldErrors.channel?.[0]}>
              <NativeSelect
                id="channel"
                value={channel}
                onChange={(e) => onChannelChange(e.target.value)}
              >
                {CHANNELS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </NativeSelect>
            </Field>

            <Field id="region" label="지역" error={fieldErrors.region?.[0]}>
              <NativeSelect
                id="region"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
              >
                {REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </NativeSelect>
            </Field>

            <Field
              id="productName"
              label="제품명"
              error={fieldErrors.productName?.[0]}
              className="lg:col-span-2"
            >
              <Input
                id="productName"
                value={values.productName}
                placeholder="예) VN 하이드라 세럼 30ml"
                onChange={(e) =>
                  setValues((v) => ({ ...v, productName: e.target.value }))
                }
              />
            </Field>

            <Field id="category" label="카테고리" error={fieldErrors.category?.[0]}>
              <NativeSelect
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </NativeSelect>
            </Field>

            <Field id="quantity" label="수량" error={fieldErrors.quantity?.[0]}>
              <Input
                id="quantity"
                type="number"
                inputMode="numeric"
                min={1}
                value={values.quantity}
                onChange={(e) =>
                  setValues((v) => ({ ...v, quantity: e.target.value }))
                }
              />
            </Field>

            <Field id="unitPrice" label="단가 (원)" error={fieldErrors.unitPrice?.[0]}>
              <Input
                id="unitPrice"
                type="number"
                inputMode="numeric"
                min={0}
                value={values.unitPrice}
                placeholder="예) 28000"
                onChange={(e) =>
                  setValues((v) => ({ ...v, unitPrice: e.target.value }))
                }
              />
            </Field>

            <Field
              id="customerType"
              label="고객유형"
              error={fieldErrors.customerType?.[0]}
            >
              <NativeSelect
                id="customerType"
                value={customerType}
                onChange={(e) => setCustomerType(e.target.value)}
              >
                {CUSTOMER_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>

          <div className="bg-muted/40 flex items-center justify-between rounded-lg border px-4 py-3">
            <span className="text-sm font-medium">매출액 (자동 계산)</span>
            <span className="text-lg font-semibold" data-testid="computed-amount">
              {formatWon(amount)}
            </span>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2Icon className="size-4 animate-spin" /> : null}
              저장
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function Field({
  id,
  label,
  error,
  className,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? <p className="text-destructive text-sm">{error}</p> : null}
    </div>
  );
}
