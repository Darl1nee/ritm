import { api, readJson, queryOf } from "@/server/http";
import { getDb } from "@/server/db/client";
import * as S from "@/server/services";
import * as Z from "@/shared/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = api((req) => S.listNotes(getDb(), Z.noteFiltersSchema.parse(queryOf(req))));
export const POST = api(async (req) => S.createNote(getDb(), Z.noteCreateSchema.parse(await readJson(req))), 201);
