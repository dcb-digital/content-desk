-- Content Desk — Row Level Security
-- Run AFTER drizzle migrations have created the tables.
-- Tenant isolation is enforced HERE, at the database layer. App code assumes it.
--
-- Model:
--   * memberships maps auth.uid() -> workspace_id(s)
--   * every tenant table has workspace_id
--   * one helper function + one generic policy pattern

-- ---------------------------------------------------------------
-- Helper: workspaces the current user belongs to
-- SECURITY DEFINER so it can read memberships regardless of RLS.
-- ---------------------------------------------------------------
create or replace function public.user_workspace_ids()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select workspace_id from public.memberships where user_id = auth.uid();
$$;

create or replace function public.is_workspace_admin(ws uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.memberships
    where user_id = auth.uid() and workspace_id = ws and role = 'admin'
  );
$$;

-- ---------------------------------------------------------------
-- users: a user may read/update their own profile row
-- ---------------------------------------------------------------
alter table public.users enable row level security;

create policy users_self_select on public.users
  for select using (id = auth.uid());
create policy users_self_update on public.users
  for update using (id = auth.uid());

-- ---------------------------------------------------------------
-- workspaces: visible to members; updatable by admins
-- ---------------------------------------------------------------
alter table public.workspaces enable row level security;

create policy workspaces_member_select on public.workspaces
  for select using (id in (select public.user_workspace_ids()));
create policy workspaces_admin_update on public.workspaces
  for update using (public.is_workspace_admin(id));

-- ---------------------------------------------------------------
-- memberships: members can see their workspace's roster;
-- only admins manage it
-- ---------------------------------------------------------------
alter table public.memberships enable row level security;

create policy memberships_member_select on public.memberships
  for select using (workspace_id in (select public.user_workspace_ids()));
create policy memberships_admin_write on public.memberships
  for all using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

-- ---------------------------------------------------------------
-- workspace_settings (holds encrypted LLM keys): ADMIN ONLY
-- ---------------------------------------------------------------
alter table public.workspace_settings enable row level security;

create policy ws_settings_admin_all on public.workspace_settings
  for all using (public.is_workspace_admin(workspace_id))
  with check (public.is_workspace_admin(workspace_id));

-- ---------------------------------------------------------------
-- prompts: members read, admins write
-- ---------------------------------------------------------------
alter table public.prompts enable row level security;

create policy prompts_member_select on public.prompts
  for select using (workspace_id in (select public.user_workspace_ids()));
create policy prompts_admin_write on public.prompts
  for insert with check (public.is_workspace_admin(workspace_id));
create policy prompts_admin_update on public.prompts
  for update using (public.is_workspace_admin(workspace_id));
create policy prompts_admin_delete on public.prompts
  for delete using (public.is_workspace_admin(workspace_id));

-- ---------------------------------------------------------------
-- Generic member policy for all remaining tenant tables:
-- members of the workspace get full CRUD; RLS blocks everyone else.
-- ---------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'feature_flags',
    'clients',
    'knowledge_docs',
    'objectives',
    'evidence_sources',
    'evidence_snapshots',
    'opportunities',
    'content_plans',
    'plan_items',
    'documents',
    'document_versions',
    'edit_diffs',
    'generation_logs',
    'status_events',
    'batch_runs'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format($p$
      create policy %I_member_all on public.%I
        for all
        using (workspace_id in (select public.user_workspace_ids()))
        with check (workspace_id in (select public.user_workspace_ids()));
    $p$, t, t);
  end loop;
end
$$;

-- ---------------------------------------------------------------
-- Storage: per-workspace folders in the 'uploads' bucket
-- Path convention: uploads/{workspace_id}/{client_id}/{filename}
-- ---------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', false)
on conflict (id) do nothing;

create policy uploads_member_rw on storage.objects
  for all
  using (
    bucket_id = 'uploads'
    and (storage.foldername(name))[1]::uuid in (select public.user_workspace_ids())
  )
  with check (
    bucket_id = 'uploads'
    and (storage.foldername(name))[1]::uuid in (select public.user_workspace_ids())
  );

-- Acceptance test #9: create a second workspace + user, confirm zero rows
-- visible across tenants for every table above.
