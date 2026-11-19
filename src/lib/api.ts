/** Fetch-клиент для /api/v1. Ошибки сервера `{ error }` превращаются в ApiError. */

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const BASE = "/api/v1";

type Query = Record<string, string | number | boolean | null | undefined>;

export function qs(params?: Query): string {
  if (!params) return "";
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

async function request<T>(method: string, path: string, body?: unknown, query?: Query): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}${qs(query)}`, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("Нет соединения с сервером", 0);
  }
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* пустое тело */
  }
  if (!res.ok) {
    const msg =
      data && typeof data === "object" && "error" in data ? String((data as { error: unknown }).error) : res.statusText;
    throw new ApiError(msg || "Ошибка запроса", res.status);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string, query?: Query) => request<T>("GET", path, undefined, query),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body ?? {}),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
  del: <T>(path: string) => request<T>("DELETE", path),
};
