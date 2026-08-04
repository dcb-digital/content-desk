/**
 * Back-fills any prompt key that a workspace is missing.
 *
 * Why this exists: a prompt key absent from the DB is a hard failure at
 * generation time — assemblePrompt throws "Active prompt <key> not found". So
 * whenever PROMPT_SEEDS gains a key, existing workspaces need it inserted, and
 * re-running the full seed isn't the answer: it touches users, clients and demo
 * data, and its version-1 insert would sit alongside an admin's UI-edited
 * version-2 row, leaving two active rows for one key.
 *
 * Rules: only keys with NO existing row are inserted. Bodies edited in the UI
 * are never overwritten. Safe to re-run.
 *
 * Run:  npx tsx src/db/sync-prompts.ts
 * Env:  DATABASE_URL
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { and, eq } from "drizzle-orm";
import * as schema from "./schema";
import { PROMPT_SEEDS } from "./prompt-seeds";

const { DATABASE_URL } = process.env;
if (!DATABASE_URL) throw new Error("DATABASE_URL is required");

const sql = postgres(DATABASE_URL, { max: 1 });
const db = drizzle(sql, { schema });

export async function syncPrompts(workspaceId: string, createdBy?: string) {
  const existing = await db
    .select({ key: schema.prompts.key })
    .from(schema.prompts)
    .where(eq(schema.prompts.workspaceId, workspaceId));

  const have = new Set(existing.map((r) => r.key));
  const missing = PROMPT_SEEDS.filter((p) => !have.has(p.key));

  for (const p of missing) {
    await db.insert(schema.prompts).values({
      workspaceId,
      key: p.key,
      version: 1,
      body: p.body,
      notes: p.notes,
      isActive: true,
      createdBy: createdBy ?? null,
    });
  }

  return { inserted: missing.map((p) => p.key), kept: [...have].sort() };
}

/** Flags a key with more than one active row — assemblePrompt would pick one at random. */
export async function findAmbiguousPrompts(workspaceId: string) {
  const active = await db
    .select({ key: schema.prompts.key, version: schema.prompts.version })
    .from(schema.prompts)
    .where(and(eq(schema.prompts.workspaceId, workspaceId), eq(schema.prompts.isActive, true)));

  const counts = new Map<string, number[]>();
  for (const row of active) {
    counts.set(row.key, [...(counts.get(row.key) ?? []), row.version]);
  }
  return [...counts.entries()]
    .filter(([, versions]) => versions.length > 1)
    .map(([key, versions]) => ({ key, versions: versions.sort() }));
}

async function main() {
  const workspaces = await db
    .select({ id: schema.workspaces.id, name: schema.workspaces.name })
    .from(schema.workspaces);

  for (const ws of workspaces) {
    const { inserted, kept } = await syncPrompts(ws.id);
    console.log(
      `${ws.name}: ${inserted.length ? `inserted ${inserted.join(", ")}` : "nothing missing"} (${kept.length} already present)`,
    );

    const ambiguous = await findAmbiguousPrompts(ws.id);
    for (const a of ambiguous) {
      console.warn(
        `  ⚠ "${a.key}" has ${a.versions.length} active rows (v${a.versions.join(", v")}) — deactivate all but one, generation picks arbitrarily`,
      );
    }

    const required = PROMPT_SEEDS.map((p) => p.key);
    const stillMissing = required.filter((k) => !kept.includes(k) && !inserted.includes(k));
    if (stillMissing.length) console.error(`  ✗ still missing: ${stillMissing.join(", ")}`);
  }
}

main()
  .then(() => sql.end())
  .catch(async (e) => {
    console.error(e);
    await sql.end();
    process.exit(1);
  });
