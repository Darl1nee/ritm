import { api, type IdCtx } from "@/server/http";
import { getDb } from "@/server/db/client";
import * as S from "@/server/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = api(async (_req, { params }: IdCtx) => S.toggleTask(getDb(), (await params).id));
