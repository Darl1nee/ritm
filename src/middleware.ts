import { NextResponse, type NextRequest } from "next/server";
import { isAllowedHost, isAllowedOrigin } from "@/shared/hosts";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Базовая защита локального приложения:
 * - запросы только на разрешённые хосты (защита от DNS-rebinding);
 * - изменяющие запросы к API — только со своего Origin (защита от CSRF с чужих сайтов).
 * MCP-клиенты (Claude Code и т.п.) Origin не присылают — им это не мешает,
 * а доступ к /api/mcp дополнительно закрыт ключом.
 */
export function middleware(req: NextRequest) {
  if (!isAllowedHost(req.headers.get("host"))) {
    return new NextResponse("Forbidden host", { status: 403 });
  }

  if (req.nextUrl.pathname.startsWith("/api/") && !SAFE_METHODS.has(req.method)) {
    const origin = req.headers.get("origin");
    if (origin !== null && !isAllowedOrigin(origin)) {
      return NextResponse.json({ error: "Запрос с чужого сайта отклонён" }, { status: 403 });
    }
    if (req.headers.get("sec-fetch-site") === "cross-site") {
      return NextResponse.json({ error: "Запрос с чужого сайта отклонён" }, { status: 403 });
    }
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
