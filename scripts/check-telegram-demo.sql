\set ON_ERROR_STOP on
begin;
do $$
declare employee uuid; manager uuid; client_id uuid; tg bigint; result jsonb; real_user uuid:=gen_random_uuid();
begin
 select p.id into employee from public.profiles p join auth.users u on u.id=p.id where u.email='employee@kinetria.example';
 select p.id into manager from public.profiles p join auth.users u on u.id=p.id where u.email='manager@kinetria.example';
 select p.id into client_id from public.profiles p join auth.users u on u.id=p.id where u.email='client@kinetria.example';
 assert employee is not null and manager is not null and client_id is not null;
 tg:=990000010;
 assert not exists(select 1 from public.telegram_links where telegram_id in(tg,tg+1,990000001,990000002)), 'Synthetic test IDs already in use';
 perform public.telegram_demo_login(tg,employee);
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
 result:=public.telegram_demo_login(tg,client_id);
 assert result->>'role'='client';
 result:=public.telegram_demo_login(tg,employee);
 result:=public.telegram_demo_login(tg+1,employee);
 assert result->>'role'='employee';
 assert public.telegram_bridge(tg,'context')->'state'->'draft'->>'title'='Synthetic preserved draft';
 assert public.telegram_bridge(tg+1,'context')->'state'->'draft' is null;
 assert (select count(*) from public.telegram_links where user_id=employee)>=2;
 insert into auth.users(id,email) values(real_user,'synthetic-telegram-check@invalid.example');
 insert into public.profiles(id,role) values(real_user,'employee');
 insert into public.telegram_links(telegram_id,user_id) values(990000001,real_user);
 begin
  insert into public.telegram_links(telegram_id,user_id) values(990000002,real_user);
  raise exception 'Real account allowed multiple links';
 exception when unique_violation then null;end;
 begin
  insert into public.telegram_links(telegram_id,user_id,is_demo) values(990000002,real_user,true);
  raise exception 'Real account marked as demo';
 exception when insufficient_privilege then null;end;
 begin
  perform public.telegram_demo_login(990000002,real_user);
  raise exception 'Real account allowed in demo RPC';
 exception when insufficient_privilege then null;end;
 perform public.telegram_bridge(tg,'unlink');
 assert not exists(select 1 from public.telegram_demo_sessions where telegram_id=tg);
 raise notice 'PASS Telegram demo: service-only login, synthetic accounts, role switch, isolated/restored drafts, concurrent viewers of shared demo accounts, unlink cleanup';
end $$;
rollback;
