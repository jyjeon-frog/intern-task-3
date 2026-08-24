"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { formatNumber, formatWon } from "@/lib/format";
import type { NamedValue } from "@/lib/dashboard";

/**
 * 색상은 globals.css 의 --chart-1..5 를 쓴다.
 * 색각 이상 상황에서도 인접 색이 구분되는지 검증한 팔레트다.
 * 색만으로 구분되지 않도록 파이/도넛에는 항상 이름과 비율을 직접 적는다.
 */
const SERIES = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const AXIS = "var(--muted-foreground)";
const GRID = "var(--border)";

/** 축 눈금용 짧은 금액 표기 (1,200,000 → 120만) */
function shortWon(value: number): string {
  if (value >= 100_000_000) return `${Math.round(value / 100_000_000)}억`;
  if (value >= 10_000) return `${Math.round(value / 10_000)}만`;
  return formatNumber(value);
}

function TooltipBox({
  label,
  rows,
}: {
  label: string;
  rows: { name: string; value: string }[];
}) {
  return (
    <div className="bg-popover rounded-lg border px-3 py-2 text-sm shadow-md">
      <p className="font-medium">{label}</p>
      {rows.map((row) => (
        <p key={row.name} className="text-muted-foreground">
          {row.name}: <span className="text-foreground">{row.value}</span>
        </p>
      ))}
    </div>
  );
}

type TooltipPayload = {
  active?: boolean;
  payload?: readonly { payload?: unknown }[];
};

/* ------------------------------------------------------------------ */
/* 1. 일별 매출 추이                                                     */
/* ------------------------------------------------------------------ */

export function DailyTrendChart({
  data,
}: {
  data: { date: string; label: string; amount: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 4 }}>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          stroke={AXIS}
          fontSize={12}
          tickLine={false}
          axisLine={{ stroke: GRID }}
          minTickGap={24}
        />
        <YAxis
          stroke={AXIS}
          fontSize={12}
          tickLine={false}
          axisLine={false}
          width={48}
          tickFormatter={shortWon}
        />
        <Tooltip
          content={({ active, payload }: TooltipPayload) => {
            if (!active || !payload?.length) return null;
            const row = payload[0].payload as {
              date: string;
              amount: number;
            };
            return (
              <TooltipBox
                label={row.date}
                rows={[{ name: "매출액", value: formatWon(row.amount) }]}
              />
            );
          }}
        />
        <Line
          type="monotone"
          dataKey="amount"
          stroke={SERIES[0]}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--background)" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------------ */
/* 2. 채널별 매출 (막대)                                                 */
/* ------------------------------------------------------------------ */

export function ChannelBarChart({ data }: { data: NamedValue[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(260, data.length * 38)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 16, bottom: 4, left: 4 }}
        barCategoryGap={6}
      >
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" horizontal={false} />
        <XAxis
          type="number"
          stroke={AXIS}
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={shortWon}
        />
        <YAxis
          type="category"
          dataKey="name"
          stroke={AXIS}
          fontSize={12}
          tickLine={false}
          axisLine={false}
          width={124}
        />
        <Tooltip
          cursor={{ fill: "var(--muted)" }}
          content={({ active, payload }: TooltipPayload) => {
            if (!active || !payload?.length) return null;
            const row = payload[0].payload as NamedValue;
            return (
              <TooltipBox
                label={row.name}
                rows={[{ name: "매출액", value: formatWon(row.value) }]}
              />
            );
          }}
        />
        <Bar dataKey="value" fill={SERIES[0]} radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/* ------------------------------------------------------------------ */
/* 3·4. 비중 (도넛 / 파이)                                               */
/* ------------------------------------------------------------------ */

function ShareChart({
  data,
  innerRadius,
  testId,
}: {
  data: NamedValue[];
  innerRadius: number;
  testId: string;
}) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="space-y-3">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={innerRadius}
            outerRadius={80}
            paddingAngle={2}
            stroke="var(--background)"
            strokeWidth={2}
            isAnimationActive={false}
          >
            {data.map((entry, index) => (
              <Cell
                key={entry.name}
                fill={SERIES[index % SERIES.length]}
              />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }: TooltipPayload) => {
              if (!active || !payload?.length) return null;
              const row = payload[0].payload as NamedValue;
              const share = total > 0 ? (row.value / total) * 100 : 0;
              return (
                <TooltipBox
                  label={row.name}
                  rows={[
                    { name: "매출액", value: formatWon(row.value) },
                    { name: "비중", value: `${share.toFixed(1)}%` },
                  ]}
                />
              );
            }}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* 색만으로 구분되지 않도록 이름·금액·비중을 표로 함께 적는다 */}
      <ul className="space-y-1 text-sm" data-testid={testId}>
        {data.map((entry, index) => {
          const share = total > 0 ? (entry.value / total) * 100 : 0;
          return (
            <li key={entry.name} className="flex items-center gap-2">
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-full"
                style={{ background: SERIES[index % SERIES.length] }}
              />
              <span className="flex-1 truncate">{entry.name}</span>
              <span className="text-muted-foreground tabular-nums">
                {formatNumber(entry.value)}
              </span>
              <span className="w-14 text-right font-medium tabular-nums">
                {share.toFixed(1)}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function CategoryDonutChart({ data }: { data: NamedValue[] }) {
  return <ShareChart data={data} innerRadius={48} testId="category-share" />;
}

export function CustomerTypePieChart({ data }: { data: NamedValue[] }) {
  return <ShareChart data={data} innerRadius={0} testId="customer-share" />;
}
