import type { Metadata } from "next";
import Link from "next/link";
import { DatabaseIcon } from "lucide-react";

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
import { Button } from "@/components/ui/button";
import { getDashboardData } from "@/lib/dashboard";
import { formatNumber, formatWon } from "@/lib/format";
import { requireUser } from "@/lib/session";
import {
  CategoryDonutChart,
  ChannelBarChart,
  CustomerTypePieChart,
  DailyTrendChart,
} from "./charts";
import {
  DashboardFilters,
  type DashboardFilterValues,
} from "./dashboard-filters";

export const metadata: Metadata = {
  title: "대시보드 · VeraNova 판매 데이터 관리",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireUser();

  const sp = await searchParams;
  const one = (key: string) =>
    typeof sp[key] === "string" ? (sp[key] as string) : "";

  const filters: DashboardFilterValues = {
    from: one("from"),
    to: one("to"),
    channel: one("channel"),
    category: one("category"),
  };

  const data = await getDashboardData(filters);
  const hasFilter = Object.values(filters).some(Boolean);
  const isEmpty = data.totalRecords === 0;
  const noMatch = !isEmpty && data.summary.orderCount === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">대시보드</h1>
        <p className="text-muted-foreground text-sm">
          {user.name}님, 안녕하세요.
        </p>
      </div>

      {isEmpty ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-20 text-center">
            <DatabaseIcon className="text-muted-foreground size-10" />
            <div className="space-y-1">
              <p className="text-lg font-medium">데이터를 먼저 등록해주세요</p>
              <p className="text-muted-foreground text-sm">
                {user.role === "ADMIN"
                  ? "데이터 관리에서 직접 입력하거나 엑셀을 올리면 이곳에 요약이 나타납니다."
                  : "어드민이 데이터를 등록하면 이곳에 요약이 나타납니다."}
              </p>
            </div>
            {user.role === "ADMIN" ? (
              <Button
                nativeButton={false}
                render={<Link href="/data?tab=input" />}
              >
                데이터 등록하러 가기
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <>
          <DashboardFilters values={filters} />

          {/* 요약 카드 4개 */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              label="총 매출액"
              value={formatWon(data.summary.totalAmount)}
              testId="card-total-amount"
            />
            <SummaryCard
              label="총 주문 건수"
              value={`${formatNumber(data.summary.orderCount)}건`}
              testId="card-order-count"
            />
            <SummaryCard
              label="평균 주문금액 (AOV)"
              value={formatWon(data.summary.averageOrderValue)}
              testId="card-aov"
            />
            <SummaryCard
              label="등록된 데이터 건수"
              value={`${formatNumber(data.totalRecords)}건`}
              hint={hasFilter ? "조건과 무관한 전체 건수" : undefined}
              testId="card-total-records"
            />
          </div>

          {noMatch ? (
            <Card>
              <CardContent className="text-muted-foreground py-16 text-center text-sm">
                조건에 맞는 데이터가 없습니다. 기간이나 필터를 바꿔보세요.
              </CardContent>
            </Card>
          ) : (
            <>
              {/* 그래프 4개 */}
              <div className="grid gap-4 lg:grid-cols-2">
                <ChartCard
                  title="일별 매출 추이"
                  description="주문일 기준 하루 매출 합계"
                >
                  <DailyTrendChart data={data.dailyTrend} />
                </ChartCard>

                <ChartCard
                  title="채널별 매출"
                  description="매출이 높은 채널 순"
                >
                  <ChannelBarChart data={data.byChannel} />
                </ChartCard>

                <ChartCard
                  title="카테고리별 매출 비중"
                  description="전체 매출에서 차지하는 비율"
                >
                  <CategoryDonutChart data={data.byCategory} />
                </ChartCard>

                <ChartCard
                  title="신규 vs 재구매 비중"
                  description="고객유형별 매출 비율"
                >
                  <CustomerTypePieChart data={data.byCustomerType} />
                </ChartCard>
              </div>

              {/* 표 2개 */}
              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>제품별 매출 순위 TOP 10</CardTitle>
                    <CardDescription>매출액이 높은 제품 순</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table data-testid="top-products">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10">#</TableHead>
                            <TableHead>제품명</TableHead>
                            <TableHead className="text-right">
                              판매수량
                            </TableHead>
                            <TableHead className="text-right">매출액</TableHead>
                            <TableHead className="text-right">비중</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.topProducts.map((row, index) => (
                            <TableRow key={row.productName}>
                              <TableCell className="text-muted-foreground">
                                {index + 1}
                              </TableCell>
                              <TableCell className="min-w-40">
                                {row.productName}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatNumber(row.quantity)}
                              </TableCell>
                              <TableCell className="text-right font-medium tabular-nums">
                                {formatNumber(row.amount)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {row.share.toFixed(1)}%
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>최근 등록된 데이터 10건</CardTitle>
                    <CardDescription>등록된 시각이 최근인 순</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table data-testid="recent-records">
                        <TableHeader>
                          <TableRow>
                            <TableHead>주문일</TableHead>
                            <TableHead>판매채널</TableHead>
                            <TableHead>제품명</TableHead>
                            <TableHead className="text-right">수량</TableHead>
                            <TableHead className="text-right">매출액</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.recent.map((row) => (
                            <TableRow key={row.id}>
                              <TableCell className="whitespace-nowrap">
                                {row.orderDate}
                              </TableCell>
                              <TableCell className="whitespace-nowrap">
                                {row.channel}
                              </TableCell>
                              <TableCell className="min-w-40">
                                {row.productName}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatNumber(row.quantity)}
                              </TableCell>
                              <TableCell className="text-right font-medium tabular-nums">
                                {formatNumber(row.amount)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  testId,
}: {
  label: string;
  value: string;
  hint?: string;
  testId: string;
}) {
  return (
    <Card>
      <CardContent className="space-y-1">
        <p className="text-muted-foreground text-sm">{label}</p>
        <p
          data-testid={testId}
          className="text-2xl font-semibold tabular-nums"
        >
          {value}
        </p>
        {hint ? (
          <p className="text-muted-foreground text-xs">{hint}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ChartCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
