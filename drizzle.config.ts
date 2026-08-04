import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    // Supabase: use the "Session pooler" connection string for migrations
    url: process.env.DATABASE_URL!,
  },
  strict: true,
  verbose: true,
});
