import { api, queryOf } from "@/server/http";
import { getDb } from "@/server/db/client";
import * as S from "@/server/services";
import * as Z from "@/shared/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = api((req) => S.search(getDb(), Z.searchSchema.parse(queryOf(req)).q));
