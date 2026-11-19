import path from "node:path";
import fs from "node:fs";
import { createClient } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "./schema";

export type Db = LibSQLDatabase<typeof schema>;

/**
 * Создаёт подключение к LibSQL / SQLite (Turso, local file или in-memory).
 * `url` — libsql://..., file:..., или :memory:
 */
export function createDb(url: string, authToken?: string): Db {
  if (url.startsWith("file:")) {
    const filePath = url.slice(5);
    if (filePath && filePath !== ":memory:") {
      fs.mkdirSync(path.dirname(path.resolve(filePath)), { recursive: true });
    }
  }
  const client = createClient({ url, authToken });
  return drizzle(client, { schema });
}

export async function runMigrations(db: Db): Promise<void> {
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
}
