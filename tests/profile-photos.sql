-- Disposable fixtures: caller must wrap this file in BEGIN/ROLLBACK.
do $$
declare u uuid := gen_random_uuid(); other_u uuid := gen_random_uuid(); unverified uuid := gen_random_uuid();
begin
  insert into auth.users(id,email_confirmed_at) values(u,now()),(other_u,now()),(unverified,null);
  perform set_config('pulse.photo.u',u::text,true);
  perform set_config('pulse.photo.other',other_u::text,true);
  perform set_config('pulse.photo.unverified',unverified::text,true);
end $$;
set local role authenticated;
do $$
declare own_path text := current_setting('pulse.photo.u') || '/avatar.jpg'; denied boolean; changed integer;
begin
  perform set_config('request.jwt.claims',json_build_object('sub',current_setting('pulse.photo.u'),'role','authenticated')::text,true);
  insert into storage.objects(bucket_id,name,owner_id,metadata) values('profile-photos',own_path,current_setting('pulse.photo.u'),'{}');
  update storage.objects set metadata='{"size":12}' where bucket_id='profile-photos' and name=own_path;
  get diagnostics changed=row_count;
  if changed<>1 then raise exception 'Own photo replacement denied'; end if;
  denied:=false;
  begin insert into storage.objects(bucket_id,name) values('profile-photos',current_setting('pulse.photo.other') || '/avatar.jpg');
  exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Cross-account upload allowed'; end if;
  denied:=false;
  begin update storage.objects set name=current_setting('pulse.photo.other') || '/avatar.jpg' where bucket_id='profile-photos' and name=own_path;
  exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Photo ownership reassignment allowed'; end if;
  denied:=false;
  begin insert into storage.objects(bucket_id,name) values('profile-photos',current_setting('pulse.photo.u') || '/extra.jpg');
  exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Extra file allowed'; end if;
  perform set_config('request.jwt.claims',json_build_object('sub',current_setting('pulse.photo.other'),'role','authenticated')::text,true);
  if exists(select 1 from storage.objects where bucket_id='profile-photos') then raise exception 'Cross-account read allowed'; end if;
  update storage.objects set metadata='{}' where bucket_id='profile-photos' and name=own_path;
  get diagnostics changed=row_count;
  if changed<>0 then raise exception 'Cross-account replacement allowed'; end if;
  perform set_config('request.jwt.claims',json_build_object('sub',current_setting('pulse.photo.unverified'),'role','authenticated')::text,true);
  denied:=false;
  begin insert into storage.objects(bucket_id,name) values('profile-photos',current_setting('pulse.photo.unverified') || '/avatar.jpg');
  exception when insufficient_privilege then denied:=true; end;
  if not denied then raise exception 'Unverified upload allowed'; end if;
  if exists(select 1 from storage.objects where bucket_id='profile-photos') then raise exception 'Unverified read allowed'; end if;
end $$;
reset role;
do $$ begin
  if (select qual from pg_policies where schemaname='storage' and tablename='objects' and policyname='pulse_photo_select') is distinct from
     (select qual from pg_policies where schemaname='storage' and tablename='objects' and policyname='pulse_photo_delete') then raise exception 'Removal ownership policy differs from tested read policy'; end if;
  if (select public from storage.buckets where id='profile-photos') then raise exception 'Photo bucket is public'; end if;
  if (select file_size_limit from storage.buckets where id='profile-photos')<>2097152 then raise exception 'Photo size limit missing'; end if;
end $$;
set local role anon;
do $$ begin
  if exists(select 1 from storage.objects where bucket_id='profile-photos') then raise exception 'Anonymous photo read allowed'; end if;
end $$;
reset role;
