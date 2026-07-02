
-- Users can view all avatars (any authenticated user)
create policy "avatares_select_authenticated"
on storage.objects for select to authenticated
using (bucket_id = 'avatares');

-- Users can upload only into a folder named after their own uid
create policy "avatares_insert_own"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'avatares'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "avatares_update_own"
on storage.objects for update to authenticated
using (
  bucket_id = 'avatares'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "avatares_delete_own"
on storage.objects for delete to authenticated
using (
  bucket_id = 'avatares'
  and (storage.foldername(name))[1] = auth.uid()::text
);
