import { formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { buildSalesWhere, type SalesListParams } from "@/lib/sales";

/**
 * 대시보드 집계.
 * 모든 계산은 DB(Prisma groupBy / aggregate)에서 하고,
 * 전체 행을 브라우저로 내려보내지 않는다.
 */

export type DashboardFilters = Pick<
  SalesListParams,
  "channel" | "category" | "from" | "to"
>;

export type NamedValue = { name: string; value: number };

export type DashboardData = {
  /** 필터와 무관한 전체 등록 건수 (빈 상태 판단용) */
  totalRecords: number;
  summary: {
    totalAmount: number;
    orderCount: number;
    averageOrderValue: number;
  };
  dailyTrend: { date: string; label: string; amount: number }[];
  byChannel: NamedValue[];
  byCategory: NamedValue[];
  byCustomerType: NamedValue[];
  topProducts: {
    productName: string;
    quantity: number;
    amount: number;
    share: number;
  }[];
  recent: {
    id: string;
    orderDate: string;
    channel: string;
    productName: string;
    quantity: number;
    amount: number;
    createdAt: string;
  }[];
};

export async function getDashboardData(
  filters: DashboardFilters,
): Promise<DashboardData> {
  const where = buildSalesWhere(filters);

  const [
    totalRecords,
    aggregate,
    dailyRows,
    channelRows,
    categoryRows,
    customerRows,
    productRows,
    recentRows,
  ] = await Promise.all([
    prisma.salesRecord.count(),
    prisma.salesRecord.aggregate({
      where,
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.salesRecord.groupBy({
      by: ["orderDate"],
      where,
      _sum: { amount: true },
    }),
    prisma.salesRecord.groupBy({
      by: ["channel"],
      where,
      _sum: { amount: true },
    }),
    prisma.salesRecord.groupBy({
      by: ["category"],
      where,
      _sum: { amount: true },
    }),
    prisma.salesRecord.groupBy({
      by: ["customerType"],
      where,
      _sum: { amount: true },
    }),
    prisma.salesRecord.groupBy({
      by: ["productName"],
      where,
      _sum: { amount: true, quantity: true },
      orderBy: { _sum: { amount: "desc" } },
      take: 10,
    }),
    prisma.salesRecord.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        orderDate: true,
        channel: true,
        productName: true,
        quantity: true,
        amount: true,
        createdAt: true,
      },
    }),
  ]);

  const totalAmount = aggregate._sum.amount ?? 0;
  const orderCount = aggregate._count._all;

  const dailyTrend = dailyRows
    .map((row) => {
      const date = formatDate(row.orderDate);
      return {
        date,
        label: date.slice(5), // MM-DD
        amount: row._sum.amount ?? 0,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  const byChannel: NamedValue[] = channelRows
    .map((row) => ({ name: row.channel, value: row._sum.amount ?? 0 }))
    .sort((a, b) => b.value - a.value);

  const byCategory: NamedValue[] = categoryRows
    .map((row) => ({ name: row.category, value: row._sum.amount ?? 0 }))
    .sort((a, b) => b.value - a.value);

  const byCustomerType: NamedValue[] = customerRows
    .map((row) => ({ name: row.customerType, value: row._sum.amount ?? 0 }))
    .sort((a, b) => b.value - a.value);

  const topProducts = productRows.map((row) => {
    const amount = row._sum.amount ?? 0;
    return {
      productName: row.productName,
      quantity: row._sum.quantity ?? 0,
      amount,
      share: totalAmount > 0 ? (amount / totalAmount) * 100 : 0,
    };
  });

  return {
    totalRecords,
    summary: {
      totalAmount,
      orderCount,
      averageOrderValue:
        orderCount > 0 ? Math.round(totalAmount / orderCount) : 0,
    },
    dailyTrend,
    byChannel,
    byCategory,
    byCustomerType,
    topProducts,
    recent: recentRows.map((row) => ({
      id: row.id,
      orderDate: formatDate(row.orderDate),
      channel: row.channel,
      productName: row.productName,
      quantity: row.quantity,
      amount: row.amount,
      createdAt: formatDate(row.createdAt),
    })),
  };
}
