import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { getDb } from "@/server/db/client";
import { authenticateMcpRequest } from "@/server/mcp/auth";
import { createRitmMcpServer } from "@/server/mcp/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Stateless: на каждый запрос — свой сервер и транспорт; права берутся из ключа. */
async function handle(req: Request): Promise<Response> {
  const db = getDb();
  const auth = await authenticateMcpRequest(db, req);
  if (!auth.ok) return auth.response;

  const server = createRitmMcpServer({ db, token: auth.token });
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  const res = await transport.handleRequest(req, {
    authInfo: { token: "", clientId: auth.token.id, scopes: auth.token.scopes },
  });
  // Потоковые ответы (SSE) закроются сами; обычные JSON-ответы уже готовы.
  if (!(res.headers.get("content-type") ?? "").includes("text/event-stream")) {
    void server.close().catch(() => {});
  }
  return res;
}

/**
 * В stateless-режиме нет сессий и серверных стримов: GET (SSE) и DELETE (закрытие сессии)
 * не нужны. Отвечаем 405, как разрешает спецификация, иначе GET висел бы открытым.
 */
async function notAllowed(req: Request): Promise<Response> {
  const auth = await authenticateMcpRequest(getDb(), req);
  if (!auth.ok) return auth.response;
  return new Response(
    JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message: "Метод не поддерживается: используйте POST" }, id: null }),
    { status: 405, headers: { "content-type": "application/json", allow: "POST" } },
  );
}

export const POST = handle;
export const GET = notAllowed;
export const DELETE = notAllowed;
