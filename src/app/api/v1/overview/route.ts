import { api } from "@/server/http";
import { getDb } from "@/server/db/client";
import * as S from "@/server/services";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = api(() => S.getOverview(getDb()));
