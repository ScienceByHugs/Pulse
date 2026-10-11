begin;
do $$
declare
  owner_id uuid := gen_random_uuid();
  other_id uuid := gen_random_uuid();
  unconfirmed_id uuid := gen_random_uuid();
  protocol_id uuid := gen_random_uuid();
  item_id uuid := gen_random_uuid();
  container_id uuid := gen_random_uuid();
begin
  insert into auth.users(id, email_confirmed_at) values(owner_id, now()), (other_id, now()), (unconfirmed_id, null);
  insert into public.protocols(id,user_id,name) values(protocol_id,owner_id,'Rollback-only security fixture');
  insert into public.protocol_items(id,user_id,protocol_id,name,route,dose_amount,dose_unit)
    values(item_id,owner_id,protocol_id,'Fixture','other',1,'mg');
  insert into public.inventory_containers(id,user_id,protocol_item_id,total_amount,remaining_amount,unit)
    values(container_id,owner_id,item_id,100,100,'mg');
  perform set_config('pulse.test.owner', owner_id::text, true);
  perform set_config('pulse.test.other', other_id::text, true);
  perform set_config('pulse.test.unconfirmed', unconfirmed_id::text, true);
  perform set_config('pulse.test.protocol', protocol_id::text, true);
  perform set_config('pulse.test.item', item_id::text, true);
  perform set_config('pulse.test.container', container_id::text, true);
end $$;
set local role authenticated;
do $$
declare
  container_id uuid := current_setting('pulse.test.container')::uuid;
  owner_id text := current_setting('pulse.test.owner');
  other_id text := current_setting('pulse.test.other');
  denied boolean := false;
begin
  perform set_config('request.jwt.claims', json_build_object('sub',owner_id,'role','authenticated')::text, true);
  perform public.correct_inventory_remaining(container_id,90,'Security fixture correction');
  if (select remaining_amount from public.inventory_containers where id=container_id) <> 90 then
    raise exception 'Confirmed owner correction failed';
  end if;
  if (select count(*) from public.inventory_adjustments where inventory_container_id=container_id) <> 1 then
    raise exception 'Correction audit missing';
  end if;
  perform set_config('request.jwt.claims', json_build_object('sub',current_setting('pulse.test.unconfirmed'),'role','authenticated')::text, true);
  begin
    perform public.correct_inventory_remaining(container_id,50,'Unauthorized correction');
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'Unconfirmed account was not rejected'; end if;
  perform set_config('request.jwt.claims', json_build_object('sub',other_id,'role','authenticated')::text, true);
  denied := false;
  begin
    perform public.correct_inventory_remaining(container_id,50,'Cross-account correction');
  exception when raise_exception then
    if sqlerrm = 'Inventory container not found' then denied := true; else raise; end if;
  end;
  if not denied then raise exception 'Cross-account correction allowed'; end if;
  denied := false;
  begin
    insert into public.protocol_items(user_id,protocol_id,name,route,dose_amount,dose_unit)
    values(other_id::uuid,current_setting('pulse.test.protocol')::uuid,'Cross-account fixture','other',1,'mg');
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'Cross-account parent link allowed'; end if;
  denied := false;
  begin
    insert into public.inventory_containers(user_id,protocol_item_id,total_amount,remaining_amount,unit)
    values(other_id::uuid,current_setting('pulse.test.item')::uuid,10,10,'mg');
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'Cross-account inventory link allowed'; end if;

  if exists(select 1 from public.inventory_containers where id=container_id) then
    raise exception 'Cross-account read was allowed';
  end if;
end $$;
reset role;
do $$
declare owner_id uuid := current_setting('pulse.test.owner')::uuid;
begin
  if has_function_privilege('anon','public.correct_inventory_remaining(uuid,numeric,text)','EXECUTE') then
    raise exception 'Anonymous RPC access remains';
  end if;
  delete from auth.users where id=owner_id;
  if exists(select 1 from public.inventory_adjustments where user_id=owner_id)
    or exists(select 1 from public.inventory_containers where user_id=owner_id) then
    raise exception 'Account deletion failed to cascade';
  end if;
end $$;
rollback;
select 'PASS: owner correction, audit, unconfirmed denial, cross-account read/correction/parent-link denial, anonymous denial, account deletion cascade; fixtures rolled back' as result;
