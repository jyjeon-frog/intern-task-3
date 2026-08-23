import * as XLSX from "xlsx";

import { salesRecordSchema, type SalesRecordInput } from "@/lib/validation";

/* ------------------------------------------------------------------ */
/* 컬럼 이름 인식 (공백 제거 · 대소문자 무시 · 별칭 허용)                 */
/* ------------------------------------------------------------------ */

export const COLUMN_LABELS = {
  orderDate: "주문일",
  channel: "판매채널",
  region: "지역",
  productName: "제품명",
  category: "카테고리",
  quantity: "수량",
  unitPrice: "단가",
  amount: "매출액",
  customerType: "고객유형",
} as const;

export type ColumnKey = keyof typeof COLUMN_LABELS;

const COLUMN_ALIASES: Record<ColumnKey, string[]> = {
  orderDate: ["주문일", "날짜", "일자", "주문날짜", "판매일", "orderdate", "date"],
  channel: ["판매채널", "채널", "판매처", "채널명", "channel"],
  region: ["지역", "국가", "region", "country"],
  productName: ["제품명", "상품명", "제품", "상품", "품목", "productname", "product"],
  category: ["카테고리", "분류", "제품카테고리", "category"],
  quantity: ["수량", "개수", "판매수량", "quantity", "qty"],
  unitPrice: ["단가", "가격", "판매가", "unitprice", "price"],
  amount: ["매출액", "금액", "매출", "판매금액", "amount", "sales", "revenue"],
  customerType: ["고객유형", "고객구분", "고객타입", "customertype"],
};

/** 매출액은 비어 있어도 되지만(수량 x 단가로 계산), 나머지는 반드시 있어야 한다 */
const REQUIRED_COLUMNS: ColumnKey[] = [
  "orderDate",
  "channel",
  "region",
  "productName",
  "category",
  "quantity",
  "unitPrice",
  "customerType",
];

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, "")
    .replace(/[()[\]{}._-]/g, "")
    .toLowerCase();
}

const ALIAS_LOOKUP: Map<string, ColumnKey> = new Map();
for (const [key, aliases] of Object.entries(COLUMN_ALIASES)) {
  for (const alias of aliases) {
    ALIAS_LOOKUP.set(normalizeHeader(alias), key as ColumnKey);
  }
}

/* ------------------------------------------------------------------ */
/* 값 변환                                                              */
/* ------------------------------------------------------------------ */

const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);

/** 엑셀 날짜(숫자 시리얼) 또는 여러 형태의 날짜 문자열을 YYYY-MM-DD 로 */
export function toDateString(value: unknown): string | null {
  if (value == null || value === "") return null;

  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, "0");
    const d = String(value.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    // 엑셀은 1899-12-30 을 0 으로 세는 일련번호로 날짜를 저장한다
    if (value < 1 || value > 200000) return null;
    const date = new Date(EXCEL_EPOCH_UTC + Math.floor(value) * 86400000);
    return date.toISOString().slice(0, 10);
  }

  const text = String(value).trim();
  // 2026.05.01 / 2026/5/1 / 2026-5-1 모두 허용
  const parts = text.replace(/[./]/g, "-").match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (parts) {
    const [, y, m, d] = parts;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // 20260501
  const compact = text.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`;

  return null;
}

/** "28,000원" 같은 값도 숫자로 */
export function toNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  const text = String(value)
    .replace(/[,\s]/g, "")
    .replace(/원$/, "");
  if (text === "") return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function toText(value: unknown): string {
  return String(value ?? "").trim();
}

/* ------------------------------------------------------------------ */
/* 파싱                                                                 */
/* ------------------------------------------------------------------ */

export type ParsedRow = {
  excelRow: number;
  data: SalesRecordInput;
  amount: number;
};

export type RowError = {
  excelRow: number;
  column: string;
  message: string;
  value: string;
};

export type ParseResult = {
  sheetName: string;
  totalRows: number;
  validRows: ParsedRow[];
  errors: RowError[];
  /** 필수 컬럼이 없으면 여기에 담기고, 행 검사는 하지 않는다 */
  missingColumns: string[];
};

export function parseSalesWorkbook(buffer: ArrayBuffer): ParseResult {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: false });
  const sheetName = workbook.SheetNames[0];
  const empty: ParseResult = {
    sheetName: sheetName ?? "",
    totalRows: 0,
    validRows: [],
    errors: [],
    missingColumns: [],
  };
  if (!sheetName) return empty;

  const sheet = workbook.Sheets[sheetName];
  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: null,
    blankrows: true,
  });

  // 머리글 줄 찾기 (앞부분에 안내 문구가 있어도 되도록 위에서 5줄까지 훑는다)
  let headerIndex = -1;
  let mapping: Map<number, ColumnKey> = new Map();
  for (let i = 0; i < Math.min(grid.length, 5); i++) {
    const candidate = new Map<number, ColumnKey>();
    (grid[i] ?? []).forEach((cell, col) => {
      const key = ALIAS_LOOKUP.get(normalizeHeader(cell));
      if (key && ![...candidate.values()].includes(key)) candidate.set(col, key);
    });
    if (candidate.size >= 4) {
      headerIndex = i;
      mapping = candidate;
      break;
    }
  }

  if (headerIndex === -1) {
    return {
      ...empty,
      missingColumns: REQUIRED_COLUMNS.map((k) => COLUMN_LABELS[k]),
    };
  }

  const found = new Set(mapping.values());
  const missingColumns = REQUIRED_COLUMNS.filter((k) => !found.has(k)).map(
    (k) => COLUMN_LABELS[k],
  );
  if (missingColumns.length > 0) {
    return { ...empty, missingColumns };
  }

  const columnOf = (key: ColumnKey): number | undefined => {
    for (const [col, k] of mapping) if (k === key) return col;
    return undefined;
  };
  const cols = Object.fromEntries(
    (Object.keys(COLUMN_LABELS) as ColumnKey[]).map((k) => [k, columnOf(k)]),
  ) as Record<ColumnKey, number | undefined>;

  const validRows: ParsedRow[] = [];
  const errors: RowError[] = [];
  let totalRows = 0;

  for (let i = headerIndex + 1; i < grid.length; i++) {
    const row = grid[i] ?? [];
    const excelRow = i + 1; // 엑셀 화면의 행 번호 (1부터)

    const cell = (key: ColumnKey) => {
      const col = cols[key];
      return col === undefined ? null : (row[col] ?? null);
    };

    // 전부 빈 줄은 건너뛴다
    const isBlank = (Object.keys(COLUMN_LABELS) as ColumnKey[]).every((k) => {
      const v = cell(k);
      return v == null || String(v).trim() === "";
    });
    if (isBlank) continue;

    totalRows += 1;

    const rowErrors: RowError[] = [];
    const push = (column: string, message: string, value: unknown) =>
      rowErrors.push({
        excelRow,
        column,
        message,
        value: value == null ? "(비어 있음)" : String(value),
      });

    const orderDate = toDateString(cell("orderDate"));
    if (!orderDate) {
      push(
        COLUMN_LABELS.orderDate,
        "날짜를 읽을 수 없습니다. YYYY-MM-DD 형식으로 넣어주세요.",
        cell("orderDate"),
      );
    }

    const quantityRaw = cell("quantity");
    const quantity = toNumber(quantityRaw);
    if (quantity == null) {
      push(COLUMN_LABELS.quantity, "수량이 숫자가 아닙니다.", quantityRaw);
    }

    const unitPriceRaw = cell("unitPrice");
    const unitPrice = toNumber(unitPriceRaw);
    if (unitPrice == null) {
      push(COLUMN_LABELS.unitPrice, "단가가 숫자가 아닙니다.", unitPriceRaw);
    }

    const candidate = {
      orderDate: orderDate ?? "",
      channel: toText(cell("channel")),
      region: toText(cell("region")),
      productName: toText(cell("productName")),
      category: toText(cell("category")),
      quantity: quantity ?? Number.NaN,
      unitPrice: unitPrice ?? Number.NaN,
      customerType: toText(cell("customerType")),
    };

    const parsed = salesRecordSchema.safeParse(candidate);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as ColumnKey | undefined;
        if (!key) continue;
        // 위에서 이미 짚어준 항목은 중복해서 넣지 않는다
        const label = COLUMN_LABELS[key] ?? String(key);
        if (rowErrors.some((e) => e.column === label)) continue;
        push(label, issue.message, cell(key));
      }
    }

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      continue;
    }

    const data = parsed.success ? parsed.data : null;
    if (!data) continue;

    validRows.push({
      excelRow,
      data,
      // 매출액은 파일 값과 상관없이 항상 수량 x 단가로 다시 계산한다
      amount: data.quantity * data.unitPrice,
    });
  }

  return { sheetName, totalRows, validRows, errors, missingColumns: [] };
}

/* ------------------------------------------------------------------ */
/* 양식 파일 만들기                                                      */
/* ------------------------------------------------------------------ */

export function buildTemplateWorkbook(): ArrayBuffer {
  const header = [
    COLUMN_LABELS.orderDate,
    COLUMN_LABELS.channel,
    COLUMN_LABELS.region,
    COLUMN_LABELS.productName,
    COLUMN_LABELS.category,
    COLUMN_LABELS.quantity,
    COLUMN_LABELS.unitPrice,
    COLUMN_LABELS.amount,
    COLUMN_LABELS.customerType,
  ];
  const example = [
    "2026-05-01",
    "쿠팡",
    "국내",
    "VN 하이드라 세럼 30ml",
    "스킨케어",
    2,
    28000,
    56000,
    "신규",
  ];

  const sheet = XLSX.utils.aoa_to_sheet([header, example]);
  sheet["!cols"] = header.map((h) => ({ wch: Math.max(12, h.length * 2) }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "판매데이터");

  return XLSX.write(workbook, { type: "array", bookType: "xlsx" });
}
