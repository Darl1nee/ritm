import { api, type IdCtx } from "@/server/http";
import { getDb } from "@/server/db/client";
import { undoActivity } from "@/server/services/activity";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = api(async (_req, { params }: IdCtx) => undoActivity(getDb(), (await params).id));
