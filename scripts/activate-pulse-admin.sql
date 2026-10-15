-- OPERATOR ONLY: run after Anthony has created and verified the dedicated login.
-- This resolves the Auth ID server-side; never grant roles from user_metadata.
-- No password, authenticator secret, service key or generated UUID belongs here.
do $$
declare approved_id uuid;
begin
  if (select count(*) from auth.users where lower(email)='admin@sciencebyhugs.com' and email_confirmed_at is not null)<>1 then
    raise exception 'Create and verify the dedicated admin account first';
  end if;
  select id into approved_id from auth.users where lower(email)='admin@sciencebyhugs.com' and email_confirmed_at is not null;
  if exists(select 1 from pulse_private.admin_accounts where user_id<>approved_id) then
    raise exception 'An existing admin must be reviewed before adding another';
  end if;
  insert into pulse_private.admin_accounts(user_id) values(approved_id) on conflict(user_id) do nothing;
end $$;
-- Access to counts/tickets additionally requires a live session and verified TOTP.
