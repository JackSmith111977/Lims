-- Completes FR-METHOD-003 with private Supabase Storage upload policies.

insert into storage.buckets (id, name, public)
values ('lims-methods', 'lims-methods', false)
on conflict (id) do update set public = false;

drop policy if exists method_storage_read_by_permission on storage.objects;
create policy method_storage_read_by_permission
on storage.objects for select to authenticated
using (
  bucket_id = 'lims-methods'
  and (public.has_permission('resource.read') or public.has_permission('task.read'))
);

drop policy if exists method_storage_insert_by_permission on storage.objects;
create policy method_storage_insert_by_permission
on storage.objects for insert to authenticated
with check (
  bucket_id = 'lims-methods'
  and public.has_permission('resource.manage')
);

drop policy if exists method_storage_delete_by_permission on storage.objects;
create policy method_storage_delete_by_permission
on storage.objects for delete to authenticated
using (
  bucket_id = 'lims-methods'
  and public.has_permission('resource.manage')
);
