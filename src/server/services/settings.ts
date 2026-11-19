import type { Db } from "../db/factory";
import { settings } from "../db/schema";
import { DEFAULT_SETTINGS, type Settings, type SettingsUpdate } from "@/shared/schemas";
import { nowIso } from "./common";

export async function getSettings(db: Db): Promise<Settings> {
  const rows = await db.select().from(settings).all();
  const out: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const r of rows) {
    try {
      out[r.key] = JSON.parse(r.value);
    } catch {
      /* битое значение — остаётся дефолт */
    }
  }
  return out as unknown as Settings;
}

export async function setSetting(db: Db, key: string, value: unknown): Promise<void> {
  const ts = nowIso();
  const json = JSON.stringify(value);
  await db
    .insert(settings)
    .values({ key, value: json, created_at: ts, updated_at: ts })
    .onConflictDoUpdate({ target: settings.key, set: { value: json, updated_at: ts } })
    .run();
}

export async function updateSettings(db: Db, patch: SettingsUpdate): Promise<Settings> {
  await db.transaction(async (tx) => {
    for (const [k, v] of Object.entries(patch)) {
      if (v !== undefined) await setSetting(tx as unknown as Db, k, v);
    }
  });
  return await getSettings(db);
}
