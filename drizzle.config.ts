import { defineConfig } from "drizzle-kit";

export default defineConfig(
  process.env.DATABASE_URL
    ? {
        dialect: "turso",
        schema: "./src/server/db/schema.ts",
        out: "./drizzle",
        dbCredentials: {
          url: process.env.DATABASE_URL,
          authToken: process.env.DATABASE_AUTH_TOKEN,
        },
      }
    : {
        dialect: "sqlite",
        schema: "./src/server/db/schema.ts",
        out: "./drizzle",
        dbCredentials: { url: "./data/ritm.db" },
      },
);
