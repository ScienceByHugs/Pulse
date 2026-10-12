insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-photos', 'profile-photos', false, 2097152, array['image/jpeg']);

-- One fixed thumbnail per confirmed account. Client metadata never authorizes access.
create policy pulse_photo_select on storage.objects for select to authenticated
using (bucket_id = 'profile-photos' and name = (select auth.uid())::text || '/avatar.jpg' and pulse_private.email_is_confirmed());
create policy pulse_photo_insert on storage.objects for insert to authenticated
with check (bucket_id = 'profile-photos' and name = (select auth.uid())::text || '/avatar.jpg' and pulse_private.email_is_confirmed());
create policy pulse_photo_update on storage.objects for update to authenticated
using (bucket_id = 'profile-photos' and name = (select auth.uid())::text || '/avatar.jpg' and pulse_private.email_is_confirmed())
with check (bucket_id = 'profile-photos' and name = (select auth.uid())::text || '/avatar.jpg' and pulse_private.email_is_confirmed());
create policy pulse_photo_delete on storage.objects for delete to authenticated
using (bucket_id = 'profile-photos' and name = (select auth.uid())::text || '/avatar.jpg' and pulse_private.email_is_confirmed());
