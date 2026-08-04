# Content Desk
Multi-tenant SEO content ops app for agencies. DCB Digital is tenant #1; product will be sold to other agencies.

## Stack (do not deviate)
Next.js App Router + TS · Supabase (Postgres/Auth/Storage, RLS on) · Drizzle ·
Tailwind + shadcn/ui · Vercel AI SDK (anthropic|openai|openrouter) · TipTap · Inngest · Zod

## Iron rules
1. workspace_id on every table; every query RLS-scoped. No exceptions.
2. Never render or generate a metric without an evidence ref. Missing data = say so.
3. Document status pipeline is the single source of truth:
   planned → briefed → brief_approved → drafting → qa_flagged → in_review → approved → exported
4. Prompts live in the DB (versioned), not in code.
5. Secrets: AES-GCM encrypted, masked in UI, never logged.
6. AU English (en-AU) default in all generated content.
7. "Page" = on-page copy package. Never build page-rendering/site-builder features.
8. Ship vertical slices; main is always deployable.

## Key files
/src/db/schema.ts · /src/lib/ai/ (provider abstraction, prompt assembly) ·
/src/lib/evidence/ (providers + normalizer) · /src/lib/qa/ (flag rules) · /src/inngest/

## Auth
- All app queries run as the signed-in user (anon key + session cookie) so RLS applies.
- Service-role key: seed script + server-side admin jobs only. Never in browser.
- Session refreshed in /src/middleware.ts via @supabase/ssr.
- users.id mirrors auth.users.id — a DB trigger creates the public.users row on sign-up.

## Supabase trigger (run once in SQL editor)
```sql
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

## Supabase Storage — evidence uploads (applied; idempotent)
Private `evidence-files` bucket + workspace-scoped RLS live in `supabase/evidence-storage.sql`:
```
psql "$DATABASE_URL" -f supabase/evidence-storage.sql
```
Path layout `{workspace_id}/{client_id}/{uuid}-{file}` — the leading workspace segment is what
the policies check, so it must stay first. Files upload browser → Storage directly; the Server
Action receives only object paths, keeping large exports out of the request body (Vercel caps
those at ~4.5MB). Deleting a source removes its objects.

## DB
- Drizzle schema: /src/db/schema.ts (do not modify enums without a migration)
- Migrations: npx drizzle-kit generate && npx drizzle-kit migrate
- Seed: SEED_ADMIN_PASSWORD='...' npx tsx src/db/seed.ts
- Prompts: add to /src/db/prompt-seeds.ts then `npx tsx src/db/sync-prompts.ts` to back-fill
  existing workspaces. A key missing from the DB is a hard failure at generation time.
  Neither script ever overwrites a prompt key that already exists — UI edits win.
- drizzle.config.ts uses DATABASE_URL (Session pooler, not Transaction pooler)

## Encrypted LLM keys
- AES-GCM, key = ENCRYPTION_KEY (32 bytes hex), see /src/lib/crypto.ts
- Stored in workspace_settings.providers[].encKey — never log, never send to client

## Prompt assembly order (see brief §6.6)
1. system_rules  2. objectives_snapshot  3. pinned knowledge  4. retrieved knowledge
5. opportunity + evidence excerpts  6. plan item / approved brief  7. task instruction
All prompts fetched from DB by key; version logged in generation_logs.

## Feature flags
All off by default: wordpress_publish, client_portal, live_connectors, stripe_billing

## Non-goals (v1 + forever)
- Site builder / CMS replacement (pages = copy packages, not rendered HTML)
- Auto-publish without approval
- Mobile apps
- Rank tracking (Ahrefs/SEMrush do this)

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
