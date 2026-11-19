import { api, readJson } from "@/server/http";
import { getDb } from "@/server/db/client";
import * as S from "@/server/services";
import * as Z from "@/shared/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = api(() => S.getSettings(getDb()));
export const PATCH = api(async (req) => S.updateSettings(getDb(), Z.settingsUpdateSchema.parse(await readJson(req))));
