-- Opt-in local demo transport; no public role selector or client grants.
create table public.telegram_demo_sessions (
 telegram_id bigint not null,
 user_id uuid not null references public.profiles(id) on delete cascade,
 state jsonb not null default '{}',
 updated_at timestamptz not null default now(),
 primary key(telegram_id,user_id)
);
alter table public.telegram_demo_sessions enable row level security;
revoke all on public.telegram_demo_sessions from public,anon,authenticated;
grant all on public.telegram_demo_sessions to service_role;

create function kinetria_private.telegram_demo_login(p_tg bigint,p_user uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare old_user uuid; p public.profiles;
begin
 if p_tg<=0 then raise exception 'Invalid identity' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(p_tg);
 select pr.* into p from public.profiles pr join auth.users a on a.id=pr.id
  where pr.id=p_user and pr.active and pr.role<>'client' and a.email=any(array[
   'employee@kinetria.example','handler@kinetria.example','handler-catalog@kinetria.example',
   'handler-training@kinetria.example','manager@kinetria.example','manager-it@kinetria.example',
   'manager-people@kinetria.example','admin@kinetria.example']);
 if not found then raise exception 'Not a demo account' using errcode='42501'; end if;
 if exists(select 1 from public.telegram_links where user_id=p_user and telegram_id<>p_tg) then
  raise exception 'Demo account already connected' using errcode='PT409';
 end if;
 select user_id into old_user from public.telegram_links where telegram_id=p_tg;
 if old_user is not null then
  insert into public.telegram_demo_sessions(telegram_id,user_id,state)
   select p_tg,old_user,state from public.telegram_sessions where telegram_id=p_tg
   on conflict(telegram_id,user_id) do update set state=excluded.state,updated_at=now();
 end if;
 insert into public.telegram_links(telegram_id,user_id) values(p_tg,p_user)
  on conflict(telegram_id) do update set user_id=excluded.user_id;
 delete from public.telegram_sessions where telegram_id=p_tg;
 insert into public.telegram_sessions(telegram_id,state)
  values(p_tg,coalesce((select state from public.telegram_demo_sessions where telegram_id=p_tg and user_id=p_user and updated_at>now()-interval '1 day'),'{}'));
 return jsonb_build_object('role',p.role,'name',p.display_name);
end; $$;
create function public.telegram_demo_login(p_tg bigint,p_user uuid) returns jsonb
language sql security invoker set search_path='' as $$ select kinetria_private.telegram_demo_login(p_tg,p_user); $$;
revoke all on function public.telegram_demo_login(bigint,uuid),kinetria_private.telegram_demo_login(bigint,uuid) from public,anon,authenticated;
grant execute on function public.telegram_demo_login(bigint,uuid),kinetria_private.telegram_demo_login(bigint,uuid) to service_role;

create function kinetria_private.telegram_demo_unlink() returns trigger language plpgsql security definer set search_path='' as $$
begin
 delete from public.telegram_demo_sessions where telegram_id=old.telegram_id;
 return old;
end; $$;
revoke all on function kinetria_private.telegram_demo_unlink() from public,anon,authenticated;
create trigger telegram_demo_unlink after delete on public.telegram_links for each row execute function kinetria_private.telegram_demo_unlink();
