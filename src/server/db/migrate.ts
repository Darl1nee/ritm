import { getDb } from "./client";
import { runMigrations } from "./factory";

async function main() {
  console.log("Applying migrations...");
  await runMigrations(getDb());
  console.log("Migrations applied successfully!");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
