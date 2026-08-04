import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";

// For server actions and API routes — uses service role / DATABASE_URL directly.
// All user-facing queries should go through the Supabase anon client so RLS applies.
const client = postgres(process.env.DATABASE_URL!, { max: 10 });
export const db = drizzle(client, { schema });
