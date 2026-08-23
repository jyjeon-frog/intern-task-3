import { buildTemplateWorkbook } from "@/lib/excel";
import { requireAdminApi } from "@/lib/session";

// SheetJS 사용 → Node.js 런타임 고정
export const runtime = "nodejs";

/** 헤더와 예시 1행이 든 빈 엑셀 양식 내려주기 */
export async function GET() {
  const guard = await requireAdminApi();
  if (!guard.ok) return guard.response;

  const buffer = buildTemplateWorkbook();

  return new Response(buffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        'attachment; filename="veranova-sales-template.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
