import { api, readJson, queryOf } from "@/server/http";
import { getDb } from "@/server/db/client";
import * as S from "@/server/services";
import * as Z from "@/shared/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = api((req) => S.listProjects(getDb(), Z.projectFiltersSchema.parse(queryOf(req))));
export const POST = api(async (req) => S.createProject(getDb(), Z.projectCreateSchema.parse(await readJson(req))), 201);
