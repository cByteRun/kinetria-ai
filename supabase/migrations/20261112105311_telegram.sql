-- Telegram transport only: domain writes reuse the web workflow functions.
create table public.telegram_links (
 telegram_id bigint primary key check(telegram_id>0),
 user_id uuid not null unique references public.profiles(id) on delete cascade
);
create table public.telegram_tokens (
 token uuid primary key default gen_random_uuid(),
 user_id uuid not null unique references public.profiles(id) on delete cascade,
 expires_at timestamptz not null default now()+interval '10 minutes'
);
create table public.telegram_sessions (
 telegram_id bigint primary key,
 state jsonb not null default '{}',
 updated_at timestamptz not null default now()
);
create table public.telegram_updates (
 id bigint primary key, telegram_id bigint not null,
 done boolean not null default false,
 leased_until timestamptz not null default now()+interval '2 minutes'
);
create table public.telegram_outbox (
 id bigint generated always as identity primary key,
 request_id uuid not null references public.requests(id) on delete cascade,
 version integer not null, event text not null, actor_id uuid,
 snapshot jsonb not null,
 delivered jsonb not null default '{}',
 done boolean not null default false,
 leased_until timestamptz, attempts integer not null default 0,
 next_attempt_at timestamptz not null default now(),
 created_at timestamptz not null default now(),
 unique(request_id,version)
);
create table public.telegram_channel_messages (
 request_id uuid primary key references public.requests(id) on delete cascade,
 message_id bigint not null
);
-- No client access, including direct authenticated Data API requests.
alter table public.telegram_links enable row level security;
alter table public.telegram_tokens enable row level security;
alter table public.telegram_sessions enable row level security;
alter table public.telegram_updates enable row level security;
alter table public.telegram_outbox enable row level security;
alter table public.telegram_channel_messages enable row level security;
revoke all on public.telegram_links,public.telegram_tokens,public.telegram_sessions,public.telegram_updates,public.telegram_outbox,public.telegram_channel_messages from public,anon,authenticated;
grant all on public.telegram_links,public.telegram_tokens,public.telegram_sessions,public.telegram_updates,public.telegram_outbox,public.telegram_channel_messages to service_role;
grant usage,select on sequence public.telegram_outbox_id_seq to service_role;
create index telegram_outbox_pending on public.telegram_outbox(id) where not done;

create function kinetria_private.telegram_link_token() returns uuid
language plpgsql security definer set search_path='' as $$
declare t uuid;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and active and role<>'client') then raise exception 'Forbidden' using errcode='42501'; end if;
 insert into public.telegram_tokens(user_id) values(auth.uid()) on conflict(user_id) do update set token=gen_random_uuid(),expires_at=now()+interval '10 minutes' returning token into t;
 return t;
end; $$;
create function public.telegram_link_token() returns uuid language sql security invoker set search_path='' as $$ select kinetria_private.telegram_link_token(); $$;
revoke all on function public.telegram_link_token(),kinetria_private.telegram_link_token() from public,anon;
grant execute on function public.telegram_link_token(),kinetria_private.telegram_link_token() to authenticated;

-- This bridge is callable ONLY by service_role after webhook secret validation.
-- Never accepts a user ID or role supplied by Telegram; identity comes from links.
create function kinetria_private.telegram_bridge(p_tg bigint,p_op text,p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid; pr public.profiles; r public.requests; t uuid; result jsonb; q jsonb; upd bigint;
begin
 if p_tg<=0 then raise exception 'Invalid Telegram ID'; end if;
 if p_op='link' then
   delete from public.telegram_tokens where token=(p_data->>'token')::uuid and expires_at>now() returning user_id into u;
   if u is null or not exists(select 1 from public.profiles where id=u and active and role<>'client') then raise exception 'Invalid or expired link'; end if;
   if exists(select 1 from public.telegram_links where telegram_id=p_tg and user_id<>u) then raise exception 'Unlink current account first'; end if;
   delete from public.telegram_links where user_id=u;
   insert into public.telegram_links values(p_tg,u);
   delete from public.telegram_sessions where telegram_id=p_tg;
   return '{"linked":true}';
 end if;
 if p_op='claim' then
   upd:=(p_data->>'update')::bigint;
   -- Serialize a user's conversational updates across concurrent serverless instances.
   perform pg_advisory_xact_lock(p_tg);
   if exists(select 1 from public.telegram_updates where telegram_id=p_tg and not done and leased_until>now() and id<>upd) then return '"busy"'; end if;
   if exists(select 1 from public.telegram_updates where id=upd and not done and leased_until>now()) then return '"busy"'; end if;
   insert into public.telegram_updates(id,telegram_id) values(upd,p_tg) on conflict(id) do update set leased_until=now()+interval '2 minutes' where not telegram_updates.done and telegram_updates.leased_until<now() returning id into upd;
   return to_jsonb(upd is not null);
 end if;
 if p_op='finish' then
   update public.telegram_updates set done=coalesce((p_data->>'done')::boolean,true),leased_until=now() where id=(p_data->>'update')::bigint and telegram_id=p_tg;
   return 'true';
 end if;
 select user_id into u from public.telegram_links where telegram_id=p_tg;
 select * into pr from public.profiles where id=u and active and role<>'client';
 if not found then raise exception 'Account not linked' using errcode='42501'; end if;
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 if p_op='unlink' then
   delete from public.telegram_links where telegram_id=p_tg;
   delete from public.telegram_sessions where telegram_id=p_tg;
   return 'true';
 elsif p_op='context' then
   return jsonb_build_object('role',pr.role,'name',pr.display_name,'state',coalesce((select state from public.telegram_sessions where telegram_id=p_tg),'{}'), 'categories',(select jsonb_agg(jsonb_build_object('id',id,'name',name_ru) order by id) from public.request_categories where active));
 elsif p_op='state' then
   insert into public.telegram_sessions values(p_tg,p_data,now()) on conflict(telegram_id) do update set state=excluded.state,updated_at=now(); return 'true';
 elsif p_op='submit' then
   t:=kinetria_private.submit_with_files((p_data->>'key')::uuid,p_data->>'category',(p_data->>'kind')::public.request_kind,p_data->>'title',p_data->>'description',p_data->>'proposal',(p_data->>'sentiment')::smallint,array(select jsonb_array_elements_text(p_data->'tags')),coalesce(p_data->'files','[]'));
   return jsonb_build_object('id',t,'number',(select number from public.requests where id=t));
 end if;
 -- Explicit scope predicate is required because the bridge itself is SECURITY DEFINER.
 if p_op in ('list','stats','reserve') then
   select coalesce(jsonb_agg(to_jsonb(x)),'[]') into result from (
     select id,number,title,status,assignee_id,due_at from public.requests where
      (p_op<>'reserve' or (pr.role='admin' and assignee_id is null and status not in ('implemented','rejected','closed'))) and
      (pr.role='admin' or (pr.role='employee' and author_id=u) or (pr.role='handler' and assignee_id=u) or (pr.role='manager' and kinetria_private.manages_category(category_id)))
      order by updated_at desc limit 30) x;
   return result;
 end if;
 select * into r from public.requests where id=(p_data->>'id')::uuid and
  (pr.role='admin' or (pr.role='employee' and author_id=u) or (pr.role='handler' and assignee_id=u) or (pr.role='manager' and kinetria_private.manages_category(category_id)));
 if not found then raise exception 'Request unavailable' using errcode='PT404'; end if;
 if p_op='detail' then
   return to_jsonb(r)||jsonb_build_object('events',(select coalesce(jsonb_agg(to_jsonb(e)),'[]') from (select event_type,created_at,message from public.request_events where request_id=r.id order by id desc limit 8) e),'files',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name)),'[]') from public.request_attachments where request_id=r.id));
 elsif p_op='file' then
   select to_jsonb(a) into result from public.request_attachments a where request_id=r.id and id=(p_data->>'file')::uuid; return result;
 elsif p_op='assignees' then
   if pr.role='admin' then return (select coalesce(jsonb_agg(x),'[]') from (select * from kinetria_private.routing_managers()) x); end if;
   return (select coalesce(jsonb_agg(x),'[]') from (select * from kinetria_private.request_assignees() where role='handler' or id in(select manager_id from kinetria_private.manager_categories where category_id=r.category_id)) x);
 elsif p_op='assign' then
   -- Set the date first so the assignment event snapshot includes the confirmed date.
   -- Any later invalid assignment rolls this metadata write back atomically.
   if nullif(p_data->>'due','') is not null then
     perform kinetria_private.dashboard_action(r.id,(p_data->>'version')::integer,'metadata','',r.priority,(p_data->>'due')::date,null);
     r.version:=r.version+1;
   end if;
   if pr.role='admin' then
    perform kinetria_private.dashboard_action(r.id,case when nullif(p_data->>'due','') is null then (p_data->>'version')::integer else r.version end,'assigned','','normal',null,(p_data->>'assignee')::uuid);
   else
    perform kinetria_private.review_request(r.id,case when nullif(p_data->>'due','') is null then (p_data->>'version')::integer else r.version end,'assigned',null,'','',(p_data->>'assignee')::uuid);
   end if;
 elsif p_op='review' then
   perform kinetria_private.review_request(r.id,(p_data->>'version')::integer,coalesce(p_data->>'action','reviewed'),(p_data->>'status')::public.request_status,coalesce(p_data->>'message',''),coalesce(p_data->>'next',''),null);
 elsif p_op='comment' then
   perform kinetria_private.dashboard_action(r.id,(p_data->>'version')::integer,'commented',p_data->>'message');
 elsif p_op='ack' then
   perform kinetria_private.dashboard_action(r.id,(p_data->>'version')::integer,'acknowledged');
 else raise exception 'Invalid operation';
 end if;
 return 'true';
end; $$;
create function public.telegram_bridge(p_tg bigint,p_op text,p_data jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$ select kinetria_private.telegram_bridge(p_tg,p_op,p_data); $$;
revoke all on function public.telegram_bridge(bigint,text,jsonb),kinetria_private.telegram_bridge(bigint,text,jsonb) from public,anon,authenticated;
grant usage on schema kinetria_private to service_role;
grant execute on function public.telegram_bridge(bigint,text,jsonb),kinetria_private.telegram_bridge(bigint,text,jsonb) to service_role;

create function kinetria_private.telegram_enqueue() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='INSERT' then
  insert into public.telegram_outbox(request_id,version,event,actor_id,snapshot) values(new.id,new.version,'created',auth.uid(),jsonb_build_object('assignee_id',new.assignee_id,'due_at',new.due_at,'status',new.status));
 elsif old.version<>new.version then
  insert into public.telegram_outbox(request_id,version,event,actor_id,snapshot) values(new.id,new.version,case when old.assignee_id is distinct from new.assignee_id then 'assigned' when old.status<>new.status then 'status' else 'updated' end,auth.uid(),jsonb_build_object('assignee_id',new.assignee_id,'due_at',new.due_at,'status',new.status)) on conflict do nothing;
 end if;
 return new;
end; $$;
revoke all on function kinetria_private.telegram_enqueue() from public,anon,authenticated;
create trigger telegram_enqueue after insert or update on public.requests for each row execute function kinetria_private.telegram_enqueue();
