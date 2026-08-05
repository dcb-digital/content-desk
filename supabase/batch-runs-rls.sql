-- ---------------------------------------------------------------
-- RLS for batch_runs (iron rule #1).
--
-- Added after the initial rls-policies.sql run, so it is written to be
-- idempotent — that file's create-policy loop is not re-runnable.
--
--   psql "$DATABASE_URL" -f supabase/batch-runs-rls.sql
--
-- Note the Inngest worker writes to this table with the service-role key,
-- which bypasses RLS by design. It is a server-side admin job (see CLAUDE.md)
-- and scopes every statement by workspace_id itself. This policy is what
-- protects the reads the browser makes while polling for progress.
-- ---------------------------------------------------------------
alter table public.batch_runs enable row level security;

drop policy if exists batch_runs_member_all on public.batch_runs;

create policy batch_runs_member_all on public.batch_runs
  for all
  using (workspace_id in (select public.user_workspace_ids()))
  with check (workspace_id in (select public.user_workspace_ids()));
