import { api, readJson, type IdCtx } from "@/server/http";
import { getDb } from "@/server/db/client";
import * as S from "@/server/services";
import * as Z from "@/shared/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = api(
  async (req, { params }: IdCtx) =>
    S.createSection(getDb(), (await params).id, Z.sectionCreateSchema.parse(await readJson(req))),
  201,
);
