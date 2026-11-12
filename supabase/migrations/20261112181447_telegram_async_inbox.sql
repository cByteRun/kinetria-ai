-- Durable admission before webhook ACK. Transport tables are service-role only.
create table public.telegram_inbox (
 id bigint primary key, telegram_id bigint not null, payload jsonb not null,
 done boolean not null default false, attempts integer not null default 0,
 available_at timestamptz not null default now(), leased_until timestamptz,
 token uuid, created_at timestamptz not null default now()
);
create index telegram_inbox_pending on public.telegram_inbox(telegram_id,id) where not done;
alter table public.telegram_inbox enable row level security;
revoke all on public.telegram_inbox from public,anon,authenticated;
grant all on public.telegram_inbox to service_role;

create function public.telegram_enqueue(p_id bigint,p_tg bigint,p_payload jsonb) returns void
language sql security invoker set search_path='' as $$
 insert into public.telegram_inbox(id,telegram_id,payload) values(p_id,p_tg,p_payload) on conflict(id) do nothing;
$$;
create function public.telegram_inbox_claim(p_limit integer default 10) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare r record; jobs jsonb:='[]'; v_token uuid;
begin
 for r in select * from public.telegram_inbox i
 where not i.done and i.available_at<=clock_timestamp() and (i.leased_until is null or i.leased_until<clock_timestamp())
 and not exists(select 1 from public.telegram_inbox older where older.telegram_id=i.telegram_id and not older.done and older.id<i.id)
 order by i.id for update skip locked limit greatest(1,least(p_limit,10))
 loop
   -- Separate workers may select different updates for the same user. Check
   -- active leases while holding the same advisory lock as admission workers.
   if not pg_try_advisory_xact_lock(r.telegram_id) then continue; end if;
   if exists(select 1 from public.telegram_inbox where telegram_id=r.telegram_id and id<>r.id and not done and leased_until>clock_timestamp()) then continue; end if;
   v_token:=gen_random_uuid();
   update public.telegram_inbox set leased_until=clock_timestamp()+interval '2 minutes',token=v_token,attempts=attempts+1 where id=r.id;
   jobs:=jobs||jsonb_build_array(jsonb_build_object('id',r.id,'token',v_token,'payload',r.payload));
 end loop;
 return jobs;
end $$;
create function public.telegram_inbox_finish(p_id bigint,p_token uuid,p_success boolean) returns void
language sql security invoker set search_path='' as $$
 update public.telegram_inbox set done=p_success,leased_until=null,token=null,
 available_at=clock_timestamp()+make_interval(secs=>least(300,power(2,least(attempts,8))::integer)),
 payload=case when p_success then '{}'::jsonb else payload end
 where id=p_id and token=p_token;
$$;

-- Atomic admission for outgoing API calls across every serverless instance.
create table public.telegram_api_limits(key text primary key, next_at timestamptz not null);
alter table public.telegram_api_limits enable row level security;
revoke all on public.telegram_api_limits from public,anon,authenticated;
grant all on public.telegram_api_limits to service_role;
create function public.telegram_api_slot(p_chat text,p_cooldown integer default 0) returns integer
language plpgsql security invoker set search_path='' as $$
declare g timestamptz; c timestamptz; t timestamptz; wait_ms integer;
begin
 insert into public.telegram_api_limits values('global','epoch') on conflict do nothing;
 insert into public.telegram_api_limits values('chat:'||p_chat,'epoch') on conflict do nothing;
 select next_at into g from public.telegram_api_limits where key='global' for update;
 select next_at into c from public.telegram_api_limits where key='chat:'||p_chat for update;
 t:=clock_timestamp();
 if p_cooldown>0 then
   update public.telegram_api_limits set next_at=greatest(next_at,t+make_interval(secs=>least(p_cooldown,86400))) where key in ('global','chat:'||p_chat);
   return least(p_cooldown,86400)*1000;
 end if;
 wait_ms:=least(86400000,greatest(0,ceil(extract(epoch from (greatest(g,c)-t))*1000)))::integer;
 if wait_ms>0 then return wait_ms; end if;
 update public.telegram_api_limits set next_at=t+interval '40 milliseconds' where key='global';
 update public.telegram_api_limits set next_at=t+case when left(p_chat,1)='-' then interval '3100 milliseconds' else interval '1100 milliseconds' end where key='chat:'||p_chat;
 return 0;
end $$;
revoke all on function public.telegram_enqueue(bigint,bigint,jsonb),public.telegram_inbox_claim(integer),public.telegram_inbox_finish(bigint,uuid,boolean),public.telegram_api_slot(text,integer) from public,anon,authenticated;
grant execute on function public.telegram_enqueue(bigint,bigint,jsonb),public.telegram_inbox_claim(integer),public.telegram_inbox_finish(bigint,uuid,boolean),public.telegram_api_slot(text,integer) to service_role;
