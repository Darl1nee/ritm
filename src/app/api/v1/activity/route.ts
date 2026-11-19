import { z } from "zod";
import { api, queryOf } from "@/server/http";
import { getDb } from "@/server/db/client";
import { listActivity } from "@/server/services/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
  before: z.string().optional(),
});

export const GET = api((req) => listActivity(getDb(), querySchema.parse(queryOf(req))));
