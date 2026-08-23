import { handlers } from "@/lib/auth";

// bcrypt / Prisma 가 동작해야 하므로 반드시 Node.js 런타임
export const runtime = "nodejs";

export const { GET, POST } = handlers;
