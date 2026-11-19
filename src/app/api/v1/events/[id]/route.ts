import { api, readJson, type IdCtx } from "@/server/http";
import { getDb } from "@/server/db/client";
import * as S from "@/server/services";
import * as Z from "@/shared/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const PATCH = api(async (req, { params }: IdCtx) =>
  S.updateEvent(getDb(), (await params).id, Z.eventUpdateSchema.parse(await readJson(req))),
);
export const DELETE = api(async (_req, { params }: IdCtx) => S.deleteEvent(getDb(), (await params).id));
