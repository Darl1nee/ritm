import { api, readJson, type IdCtx } from "@/server/http";
import { getDb } from "@/server/db/client";
import * as S from "@/server/services";
import * as Z from "@/shared/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = api(async (_req, { params }: IdCtx) => S.getProject(getDb(), (await params).id));
export const PATCH = api(async (req, { params }: IdCtx) =>
  S.updateProject(getDb(), (await params).id, Z.projectUpdateSchema.parse(await readJson(req))),
);
export const DELETE = api(async (_req, { params }: IdCtx) => S.deleteProject(getDb(), (await params).id));
