-- Evidence file uploads — private bucket + workspace-scoped RLS.
--
-- Files are uploaded straight from the browser (anon key + session, so RLS
-- applies) and the server action only ever receives the object path. That keeps
-- large CSV exports off the Server Action request body, which is capped by the
-- hosting platform (~4.5MB on Vercel) well below what a big export can reach.
--
-- Path layout: {workspace_id}/{client_id}/{uuid}-{filename}
-- Idempotent — safe to re-run.

insert into storage.buckets (id, name, public, file_size_limit)
values ('evidence-files', 'evidence-files', false, 26214400) -- 25 MiB
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit;

-- Deliberately no allowed_mime_types: browsers report CSV inconsistently
-- (text/csv, application/vnd.ms-excel, or empty). Extension and content are
-- validated in /src/lib/evidence/parse.ts instead.

-- A member may only touch objects filed under one of their own workspaces.
drop policy if exists "evidence_files_select" on storage.objects;
create policy "evidence_files_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'evidence-files'
    and (storage.foldername(name))[1] in (
      select m.workspace_id::text from public.memberships m where m.user_id = auth.uid()
    )
  );

drop policy if exists "evidence_files_insert" on storage.objects;
create policy "evidence_files_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'evidence-files'
    and (storage.foldername(name))[1] in (
      select m.workspace_id::text from public.memberships m where m.user_id = auth.uid()
    )
  );

drop policy if exists "evidence_files_update" on storage.objects;
create policy "evidence_files_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'evidence-files'
    and (storage.foldername(name))[1] in (
      select m.workspace_id::text from public.memberships m where m.user_id = auth.uid()
    )
  )
  with check (
    bucket_id = 'evidence-files'
    and (storage.foldername(name))[1] in (
      select m.workspace_id::text from public.memberships m where m.user_id = auth.uid()
    )
  );

drop policy if exists "evidence_files_delete" on storage.objects;
create policy "evidence_files_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'evidence-files'
    and (storage.foldername(name))[1] in (
      select m.workspace_id::text from public.memberships m where m.user_id = auth.uid()
    )
  );
