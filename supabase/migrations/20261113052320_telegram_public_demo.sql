-- Public synthetic demo: many Telegram viewers, one shared role account.
-- Real account links retain one-to-one uniqueness and existing RLS/grants.
alter table public.telegram_links add column is_demo boolean not null default false;
alter table public.telegram_links drop constraint telegram_links_user_id_key;
create unique index telegram_links_real_user_key on public.telegram_links(user_id) where not is_demo;
create index telegram_links_user_idx on public.telegram_links(user_id);

create function kinetria_private.validate_telegram_demo_link() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.is_demo and not exists(select 1 from auth.users where id=new.user_id and email=any(array['employee@kinetria.example','handler@kinetria.example','handler-catalog@kinetria.example','handler-training@kinetria.example','manager@kinetria.example','manager-it@kinetria.example','manager-people@kinetria.example','admin@kinetria.example','client@kinetria.example'])) then
  raise exception 'Not a demo account' using errcode='42501';
 end if;
 return new;
end; $$;
revoke all on function kinetria_private.validate_telegram_demo_link() from public,anon,authenticated;
create trigger validate_telegram_demo_link before insert or update on public.telegram_links
 for each row execute function kinetria_private.validate_telegram_demo_link();
update public.telegram_links l set is_demo=true from auth.users u
 where u.id=l.user_id and u.email=any(array['employee@kinetria.example','handler@kinetria.example','handler-catalog@kinetria.example','handler-training@kinetria.example','manager@kinetria.example','manager-it@kinetria.example','manager-people@kinetria.example','admin@kinetria.example','client@kinetria.example']);

create or replace function kinetria_private.telegram_demo_login(p_tg bigint,p_user uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare old_user uuid; p public.profiles;
begin
 if p_tg<=0 then raise exception 'Invalid identity' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(p_tg);
 select pr.* into p from public.profiles pr join auth.users a on a.id=pr.id
  where pr.id=p_user and pr.active and a.email=any(array[
   'employee@kinetria.example','handler@kinetria.example','handler-catalog@kinetria.example',
   'handler-training@kinetria.example','manager@kinetria.example','manager-it@kinetria.example',
   'manager-people@kinetria.example','admin@kinetria.example','client@kinetria.example']);
 if not found then raise exception 'Not a demo account' using errcode='42501'; end if;
 select user_id into old_user from public.telegram_links where telegram_id=p_tg;
 if old_user is not null then
  insert into public.telegram_demo_sessions(telegram_id,user_id,state)
   select p_tg,old_user,state from public.telegram_sessions where telegram_id=p_tg
   on conflict(telegram_id,user_id) do update set state=excluded.state,updated_at=now();
 end if;
 insert into public.telegram_links(telegram_id,user_id,is_demo) values(p_tg,p_user,true)
  on conflict(telegram_id) do update set user_id=excluded.user_id,is_demo=true;
 delete from public.telegram_sessions where telegram_id=p_tg;
 insert into public.telegram_sessions(telegram_id,state)
  values(p_tg,coalesce((select state from public.telegram_demo_sessions where telegram_id=p_tg and user_id=p_user and updated_at>now()-interval '1 day'),'{}'));
 return jsonb_build_object('role',p.role,'name',p.display_name);
end; $$;

notify pgrst, 'reload schema';
