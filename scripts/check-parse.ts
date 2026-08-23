/** 샘플 엑셀이 파서로 제대로 읽히는지 확인 (터미널에서 직접 실행) */
import { readFileSync } from "node:fs";

import { parseSalesWorkbook } from "@/lib/excel";

const files = process.argv.slice(2);
for (const f of files) {
  const buf = readFileSync(f);
  const ab = buf.buffer.slice(
    buf.byteOffset,
    buf.byteOffset + buf.byteLength,
  ) as ArrayBuffer;
  const r = parseSalesWorkbook(ab);
  console.log(`\n=== ${f} ===`);
  console.log(
    "시트:", r.sheetName,
    "| 총행:", r.totalRows,
    "| 정상:", r.validRows.length,
    "| 오류행:", new Set(r.errors.map((e) => e.excelRow)).size,
  );
  console.log("첫 행:", JSON.stringify(r.validRows[0]));
  console.log("끝 행:", JSON.stringify(r.validRows[r.validRows.length - 1]));
  console.log(
    "매출 합계:",
    r.validRows.reduce((a, x) => a + x.amount, 0).toLocaleString(),
  );
  for (const e of r.errors.slice(0, 5)) {
    console.log(`  ${e.excelRow}행 ${e.column}: ${e.message} (값: ${e.value})`);
  }
}
