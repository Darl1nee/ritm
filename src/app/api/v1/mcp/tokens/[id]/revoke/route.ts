import { api, type IdCtx } from "@/server/http";
import { getDb } from "@/server/db/client";
import { revokeMcpToken } from "@/server/services/mcp-tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = api(async (_req, { params }: IdCtx) => revokeMcpToken(getDb(), (await params).id));
