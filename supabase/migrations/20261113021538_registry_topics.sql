create table public.topics (
 id uuid primary key,
 title text not null check (length(btrim(title)) between 1 and 120),
 description text check (length(description)<=2000),
 is_ai_generated boolean not null default false,
 created_by uuid not null references public.profiles(id),
 creator_role public.kinetria_role not null,
 created_at timestamptz not null default now()
);
create index topics_creator on public.topics(created_by);
create table public.topic_requests (
 topic_id uuid not null references public.topics(id) on delete cascade,
 request_id uuid not null references public.requests(id) on delete cascade,
 primary key(topic_id,request_id)
);
create index topic_requests_request on public.topic_requests(request_id,topic_id);
alter table public.topics enable row level security;
alter table public.topic_requests enable row level security;
revoke all on public.topics,public.topic_requests from public,anon,authenticated;
grant select on public.topics,public.topic_requests to authenticated;

-- Shared explicit scope for web RPC, RLS and service-role Telegram bridge.
create function kinetria_private.topic_request_visible(p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.requests r join public.profiles p on p.id=auth.uid() and p.active
 where r.id=p_id and (p.role='admin' or (p.role='handler' and r.assignee_id=p.id)
 or (p.role='manager' and kinetria_private.manages_category(r.category_id))));
$$;
create function kinetria_private.topic_visible(p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.topic_requests where topic_id=p_id)
 and not exists(select 1 from public.topic_requests where topic_id=p_id and not kinetria_private.topic_request_visible(request_id));
$$;
create policy "Topics within whole scope" on public.topics for select to authenticated using(kinetria_private.topic_visible(id));
create policy "Topic memberships within whole scope" on public.topic_requests for select to authenticated using(kinetria_private.topic_visible(topic_id));

create function kinetria_private.topic_service(p_op text,p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); actor_role public.kinetria_role; topic uuid; ids uuid[]; existing public.topics;
begin
 select role into actor_role from public.profiles where id=actor and active;
 if actor_role is null or actor_role not in('admin','manager','handler') then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_op='list' then
  return (select coalesce(jsonb_agg(x order by x."createdAt" desc),'[]') from (
   select t.id,t.title,t.description,t.is_ai_generated as "isAiGenerated",t.created_by as "createdBy",t.creator_role as "creatorRole",t.created_at as "createdAt",
    (select jsonb_agg(request_id order by request_id) from public.topic_requests where topic_id=t.id) as "ticketIds"
   from public.topics t where kinetria_private.topic_visible(t.id)) x);
 elsif p_op='rows' then
  return (select coalesce(jsonb_agg(x),'[]') from (select id,number,title,description,created_at,category_id,tags,kind,status
   from public.requests where kinetria_private.topic_request_visible(id) order by created_at desc,id limit 200) x);
 elsif p_op='delete' then
  if actor_role<>'admin' then raise exception 'Forbidden' using errcode='42501'; end if;
  delete from public.topics where id=(p_data->>'id')::uuid;
  return 'true';
 elsif p_op='save' then
  topic:=(p_data->>'id')::uuid;
  if topic is null or jsonb_typeof(p_data->'ticketIds') is distinct from 'array' or length(btrim(p_data->>'title')) not between 1 and 120 or p_data->>'title' is null then raise exception 'Invalid topic' using errcode='22023'; end if;
  select array_agg(distinct value::uuid order by value::uuid) into ids from jsonb_array_elements_text(p_data->'ticketIds');
  if coalesce(cardinality(ids),0)<1 or cardinality(ids)>200 or (coalesce((p_data->>'isAiGenerated')::boolean,false) and cardinality(ids)<2) then raise exception 'Empty or oversized topic' using errcode='22023'; end if;
  -- Lock memberships' requests so assignments cannot change midway through validation.
  perform 1 from public.requests where id=any(ids) order by id for share;
  if exists(select 1 from unnest(ids) id where not kinetria_private.topic_request_visible(id)) then raise exception 'Request unavailable' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(topic::text,0));
  select * into existing from public.topics where id=topic;
  if found then
   if existing.created_by<>actor or existing.title<>btrim(p_data->>'title') or existing.is_ai_generated<>coalesce((p_data->>'isAiGenerated')::boolean,false)
    or ids is distinct from (select array_agg(request_id order by request_id) from public.topic_requests where topic_id=topic) then raise exception 'Topic conflict' using errcode='PT409'; end if;
   return to_jsonb(topic);
  end if;
  insert into public.topics(id,title,description,is_ai_generated,created_by,creator_role)
   values(topic,btrim(p_data->>'title'),p_data->>'description',coalesce((p_data->>'isAiGenerated')::boolean,false),actor,actor_role);
  insert into public.topic_requests select topic,unnest(ids);
  return to_jsonb(topic);
 end if;
 raise exception 'Invalid operation' using errcode='22023';
end;
$$;
create function public.topic_service(p_op text,p_data jsonb default '{}') returns jsonb
language sql security invoker set search_path='' as $$ select kinetria_private.topic_service(p_op,p_data); $$;
revoke all on function kinetria_private.topic_request_visible(uuid),kinetria_private.topic_visible(uuid),kinetria_private.topic_service(text,jsonb),public.topic_service(text,jsonb) from public,anon;
grant execute on function kinetria_private.topic_request_visible(uuid),kinetria_private.topic_visible(uuid),kinetria_private.topic_service(text,jsonb),public.topic_service(text,jsonb) to authenticated;

-- Keep the existing bridge intact; only the new namespace uses the shared service.
alter function kinetria_private.telegram_bridge(bigint,text,jsonb) rename to telegram_bridge_before_topics;
create function kinetria_private.telegram_bridge(p_tg bigint,p_op text,p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid;
begin
 if p_op<>'topics' then return kinetria_private.telegram_bridge_before_topics(p_tg,p_op,p_data); end if;
 select l.user_id into actor from public.telegram_links l join public.profiles p on p.id=l.user_id and p.active where l.telegram_id=p_tg;
 if actor is null then raise exception 'Account not linked' using errcode='42501'; end if;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 return kinetria_private.topic_service(p_data->>'op',coalesce(p_data->'data','{}'));
end;
$$;
revoke all on function kinetria_private.telegram_bridge(bigint,text,jsonb),kinetria_private.telegram_bridge_before_topics(bigint,text,jsonb) from public,anon,authenticated;
grant execute on function kinetria_private.telegram_bridge(bigint,text,jsonb) to service_role;

-- Changes from Telegram invalidate the open web registry immediately.
alter publication supabase_realtime add table public.topics, public.topic_requests;
