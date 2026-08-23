import { z } from "zod";

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
