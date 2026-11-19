import type { Db } from "../db/factory";
import { verifyMcpToken, type McpToken } from "../services/mcp-tokens";
import { isAllowedHost, isAllowedOrigin } from "@/shared/hosts";

export type McpAuthResult = { ok: true; token: McpToken } | { ok: false; response: Response };

function deny(status: 401 | 403, message: string): McpAuthResult {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (status === 401) headers["www-authenticate"] = 'Bearer realm="ritm", error="invalid_token"';
  // Формат ошибки JSON-RPC, чтобы MCP-клиенты показали понятный текст.
  const body = JSON.stringify({ jsonrpc: "2.0", error: { code: -32001, message }, id: null });
  return { ok: false, response: new Response(body, { status, headers }) };
}

/**
 * Проверка запроса к /api/mcp:
 * 1) Host и Origin — защита от DNS-rebinding (требование спецификации MCP для HTTP-транспорта);
 * 2) Authorization: Bearer <ключ> — активный, не отозванный ключ.
 */
export async function authenticateMcpRequest(db: Db, req: Request): Promise<McpAuthResult> {
  if (!isAllowedHost(req.headers.get("host"))) return deny(403, "Недопустимый Host");
  const origin = req.headers.get("origin");
  if (origin !== null && !isAllowedOrigin(origin)) return deny(403, "Недопустимый Origin");

  const header = req.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  if (!match) return deny(401, "Нужен ключ доступа: заголовок Authorization: Bearer <ключ>");

  const token = await verifyMcpToken(db, match[1]);
  if (!token) return deny(401, "Ключ недействителен или отозван");
  return { ok: true, token };
}
