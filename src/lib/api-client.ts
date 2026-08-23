export type ApiError = {
  message: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

/**
 * 화면에서 우리 API를 부를 때 쓰는 얇은 래퍼.
 * 실패하면 서버가 보낸 한국어 메시지를 그대로 던진다.
 */
export async function callApi<T = unknown>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });

  let data: Record<string, unknown> = {};
  try {
    data = await res.json();
  } catch {
    // 본문이 없을 수 있다
  }

  if (!res.ok) {
    const error: ApiError = {
      message:
        typeof data.error === "string"
          ? data.error
          : "요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.",
      fieldErrors: data.fieldErrors as ApiError["fieldErrors"],
    };
    throw error;
  }

  return data as T;
}

export function errorMessage(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) {
    return String((e as ApiError).message);
  }
  return "요청을 처리하지 못했습니다.";
}
