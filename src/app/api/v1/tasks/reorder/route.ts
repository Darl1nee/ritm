import { api, readJson } from "@/server/http";
import { getDb } from "@/server/db/client";
import * as S from "@/server/services";
import * as Z from "@/shared/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = api(async (req) => S.reorderTasks(getDb(), Z.taskReorderSchema.parse(await readJson(req))));
