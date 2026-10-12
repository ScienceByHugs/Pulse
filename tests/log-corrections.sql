-- Run against disposable fixtures; the caller must wrap this in BEGIN/ROLLBACK.
do $$
declare u uuid:=gen_random_uuid(); other_u uuid:=gen_random_uuid(); unverified uuid:=gen_random_uuid(); p uuid:=gen_random_uuid(); i uuid:=gen_random_uuid(); c uuid:=gen_random_uuid();
begin
 insert into auth.users(id,email_confirmed_at) values(u,now()),(other_u,now()),(unverified,null);
 insert into public.protocols(id,user_id,name) values(p,u,'Rollback correction fixture');
 insert into public.protocol_items(id,user_id,protocol_id,name,route,dose_amount,dose_unit) values(i,u,p,'Fixture','other',2,'mg');
 insert into public.inventory_containers(id,user_id,protocol_item_id,total_amount,remaining_amount,unit) values(c,u,i,10,10,'mg');
 perform set_config('pulse.test.u',u::text,true); perform set_config('pulse.test.other',other_u::text,true); perform set_config('pulse.test.unverified',unverified::text,true);
 perform set_config('pulse.test.i',i::text,true); perform set_config('pulse.test.c',c::text,true);
end $$;
set local role authenticated;
do $$
declare l public.dose_logs; s public.dose_logs; c uuid:=current_setting('pulse.test.c')::uuid; i uuid:=current_setting('pulse.test.i')::uuid; event_id uuid:=gen_random_uuid(); denied boolean;
begin
 perform set_config('request.jwt.claims',json_build_object('sub',current_setting('pulse.test.u'),'role','authenticated')::text,true);
 l:=public.log_dose_and_decrement(i,2,'mg','other',null,c,null,gen_random_uuid());
 if (select remaining_amount from public.inventory_containers where id=c)<>8 then raise exception 'Initial log stock wrong'; end if;
 l:=public.correct_dose_log(l.id,0,3,now()-interval '1 day','left','completed');
 if l.revision<>1 or (select remaining_amount from public.inventory_containers where id=c)<>7 then raise exception 'Correction failed'; end if;
 denied:=false; begin perform public.correct_dose_log(l.id,0,1,now(),null,'completed'); exception when raise_exception then denied:=true; end;
 if not denied then raise exception 'Stale correction allowed'; end if;
 denied:=false; begin perform public.correct_dose_log(l.id,1,30,now(),null,'completed'); exception when raise_exception then denied:=true; end;
 if not denied or (select remaining_amount from public.inventory_containers where id=c)<>7 then raise exception 'Insufficient stock not atomic'; end if;
 denied:=false; begin perform public.correct_dose_log(l.id,1,'NaN',now(),null,'completed'); exception when raise_exception then denied:=true; end;
 if not denied then raise exception 'Nonfinite amount accepted'; end if;
 perform set_config('request.jwt.claims',json_build_object('sub',current_setting('pulse.test.other'),'role','authenticated')::text,true);
 denied:=false; begin perform public.correct_dose_log(l.id,1,1,now(),null,'voided'); exception when raise_exception then denied:=true; end;
 if not denied then raise exception 'Cross-account edit allowed'; end if;
 perform set_config('request.jwt.claims',json_build_object('sub',current_setting('pulse.test.unverified'),'role','authenticated')::text,true);
 denied:=false; begin perform public.correct_dose_log(l.id,1,1,now(),null,'voided'); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Unverified edit allowed'; end if;
 perform set_config('request.jwt.claims',json_build_object('sub',current_setting('pulse.test.u'),'role','authenticated')::text,true);
 l:=public.correct_dose_log(l.id,1,l.amount,l.logged_at,l.site,'voided');
 if (select remaining_amount from public.inventory_containers where id=c)<>10 then raise exception 'Undo did not restore stock'; end if;
 denied:=false; begin perform public.correct_dose_log(l.id,2,l.amount,l.logged_at,l.site,'voided'); exception when raise_exception then denied:=true; end;
 if not denied then raise exception 'Double undo allowed'; end if;
 if (select count(*) from public.dose_log_revisions where dose_log_id=l.id)<>2 then raise exception 'Audit missing'; end if;
 s:=public.skip_dose(i,event_id); perform public.skip_dose(i,event_id);
 if (select count(*) from public.dose_logs where client_event_id=event_id)<>1 or (select remaining_amount from public.inventory_containers where id=c)<>10 then raise exception 'Skip affected stock or duplicated'; end if;
 perform public.correct_dose_log(s.id,0,s.amount,s.logged_at,null,'voided');
 if (select remaining_amount from public.inventory_containers where id=c)<>10 then raise exception 'Undo skip changed stock'; end if;
 if has_function_privilege('anon','public.correct_dose_log(uuid,integer,numeric,timestamptz,text,text)','EXECUTE') then raise exception 'Anon correction exposed'; end if;
 denied:=false; begin insert into public.dose_log_revisions(user_id,dose_log_id,before_record,after_record) values(auth.uid(),l.id,'{}','{}'); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Client can forge audit'; end if;
end $$;
reset role;
