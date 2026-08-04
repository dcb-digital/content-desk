/**
 * Content Desk — seed script
 * Creates: DCB workspace, admin users (Derek + Courtney), workspace settings,
 * feature flags, one demo client with knowledge docs + objectives,
 * and the versioned prompt library.
 *
 * Run:  npx tsx src/db/seed.ts
 * Env:  DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *       SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD (dev only)
 *
 * Idempotent-ish: safe to re-run (upserts by slug/email/key).
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { createClient } from "@supabase/supabase-js";
import { eq, and } from "drizzle-orm";
import * as schema from "./schema";
import { PROMPT_SEEDS } from "./prompt-seeds";

const {
  DATABASE_URL,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  SEED_ADMIN_EMAIL = "info@dcbdigital.com.au",
  SEED_ADMIN_PASSWORD,
} = process.env;

if (!DATABASE_URL || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing DATABASE_URL / SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
}
if (!SEED_ADMIN_PASSWORD) {
  throw new Error("Set SEED_ADMIN_PASSWORD (dev login password for the seed admin)");
}

const sql = postgres(DATABASE_URL, { max: 1 });
const db = drizzle(sql, { schema });
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/* ------------------------------------------------------------------ */

async function ensureAuthUser(email: string, fullName: string): Promise<string> {
  // find-or-create in Supabase auth, mirror into public.users
  const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const existing = list?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  let id = existing?.id;
  if (!id) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: SEED_ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error || !data.user) throw error ?? new Error("createUser failed");
    id = data.user.id;
  }
  await db
    .insert(schema.users)
    .values({ id, email, fullName })
    .onConflictDoUpdate({ target: schema.users.id, set: { fullName } });
  return id;
}


/* ------------------------------ Seed ------------------------------- */

async function main() {
  console.log("Seeding Content Desk…");

  // 1. Workspace
  const [ws] = await db
    .insert(schema.workspaces)
    .values({ name: "DCB Digital", slug: "dcb", theme: { accent: "#0F62FE" } })
    .onConflictDoUpdate({ target: schema.workspaces.slug, set: { name: "DCB Digital" } })
    .returning();
  console.log(`  workspace: ${ws.name} (${ws.id})`);

  // 2. Users + memberships
  const derekId = await ensureAuthUser(SEED_ADMIN_EMAIL, "Derek Burden");
  for (const [userId, role] of [[derekId, "admin"] as const]) {
    const existing = await db
      .select()
      .from(schema.memberships)
      .where(and(eq(schema.memberships.workspaceId, ws.id), eq(schema.memberships.userId, userId)));
    if (existing.length === 0) {
      await db.insert(schema.memberships).values({ workspaceId: ws.id, userId, role });
    }
  }
  console.log(`  admin: ${SEED_ADMIN_EMAIL}`);

  // 3. Settings (keys added later via UI, encrypted)
  await db
    .insert(schema.workspaceSettings)
    .values({ workspaceId: ws.id, defaultProvider: "anthropic", providers: {} })
    .onConflictDoNothing();

  // 4. Feature flags
  for (const key of ["wordpress_publish", "client_portal", "live_connectors", "stripe_billing"]) {
    await db
      .insert(schema.featureFlags)
      .values({ workspaceId: ws.id, key, enabled: false })
      .onConflictDoNothing();
  }

  // 5. Prompt library — insert missing keys only.
  // onConflictDoNothing targets (workspace_id, key, version), so a key edited in
  // the UI to version 2 would get a *second* active row at version 1 here, and
  // assemblePrompt would then pick between them arbitrarily. Match on key instead.
  const existingPromptKeys = new Set(
    (
      await db
        .select({ key: schema.prompts.key })
        .from(schema.prompts)
        .where(eq(schema.prompts.workspaceId, ws.id))
    ).map((r) => r.key),
  );

  const newPrompts = PROMPT_SEEDS.filter((p) => !existingPromptKeys.has(p.key));
  for (const p of newPrompts) {
    await db.insert(schema.prompts).values({
      workspaceId: ws.id,
      key: p.key,
      version: 1,
      body: p.body,
      notes: p.notes,
      isActive: true,
      createdBy: derekId,
    });
  }
  console.log(
    `  prompts: ${newPrompts.length} added, ${existingPromptKeys.size} left untouched` +
      (newPrompts.length ? ` (${newPrompts.map((p) => p.key).join(", ")})` : ""),
  );

  // 6. Demo client (fictional — replace with a real DCB client on day 1)
  const existingClient = await db
    .select()
    .from(schema.clients)
    .where(and(eq(schema.clients.workspaceId, ws.id), eq(schema.clients.name, "Harbour Family Law (Demo)")));

  let clientId: string;
  if (existingClient.length > 0) {
    clientId = existingClient[0].id;
  } else {
    const [client] = await db
      .insert(schema.clients)
      .values({
        workspaceId: ws.id,
        name: "Harbour Family Law (Demo)",
        domain: "harbourfamilylaw.example.com.au",
        industry: "family_law",
        locale: "en-AU",
        notes: "Demo client for testing the full pipeline. Fictional.",
      })
      .returning();
    clientId = client.id;

    // Knowledge docs
    await db.insert(schema.knowledgeDocs).values([
      {
        workspaceId: ws.id,
        clientId,
        title: "Brand voice",
        type: "brand_voice",
        pinned: true,
        tokenEstimate: 220,
        bodyMd: `# Brand voice\n\nCalm, plain-English, reassuring. Clients are stressed — never sensationalise.\n\n- Short sentences. No legalese without a plain-English explanation.\n- First person plural ("we"), address the reader as "you".\n- Empathetic but practical: acknowledge the situation, move to what to do next.\n- Avoid: "fight", "battle", "win big", fear-based hooks.\n`,
      },
      {
        workspaceId: ws.id,
        clientId,
        title: "Services",
        type: "services",
        pinned: true,
        tokenEstimate: 180,
        bodyMd: `# Services\n\n- Divorce & separation advice\n- Parenting arrangements & children's matters\n- Property settlement\n- Binding financial agreements\n- Mediation & family dispute resolution\n\nService area: Brisbane CBD + North Brisbane suburbs. Fixed-fee initial consultation.\n`,
      },
      {
        workspaceId: ws.id,
        clientId,
        title: "Banned claims",
        type: "banned_claims",
        pinned: true,
        tokenEstimate: 120,
        bodyMd: `# Banned claims\n\n- NEVER guarantee outcomes ("you will get the house", "guaranteed custody").\n- NEVER give specific legal advice in content — general information only, with a disclaimer.\n- NEVER cite success rates or win percentages.\n- NEVER name opposing firms or compare us to named competitors.\n- Required disclaimer on every post: "This is general information, not legal advice."\n`,
      },
      {
        workspaceId: ws.id,
        clientId,
        title: "Proof & case studies",
        type: "proof_case_studies",
        pinned: false,
        tags: ["proof", "trust"],
        tokenEstimate: 90,
        bodyMd: `# Proof points\n\n- 15+ years combined family law experience (verified)\n- Accredited Family Dispute Resolution practitioner on staff (verified)\n- 40+ five-star Google reviews (verified as of Jul 2026)\n`,
      },
    ]);

    // Objectives
    await db.insert(schema.objectives).values({
      workspaceId: ws.id,
      clientId,
      isCurrent: true,
      data: {
        primaryGoal: "more_enquiries",
        successMetric: "Qualified enquiries for property settlement matters",
        numericTarget: 8,
        priorityServices: ["Property settlement", "Parenting arrangements"],
        priorityLocations: ["Brisbane CBD", "North Brisbane"],
        audienceNotes: "35–55, recently separated, searching late at night on mobile, anxious and time-poor.",
        constraints: "Legal content rules — see banned claims doc. Every post needs the general-information disclaimer.",
        freeText: "Property settlement is the highest-value matter type; prioritise it over divorce basics content.",
      },
      summaryMd:
        "Harbour Family Law wants more qualified property-settlement enquiries (target: 8/month) from Brisbane CBD and North Brisbane. Content should reassure anxious, recently separated 35–55s and always carry the general-information disclaimer. Property settlement outranks all other topics in priority.",
    });
    console.log("  demo client: Harbour Family Law (Demo) + 4 knowledge docs + objectives");
  }

  console.log("Done. Log in with the seed admin and start Week 1.");
  await sql.end();
}

main().catch(async (e) => {
  console.error(e);
  await sql.end();
  process.exit(1);
});
