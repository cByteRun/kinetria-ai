\set ON_ERROR_STOP on
begin;
do $$
declare employee uuid; manager uuid; client_id uuid; tg bigint; result jsonb;
begin
 select id into employee from public.profiles where role='employee' and active limit 1;
 select p.id into manager from public.profiles p where role='manager' and active and not exists(select 1 from public.telegram_links where user_id=p.id) limit 1;
 select id into client_id from public.profiles where role='client' limit 1;
 assert employee is not null and manager is not null and client_id is not null;
 select telegram_id into tg from public.telegram_links where user_id=employee;
 if tg is null then tg:=900010; insert into public.telegram_links values(tg,employee); end if;
 insert into public.telegram_sessions(telegram_id,state) values(tg,'{"mode":"draft","draft":{"title":"Synthetic preserved draft"}}') on conflict(telegram_id) do update set state=excluded.state;
 assert not has_function_privilege('authenticated','public.telegram_demo_login(bigint,uuid)','EXECUTE');
 assert not has_function_privilege('anon','public.telegram_demo_login(bigint,uuid)','EXECUTE');
 assert not has_table_privilege('authenticated','public.telegram_demo_sessions','SELECT');
 assert has_function_privilege('service_role','public.telegram_demo_login(bigint,uuid)','EXECUTE');
 result:=public.telegram_demo_login(tg,manager);
 assert result->>'role'='manager';
 assert public.telegram_bridge(tg,'context')->>'role'='manager';
 assert (select state->>'mode' from public.telegram_sessions where telegram_id=tg) is null;
 result:=public.telegram_demo_login(tg,employee);
 assert result->>'role'='employee';
 assert public.telegram_bridge(tg,'context')->'state'->'draft'->>'title'='Synthetic preserved draft';
 begin
  perform public.telegram_demo_login(tg,client_id);raise exception 'Client demo enabled';
 exception when insufficient_privilege then null;end;
 begin
  perform public.telegram_demo_login(tg+1,employee);raise exception 'Stole another Telegram account';
 exception when sqlstate 'PT409' then null;end;
 perform public.telegram_bridge(tg,'unlink');
 assert not exists(select 1 from public.telegram_demo_sessions where telegram_id=tg);
 raise notice 'PASS Telegram demo: service-only login, synthetic accounts, role switch, isolated/restored drafts, no account takeover, unlink cleanup';
end $$;
rollback;
