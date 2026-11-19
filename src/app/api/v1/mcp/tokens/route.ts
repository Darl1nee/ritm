import { z } from "zod";
import { api, readJson } from "@/server/http";
import { getDb } from "@/server/db/client";
import { createMcpToken, listMcpTokens } from "@/server/services/mcp-tokens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({ name: z.string(), scopes: z.array(z.string()) });

export const GET = api(() => listMcpTokens(getDb()));
export const POST = api(async (req) => createMcpToken(getDb(), createSchema.parse(await readJson(req))), 201);
