import { z } from "zod";

/** 로그인 폼 */
export const loginSchema = z.object({
  loginId: z.string().trim().min(1, "아이디를 입력해주세요."),
  password: z.string().min(1, "비밀번호를 입력해주세요."),
});

export type LoginInput = z.infer<typeof loginSchema>;
