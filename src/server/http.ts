import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { NotFoundError } from "./services/common";

export type IdCtx = { params: Promise<{ id: string }> };

function errorResponse(e: unknown): NextResponse {
  if (e instanceof ZodError) {
    const msg = e.issues.map((i) => (i.path.length ? `${i.path.join(".")}: ` : "") + i.message).join("; ");
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  if (e instanceof NotFoundError) return NextResponse.json({ error: e.message }, { status: 404 });
  if (e instanceof RangeError || e instanceof SyntaxError) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
  console.error(e);
  return NextResponse.json({ error: "Внутренняя ошибка сервера" }, { status: 500 });
}

/** Оборачивает обработчик: результат → JSON, исключения → {error} с кодом 400/404/500. */
export function api<C = unknown>(
  fn: (req: Request, ctx: C) => unknown | Promise<unknown>,
  okStatus = 200,
) {
  return async (req: Request, ctx: C): Promise<NextResponse> => {
    try {
      return NextResponse.json(await fn(req, ctx), { status: okStatus });
    } catch (e) {
      return errorResponse(e);
    }
  };
}

/** Тело запроса как JSON (пустое/битое → SyntaxError → 400). */
export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new SyntaxError("Некорректный JSON в теле запроса");
  }
}

/** Query-параметры как объект; перечисленные ключи приводятся к boolean. */
export function queryOf(req: Request, booleans: string[] = []): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of new URL(req.url).searchParams) {
    if (v === "") continue;
    out[k] = booleans.includes(k) ? (v === "true" ? true : v === "false" ? false : v) : v;
  }
  return out;
}
