import { api, readJson, queryOf } from "@/server/http";
import { getDb } from "@/server/db/client";
import * as S from "@/server/services";
import * as Z from "@/shared/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = api((req) => {
  const { from, to } = Z.eventRangeSchema.partial().parse(queryOf(req));
  return S.listFocus(getDb(), { from, to });
});
export const POST = api(async (req) => S.createFocus(getDb(), Z.focusCreateSchema.parse(await readJson(req))), 201);
