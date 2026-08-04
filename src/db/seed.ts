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

/* ------------------------------ Prompts ---------------------------- */

const PROMPT_SEEDS: { key: string; notes: string; body: string }[] = [
  {
    key: "system_rules",
    notes: "Injected first into every generation. The iron rules.",
    body: `You are Content Desk, the content production engine for an SEO agency.

Non-negotiable rules:
1. AU English (en-AU) spelling and conventions unless the client locale says otherwise.
2. NEVER invent statistics, rankings, dates, prices, or client facts. Every number must come from the EVIDENCE or KNOWLEDGE sections of this prompt. If you need a figure you don't have, write [NEEDS DATA: description] instead.
3. Respect the client's banned claims and constraints absolutely.
4. Write for E-E-A-T: demonstrate experience and expertise, cite the client's real proof points, no filler.
5. No AI clichés ("in today's fast-paced world", "unlock", "delve", "game-changer"). Write like a sharp human specialist.
6. Match the brand voice document when provided. When absent, default to plain, confident, helpful Australian professional.
7. Structure for search: one clear primary keyword focus per piece, natural placement in title/H1/opening, semantic coverage of the topic — never keyword stuffing.`,
  },
  {
    key: "task_plan",
    notes: "Generates a content plan from objectives + opportunities.",
    body: `TASK: Create a content plan.

Inputs provided above: objectives snapshot, opportunities (with evidence), horizon ({{horizonDays}} days from {{startDate}}), frequency ({{frequency}}), focus mode ({{focusMode}}).

Produce a JSON array of plan items. Each item:
{ "scheduledDate": "YYYY-MM-DD", "type": "post|page|refresh", "workingTitle": "...", "targetKeyword": "...", "searchIntent": "informational|commercial|transactional|local", "targetUrl": "only for refresh", "opportunityIds": ["..."], "rationale": "one sentence tying this to an objective or opportunity" }

Rules:
- Item count must match the requested frequency across the horizon (±1).
- opportunities-first mode: highest-score opportunities become items first; fill remainder from objectives.
- Spread dates realistically across the horizon (respect posts/week pacing).
- Never schedule two items targeting the same primary keyword.
- Only reference opportunityIds that were provided. If none fit, use [] and say so in rationale.`,
  },
  {
    key: "task_brief",
    notes: "Generates a content brief for one plan item.",
    body: `TASK: Write a content brief for the plan item above.

Output JSON:
{ "primaryKeyword": "...", "secondaryKeywords": ["..."], "searchIntent": "...", "audience": "...", "angle": "one sentence on the unique angle", "outline": [{ "heading": "H2 text", "notes": "what to cover", "children": [{ "heading": "H3", "notes": "..." }] }], "wordCountTarget": 1200, "internalLinkCandidates": [{ "url": "...", "anchorIdea": "..." }], "mustInclude": ["client proof points / offers to weave in"], "mustAvoid": ["banned claims / competitor mentions to avoid"], "evidenceNotes": ["what the data says that shapes this piece"] }

internalLinkCandidates may only use URLs present in EVIDENCE pages. mustAvoid must include every relevant banned claim.`,
  },
  {
    key: "task_draft_post",
    notes: "Writes the full article from an approved brief.",
    body: `TASK: Write the full article from the approved brief above.

Output JSON:
{ "titleOptions": ["...", "...", "..."], "metaTitle": "≤60 chars", "metaDescription": "≤155 chars", "slug": "kebab-case", "bodyMd": "full article in markdown following the brief outline", "faq": [{ "q": "...", "a": "..." }], "internalLinks": [{ "url": "...", "anchor": "...", "placement": "which section" }], "cta": { "heading": "...", "body": "...", "buttonText": "..." }, "imagePrompts": ["..."], "evidenceUsed": ["plain-English notes on which evidence shaped which claims"] }

bodyMd rules: follow the brief outline exactly (H2/H3 structure), hit the word count ±15%, primary keyword in the first 100 words, write [NEEDS DATA: x] for any figure you don't have. FAQ answers ≤80 words each.`,
  },
  {
    key: "task_draft_page",
    notes: "Service/location page package.",
    body: `TASK: Produce a page build package for the plan item above (service/location/money page).

Output JSON:
{ "metaTitle": "≤60 chars", "metaDescription": "≤155 chars", "h1": "...", "suggestedUrl": "/path", "sections": { "hero": { "headline": "...", "subhead": "...", "body": "..." }, "trustProof": "md — ONLY from proof_case_studies knowledge", "services": "md — what's included", "process": "md — how it works, steps", "faq": [{ "q": "...", "a": "..." }], "cta": { "heading": "...", "body": "...", "buttonText": "..." } }, "schemaJsonLd": [{ ...Service/FAQPage/LocalBusiness fragments as applicable... }], "internalLinks": [{ "url": "...", "anchor": "..." }], "evidenceUsed": ["..."] }

trustProof may contain ONLY claims present in knowledge docs. schemaJsonLd must be valid JSON-LD; omit LocalBusiness if no location data in knowledge.`,
  },
  {
    key: "task_refresh",
    notes: "Refresh/rewrite of an existing URL.",
    body: `TASK: Refresh the existing page above.

Inputs: current URL, its current content (provided), and evidence showing why it's underperforming.

Output JSON:
{ "diagnosis": ["what's wrong, each point tied to evidence"], "bodyMd": "full rewritten page in markdown", "changeList": [{ "section": "...", "before": "≤25 word summary", "after": "≤25 word summary", "why": "evidence-based reason" }], "metaTitle": "...", "metaDescription": "...", "evidenceUsed": ["..."] }

Preserve what is working (sections with strong engagement/rankings per evidence). Do not change the page's fundamental topic or URL.`,
  },
  {
    key: "task_qa_label",
    notes: "Cheap-model pass that labels unverified numbers etc. Deterministic rules run in code; this catches what regex can't.",
    body: `TASK: Review the draft above against the evidence and knowledge provided.

Return JSON array of flags:
[{ "rule": "unverified_stat|banned_claim|off_brand_voice|factual_risk", "level": "flag|warn", "quote": "exact text from draft", "message": "why this is a problem" }]

Flag every number, statistic, superlative claim ("#1", "best", "fastest") or client fact that is NOT supported by the evidence or knowledge sections. Empty array if clean. Do not flag stylistic preferences.`,
  },
  {
    key: "task_opportunity_label",
    notes: "One-sentence rationale for rule-detected opportunities.",
    body: `TASK: For each rule-detected opportunity above, write a one-sentence human-readable rationale a junior SEO would understand, referencing the actual numbers from the evidence. Return JSON: [{ "opportunityIndex": 0, "rationale": "..." }]. Use only provided numbers.`,
  },
  {
    key: "task_starter_knowledge",
    notes: "Onboarding accelerator: drafts starter knowledge docs from website copy.",
    body: `TASK: From the website content provided above, draft three starter knowledge documents for human review.

Output JSON:
{ "services": "md — list and describe each service offered, exactly as evidenced on the site", "locations": "md — service areas/locations mentioned on the site", "brandVoiceDraft": "md — observed tone, vocabulary, sentence style, dos and don'ts, with 3 example phrases quoted from the site" }

Only include facts present in the provided content. Mark anything uncertain with [VERIFY]. These are DRAFTS for a human to edit — say so in a note at the top of each.`,
  },
];

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

  // 5. Prompt library (version 1, active)
  for (const p of PROMPT_SEEDS) {
    await db
      .insert(schema.prompts)
      .values({ workspaceId: ws.id, key: p.key, version: 1, body: p.body, notes: p.notes, isActive: true, createdBy: derekId })
      .onConflictDoNothing();
  }
  console.log(`  prompts: ${PROMPT_SEEDS.length} seeded`);

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
