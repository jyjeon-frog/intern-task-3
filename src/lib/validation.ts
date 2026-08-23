import { z } from "zod";

import {
  CATEGORIES,
  CHANNELS,
  CUSTOMER_TYPES,
  REGIONS,
} from "@/lib/sales";

/** 로그인 폼 */
export const loginSchema = z.object({
  loginId: z.string().trim().min(1, "아이디를 입력해주세요."),
  password: z.string().min(1, "비밀번호를 입력해주세요."),
});

export type LoginInput = z.infer<typeof loginSchema>;

/* ------------------------------------------------------------------ */
/* 계정 관리                                                            */
/* ------------------------------------------------------------------ */

const passwordField = z
  .string()
  .min(8, "비밀번호는 8자 이상이어야 합니다.")
  .max(72, "비밀번호는 72자 이하여야 합니다."); // bcrypt 입력 한도

export const roleField = z.enum(["ADMIN", "USER"], {
  message: "등급을 선택해주세요.",
});

export const createAccountSchema = z.object({
  loginId: z
    .string()
    .trim()
    .min(3, "아이디는 3자 이상이어야 합니다.")
    .max(20, "아이디는 20자 이하여야 합니다.")
    .regex(
      /^[a-zA-Z0-9._-]+$/,
      "아이디는 영문, 숫자, . _ - 만 쓸 수 있습니다.",
    ),
  name: z
    .string()
    .trim()
    .min(1, "이름을 입력해주세요.")
    .max(30, "이름은 30자 이하여야 합니다."),
  role: roleField,
  password: passwordField,
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;

/** 권한 변경 / 활성 전환 / 비밀번호 초기화 — 한 번에 하나만 보낸다 */
export const updateAccountSchema = z
  .object({
    role: roleField.optional(),
    isActive: z.boolean().optional(),
    password: passwordField.optional(),
  })
  .refine(
    (v) =>
      [v.role, v.isActive, v.password].filter((x) => x !== undefined).length ===
      1,
    { message: "변경할 항목을 하나만 보내주세요." },
  );

export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;

/* ------------------------------------------------------------------ */
/* 판매 데이터                                                          */
/* ------------------------------------------------------------------ */

export const salesRecordSchema = z.object({
  orderDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "주문일은 YYYY-MM-DD 형식이어야 합니다.")
    .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), {
      message: "주문일이 실제 날짜가 아닙니다.",
    }),
  channel: z.enum(CHANNELS, { message: "판매채널이 목록에 없는 값입니다." }),
  region: z.enum(REGIONS, { message: "지역이 목록에 없는 값입니다." }),
  productName: z
    .string()
    .trim()
    .min(1, "제품명을 입력해주세요.")
    .max(100, "제품명은 100자 이하여야 합니다."),
  category: z.enum(CATEGORIES, { message: "카테고리가 목록에 없는 값입니다." }),
  quantity: z
    .number({ message: "수량이 숫자가 아닙니다." })
    .int("수량은 정수여야 합니다.")
    .min(1, "수량은 1 이상이어야 합니다.")
    .max(1_000_000, "수량이 너무 큽니다."),
  unitPrice: z
    .number({ message: "단가가 숫자가 아닙니다." })
    .int("단가는 정수여야 합니다.")
    .min(0, "단가는 0 이상이어야 합니다.")
    .max(100_000_000, "단가가 너무 큽니다."),
  customerType: z.enum(CUSTOMER_TYPES, {
    message: "고객유형이 목록에 없는 값입니다.",
  }),
});

export type SalesRecordInput = z.infer<typeof salesRecordSchema>;

/** 다중 삭제 */
export const deleteManySchema = z.object({
  ids: z
    .array(z.string().min(1))
    .min(1, "삭제할 항목을 선택해주세요.")
    .max(1000, "한 번에 1000건까지 삭제할 수 있습니다."),
});
