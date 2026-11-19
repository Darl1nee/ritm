import path from "node:path";
import { createDb, type Db } from "./factory";

export type { Db };

const g = globalThis as unknown as { __ritmDb?: Db };

/** Синглтон подключения к БД (переживает hot-reload в dev). */
export function getDb(): Db {
  if (!g.__ritmDb) {
    const url = process.env.DATABASE_URL || `file:${path.join(process.cwd(), "data", "ritm.db")}`;
    const authToken = process.env.DATABASE_AUTH_TOKEN;
    g.__ritmDb = createDb(url, authToken);
  }
  return g.__ritmDb;
}
