import path from "node:path";
import { createDb, type Db } from "./factory";
import { migrate } from "drizzle-orm/libsql/migrator";

/** Свежая in-memory БД с применёнными миграциями — для тестов. */
export async function createTestDb(): Promise<Db> {
  const db = createDb(":memory:");
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  return db;
}
