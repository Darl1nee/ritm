import { z } from "zod";
import { api, readJson, type IdCtx } from "@/server/http";
import { getDb } from "@/server/db/client";
import { deleteMcpToken, updateMcpToken } from "@/server/services/mcp-tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.object({ name: z.string().optional(), scopes: z.array(z.string()).optional() });

export const PATCH = api(async (req, { params }: IdCtx) =>
  updateMcpToken(getDb(), (await params).id, patchSchema.parse(await readJson(req))),
);
export const DELETE = api(async (_req, { params }: IdCtx) => {
  deleteMcpToken(getDb(), (await params).id);
  return { ok: true };
});
