import type { Prisma } from "@prisma/client";

import { formatDate, formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";

/* ------------------------------------------------------------------ */
/* 선택 항목 (엑셀 업로드 검증에도 같은 값을 쓴다)                        */
/* ------------------------------------------------------------------ */

export const CHANNELS = [
  "자사몰",
  "쿠팡",
  "네이버 스마트스토어",
  "올리브영 온라인",
  "무신사",
  "Amazon US",
  "Qoo10 JP",
  "Shopee SG",
] as const;

export const REGIONS = ["국내", "미국", "일본", "싱가포르"] as const;

export const CATEGORIES = [
  "스킨케어",
  "클렌징",
  "마스크",
  "선케어",
  "바디",
] as const;

export const CUSTOMER_TYPES = ["신규", "재구매"] as const;

/** 채널을 고르면 지역이 자동으로 정해지도록 돕는 기본값 */
export const CHANNEL_DEFAULT_REGION: Record<string, string> = {
  자사몰: "국내",
  쿠팡: "국내",
  "네이버 스마트스토어": "국내",
  "올리브영 온라인": "국내",
  무신사: "국내",
  "Amazon US": "미국",
  "Qoo10 JP": "일본",
  "Shopee SG": "싱가포르",
};

/* ------------------------------------------------------------------ */
/* 목록 조회                                                            */
/* ------------------------------------------------------------------ */

export const PAGE_SIZE = 20;

export type SalesListParams = {
  q?: string;
  channel?: string;
  category?: string;
  from?: string;
  to?: string;
  sort?: "orderDate" | "amount";
  dir?: "asc" | "desc";
  page?: number;
};

export type SalesRow = {
  id: string;
  orderDate: string;
  channel: string;
  region: string;
  productName: string;
  category: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  customerType: string;
  sourceLabel: string;
  createdByLabel: string;
  createdAt: string;
};

/** "YYYY-MM-DD" 를 날짜로 (시간 없이 날짜만 저장한다) */
export function toDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function buildSalesWhere(
  params: SalesListParams,
): Prisma.SalesRecordWhereInput {
  const where: Prisma.SalesRecordWhereInput = {};

  if (params.q?.trim()) {
    where.productName = { contains: params.q.trim(), mode: "insensitive" };
  }
  if (params.channel) where.channel = params.channel;
  if (params.category) where.category = params.category;

  if (params.from || params.to) {
    where.orderDate = {
      ...(params.from ? { gte: toDateOnly(params.from) } : {}),
      ...(params.to ? { lte: toDateOnly(params.to) } : {}),
    };
  }

  return where;
}

export async function listSales(params: SalesListParams) {
  const page = Math.max(1, params.page ?? 1);
  const sort = params.sort === "amount" ? "amount" : "orderDate";
  const dir = params.dir === "asc" ? "asc" : "desc";
  const where = buildSalesWhere(params);

  const [total, records] = await Promise.all([
    prisma.salesRecord.count({ where }),
    prisma.salesRecord.findMany({
      where,
      orderBy: [{ [sort]: dir }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        orderDate: true,
        channel: true,
        region: true,
        productName: true,
        category: true,
        quantity: true,
        unitPrice: true,
        amount: true,
        customerType: true,
        sourceType: true,
        createdAt: true,
        createdBy: { select: { name: true } },
      },
    }),
  ]);

  const rows: SalesRow[] = records.map((r) => ({
    id: r.id,
    orderDate: formatDate(r.orderDate),
    channel: r.channel,
    region: r.region,
    productName: r.productName,
    category: r.category,
    quantity: r.quantity,
    unitPrice: r.unitPrice,
    amount: r.amount,
    customerType: r.customerType,
    sourceLabel: r.sourceType === "EXCEL" ? "엑셀" : "직접입력",
    // 등록자 계정이 지워지면 데이터는 남고 등록자만 비워진다
    createdByLabel: r.createdBy?.name ?? "(삭제된 계정)",
    createdAt: formatDateTime(r.createdAt),
  }));

  return {
    rows,
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
  };
}
