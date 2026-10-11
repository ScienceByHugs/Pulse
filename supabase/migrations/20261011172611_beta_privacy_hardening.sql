-- Preserve correction audit history until the user explicitly deletes their account.
alter table public.inventory_adjustments
  drop constraint inventory_adjustments_user_id_fkey,
  add constraint inventory_adjustments_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade;
alter table public.inventory_adjustments
  drop constraint inventory_adjustments_inventory_container_id_fkey,
  add constraint inventory_adjustments_inventory_container_id_fkey
    foreign key (inventory_container_id) references public.inventory_containers(id) on delete cascade;

-- The definer is intentional: clients cannot write append-only audit rows.
-- Verify both ownership and confirmed identity before crossing that boundary.
create or replace function public.correct_inventory_remaining(
  p_container_id uuid, p_new_amount numeric, p_reason text
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_old numeric;
begin
  if v_user is null or not pulse_private.email_is_confirmed() then
    raise exception 'A confirmed account is required' using errcode = '42501';
  end if;
  if p_new_amount is null or p_new_amount::text in ('NaN', 'Infinity', '-Infinity')
      or p_new_amount < 0 or p_new_amount > 1000000000 then
    raise exception 'Invalid remaining quantity';
  end if;
  if char_length(btrim(coalesce(p_reason, ''))) not between 3 and 500 then
    raise exception 'Enter a correction reason of 3 to 500 characters';
  end if;
  select remaining_amount into v_old from public.inventory_containers
  where id = p_container_id and user_id = v_user for update;
  if not found then raise exception 'Inventory container not found'; end if;
  update public.inventory_containers
    set remaining_amount = p_new_amount, updated_at = now()
    where id = p_container_id and user_id = v_user;
  insert into public.inventory_adjustments
    (user_id, inventory_container_id, old_remaining_amount, new_remaining_amount, reason)
    values (v_user, p_container_id, v_old, p_new_amount, btrim(p_reason));
end;
$$;

revoke all on function public.correct_inventory_remaining(uuid,numeric,text) from public, anon;
grant execute on function public.correct_inventory_remaining(uuid,numeric,text) to authenticated;
