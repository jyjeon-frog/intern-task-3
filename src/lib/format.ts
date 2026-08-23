const TIME_ZONE = "Asia/Seoul";

function parts(date: Date, withTime: boolean) {
  const fmt = new Intl.DateTimeFormat("ko-KR", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", hour12: false } : {}),
  });
  const map: Record<string, string> = {};
  for (const p of fmt.formatToParts(date)) map[p.type] = p.value;
  return map;
}

/** 2026-05-01 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  const p = parts(d, false);
  return `${p.year}-${p.month}-${p.day}`;
}

/** 2026-05-01 14:30 */
export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "-";
  const d = typeof date === "string" ? new Date(date) : date;
  const p = parts(d, true);
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`;
}

/** 1,234,000 */
export function formatNumber(value: number | null | undefined): string {
  if (value == null) return "-";
  return value.toLocaleString("ko-KR");
}

/** 1,234,000원 */
export function formatWon(value: number | null | undefined): string {
  if (value == null) return "-";
  return `${value.toLocaleString("ko-KR")}원`;
}
