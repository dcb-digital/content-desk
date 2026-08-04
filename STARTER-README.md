# Content Desk — Day 1 starter kit

These files implement Section 5 (domain model), Section 7 (tenancy), and part of Day 1 of the build brief (Content-Desk-Build-Brief-v2.md).

```
src/db/schema.ts            → full Drizzle schema (17 tables, all enums)
src/db/seed.ts              → DCB workspace + demo client + prompt library
supabase/rls-policies.sql   → tenant isolation + storage policies
drizzle.config.ts           → drizzle-kit config
```

## Setup order (Day 1)

```bash
# 1. Scaffold Next.js around these files (Claude Code handles this)
npx create-next-app@latest . --typescript --tailwind --app
git init  # push to GitHub, connect Vercel

# 2. Deps
npm i drizzle-orm postgres @supabase/supabase-js @supabase/ssr zod ai
npm i -D drizzle-kit tsx

# 3. Set .env (see brief §13)
#    DATABASE_URL = Supabase "Session pooler" string (Sydney region project)

# 4. Create tables
npx drizzle-kit generate && npx drizzle-kit migrate

# 5. RLS — paste supabase/rls-policies.sql into the Supabase SQL editor and run

# 6. Seed
SEED_ADMIN_PASSWORD='<dev password>' npx tsx src/db/seed.ts
```

## What the seed gives you

- **DCB workspace** (slug `dcb`) with Derek as admin (`info@dcbdigital.com.au`)
- **9 versioned prompts** — the generation pipeline's brain, editable in the DB without deploys: `system_rules`, `task_plan`, `task_brief`, `task_draft_post`, `task_draft_page`, `task_refresh`, `task_qa_label`, `task_opportunity_label`, `task_starter_knowledge`
- **Demo client** (fictional family law firm) with pinned brand voice, services, banned claims, proof points, and a completed objectives record — enough to test the full generation loop before touching a real client
- **Feature flags** (all off): `wordpress_publish`, `client_portal`, `live_connectors`, `stripe_billing`

## Notes for Claude Code sessions

- `users.id` mirrors `auth.users.id`. Create a Supabase auth trigger or mirror on sign-up.
- All app queries must run as the signed-in user (anon key + session) so RLS applies. The service-role key is for the seed script and server-side admin jobs only — never in the browser.
- Prompt assembly order and iron rules: see brief §6.6 and the CLAUDE.md seed (§11).
- Encrypted LLM keys live in `workspace_settings.providers[].encKey` — AES-GCM encrypt with `ENCRYPTION_KEY` before insert; build `src/lib/crypto.ts` first.
