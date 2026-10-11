-- Ownership applies to both a row and every parent it references.
create policy protocol_items_owned_parent on public.protocol_items
as restrictive for all to authenticated
using (exists (select 1 from public.protocols p where p.id = protocol_id and p.user_id = (select auth.uid())))
with check (exists (select 1 from public.protocols p where p.id = protocol_id and p.user_id = (select auth.uid())));

create policy inventory_owned_parent on public.inventory_containers
as restrictive for all to authenticated
using (exists (select 1 from public.protocol_items i where i.id = protocol_item_id and i.user_id = (select auth.uid())))
with check (exists (select 1 from public.protocol_items i where i.id = protocol_item_id and i.user_id = (select auth.uid())));

create policy dose_logs_owned_parents on public.dose_logs
as restrictive for all to authenticated
using (
  exists (select 1 from public.protocol_items i where i.id = protocol_item_id and i.user_id = (select auth.uid()))
  and (inventory_container_id is null or exists (
    select 1 from public.inventory_containers c
    where c.id = inventory_container_id and c.user_id = (select auth.uid())
      and c.protocol_item_id = dose_logs.protocol_item_id
  ))
)
with check (
  exists (select 1 from public.protocol_items i where i.id = protocol_item_id and i.user_id = (select auth.uid()))
  and (inventory_container_id is null or exists (
    select 1 from public.inventory_containers c
    where c.id = inventory_container_id and c.user_id = (select auth.uid())
      and c.protocol_item_id = dose_logs.protocol_item_id
  ))
);
