-- Client content is isolated from internal requests. Only explicitly moderated copy is shared.
alter table public.requests add column origin text not null default 'employee' check(origin in('employee','client'));
alter table public.requests add column impact_hint text check (char_length(impact_hint)<=500);
create table public.request_enrichments (
 request_id uuid primary key references public.requests(id) on delete cascade,
 report jsonb not null, created_at timestamptz not null default now()
);
alter table public.request_enrichments enable row level security;
revoke all on public.request_enrichments from public,anon,authenticated;
grant select on public.request_enrichments to authenticated;
grant all on public.request_enrichments to service_role;
create policy "Staff scoped impact" on public.request_enrichments for select to authenticated using (
 exists(select 1 from public.profiles p where p.id=auth.uid() and p.active and p.role in('admin','manager','handler'))
 and exists(select 1 from public.requests r where r.id=request_id));

create table public.feedback (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null unique references public.requests(id),
 author_id uuid not null references public.profiles(id),
 submission_key uuid not null,
 title text not null check(char_length(title) between 1 and 120),
 description text not null check(char_length(description) between 1 and 4000),
 published boolean not null default false,
 public_title text not null default '' check(char_length(public_title)<=120),
 public_description text not null default '' check(char_length(public_description)<=4000),
 response text not null default '' check(char_length(response)<=2000),
 status text not null default 'review' check(status in('review','in_progress','implemented','closed')),
 version integer not null default 1,
 created_at timestamptz not null default now(),
 unique(author_id,submission_key)
);
create table public.feedback_votes (
 feedback_id uuid not null references public.feedback(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 primary key(feedback_id,user_id)
);
create index feedback_author_created on public.feedback(author_id,created_at desc);
alter table public.feedback enable row level security;
alter table public.feedback_votes enable row level security;
revoke all on public.feedback,public.feedback_votes from public,anon,authenticated;
grant all on public.feedback,public.feedback_votes to service_role;
-- These tables have no direct authenticated grants: all access is via the narrow RPC below.
create function kinetria_private.feedback_portal(p_op text,p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=auth.uid(); pr public.profiles; f public.feedback; rid uuid; result jsonb; owner uuid; cat text;
begin
 select * into pr from public.profiles where id=u and active;
 if not found then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_op='list' then
  select coalesce(jsonb_agg(x order by x.created_at desc),'[]') into result from (
   select entry.id,case when pr.role in('admin','manager','handler') then entry.request_id else null end as request_id,entry.author_id=u as own,
    case when entry.author_id=u or pr.role='admin' or (pr.role in('manager','handler') and exists(select 1 from public.requests r where r.id=entry.request_id and (r.assignee_id=u or kinetria_private.manages_category(r.category_id)))) then entry.title else entry.public_title end as title,
    case when entry.author_id=u or pr.role='admin' or (pr.role in('manager','handler') and exists(select 1 from public.requests r where r.id=entry.request_id and (r.assignee_id=u or kinetria_private.manages_category(r.category_id)))) then entry.description else entry.public_description end as description,
    (select p.role::text from public.profiles p where p.id=entry.author_id) as origin,entry.public_title,entry.public_description,entry.status,entry.response,entry.published,entry.version,entry.created_at,
    (select count(*) from public.feedback_votes v where v.feedback_id=entry.id) as votes,
    exists(select 1 from public.feedback_votes v where v.feedback_id=entry.id and v.user_id=u) as supported,
    (pr.role='admin' or (pr.role in('manager','handler') and exists(select 1 from public.requests r where r.id=entry.request_id and (r.assignee_id=u or kinetria_private.manages_category(r.category_id))))) as can_manage
   from public.feedback entry where entry.published or entry.author_id=u or pr.role='admin' or
    (pr.role in('manager','handler') and exists(select 1 from public.requests r where r.id=entry.request_id and (r.assignee_id=u or kinetria_private.manages_category(r.category_id))))
   order by entry.created_at desc limit 200
  ) x;
  return result;
 elsif p_op='submit' then
  if pr.role not in('client','employee') or nullif(btrim(p_data->>'title'),'') is null or nullif(btrim(p_data->>'description'),'') is null
   or char_length(p_data->>'title')>120 or char_length(p_data->>'description')>4000 or char_length(p_data->>'hint')>500 then raise exception 'Invalid input' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended(u::text,0));
  select * into f from public.feedback where author_id=u and submission_key=(p_data->>'key')::uuid;
  if found then
   if (f.title,f.description) is distinct from (btrim(p_data->>'title'),btrim(p_data->>'description')) or exists(select 1 from public.requests r where r.id=f.request_id and (r.category_id,r.kind,coalesce(r.impact_hint,'')) is distinct from (p_data->>'category',coalesce(p_data->>'kind','idea')::public.request_kind,coalesce(btrim(p_data->>'hint'),''))) then raise exception 'Conflict' using errcode='PT409'; end if;
   return jsonb_build_object('id',f.id,'request_id',f.request_id);
  end if;
  if (select count(*) from public.feedback where author_id=u and created_at>now()-interval '1 hour')>=20 then raise exception 'Rate limit' using errcode='22023'; end if;
  cat:=p_data->>'category';
  if not exists(select 1 from public.request_categories where id=cat and active) then raise exception 'Invalid category' using errcode='22023'; end if;
  select r.assignee_id into owner from kinetria_private.category_routes r join public.profiles p on p.id=r.assignee_id and p.active where r.category_id=cat and r.enabled;
  insert into public.requests(author_id,assignee_id,submission_key,category_id,kind,title,description,impact_hint,origin)
   values(u,owner,(p_data->>'key')::uuid,cat,coalesce(p_data->>'kind','idea')::public.request_kind,btrim(p_data->>'title'),btrim(p_data->>'description'),nullif(btrim(p_data->>'hint'),''),pr.role::text) returning id into rid;
  insert into public.feedback(request_id,author_id,submission_key,title,description)
   values(rid,u,(p_data->>'key')::uuid,btrim(p_data->>'title'),btrim(p_data->>'description')) returning * into f;
  insert into public.request_events(request_id,actor_role,event_type,status) values(rid,pr.role,'created','new');
  return jsonb_build_object('id',f.id,'request_id',rid);
 end if;
 select * into f from public.feedback where id=(p_data->>'id')::uuid for update;
 if not found then raise exception 'Unavailable' using errcode='PT404'; end if;
 if p_op='vote' then
  if not f.published then raise exception 'Unavailable' using errcode='PT404'; end if;
  if coalesce((p_data->>'support')::boolean,true) then
   insert into public.feedback_votes values(f.id,u) on conflict do nothing;
  else delete from public.feedback_votes where feedback_id=f.id and user_id=u; end if;
 elsif p_op='moderate' then
  if not (pr.role='admin' or (pr.role in('manager','handler') and exists(select 1 from public.requests r where r.id=f.request_id and (r.assignee_id=u or kinetria_private.manages_category(r.category_id))))) then raise exception 'Forbidden' using errcode='42501'; end if;
  if f.version is distinct from (p_data->>'version')::integer then raise exception 'Conflict' using errcode='PT409'; end if;
  if coalesce((p_data->>'published')::boolean,false) and (nullif(btrim(p_data->>'public_title'),'') is null or nullif(btrim(p_data->>'public_description'),'') is null) then raise exception 'Public copy required' using errcode='22023'; end if;
  update public.feedback set published=coalesce((p_data->>'published')::boolean,false),
   public_title=coalesce(btrim(p_data->>'public_title'),''), public_description=coalesce(btrim(p_data->>'public_description'),''),
   response=coalesce(btrim(p_data->>'response'),''),version=version+1 where id=f.id;
  -- Reuse the durable notification outbox; no private response is copied to public automatically.
  update public.requests set version=version+1 where id=f.request_id;
 else raise exception 'Invalid operation' using errcode='22023'; end if;
 return 'true';
end; $$;
create function public.feedback_portal(p_op text,p_data jsonb default '{}') returns jsonb
language sql security invoker set search_path='' as $$ select kinetria_private.feedback_portal(p_op,p_data); $$;
revoke all on function public.feedback_portal(text,jsonb),kinetria_private.feedback_portal(text,jsonb) from public,anon;
grant execute on function public.feedback_portal(text,jsonb),kinetria_private.feedback_portal(text,jsonb) to authenticated;
create policy "Portal categories" on public.request_categories for select to authenticated using(active and exists(select 1 from public.profiles p where p.id=auth.uid() and p.active));

create function kinetria_private.feedback_status() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update public.feedback set status=case new.status when 'in_progress' then 'in_progress' when 'implemented' then 'implemented' when 'closed' then 'closed' when 'rejected' then 'closed' else 'review' end,version=version+1 where request_id=new.id and old.status is distinct from new.status;
 return new;
end; $$;
revoke all on function kinetria_private.feedback_status() from public,anon,authenticated;
create trigger feedback_status after update of status on public.requests for each row execute function kinetria_private.feedback_status();

create function kinetria_private.submit_with_impact(p_key uuid,p_category text,p_kind public.request_kind,p_title text,p_description text,p_proposal text,p_sentiment smallint,p_tags text[],p_files jsonb,p_hint text default '') returns uuid
language plpgsql security definer set search_path='' as $$
declare rid uuid; existing public.requests;
begin
 if char_length(p_hint)>500 then raise exception 'Invalid hint' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 select * into existing from public.requests where author_id=auth.uid() and submission_key=p_key;
 if found and coalesce(existing.impact_hint,'') is distinct from btrim(p_hint) then raise exception 'Conflict' using errcode='PT409'; end if;
 rid:=kinetria_private.submit_with_files(p_key,p_category,p_kind,p_title,p_description,p_proposal,p_sentiment,p_tags,p_files);
 update public.requests set impact_hint=nullif(btrim(p_hint),'') where id=rid;
 return rid;
end; $$;
create function public.submit_with_impact(p_key uuid,p_category text,p_kind public.request_kind,p_title text,p_description text,p_proposal text,p_sentiment smallint,p_tags text[],p_files jsonb,p_hint text default '') returns uuid
language sql security invoker set search_path='' as $$ select kinetria_private.submit_with_impact(p_key,p_category,p_kind,p_title,p_description,p_proposal,p_sentiment,p_tags,p_files,p_hint); $$;
revoke all on function public.submit_with_impact(uuid,text,public.request_kind,text,text,text,smallint,text[],jsonb,text),kinetria_private.submit_with_impact(uuid,text,public.request_kind,text,text,text,smallint,text[],jsonb,text) from public,anon;
grant execute on function public.submit_with_impact(uuid,text,public.request_kind,text,text,text,smallint,text[],jsonb,text),kinetria_private.submit_with_impact(uuid,text,public.request_kind,text,text,text,smallint,text[],jsonb,text) to authenticated;

-- Select the latest created requests before reversing them for the Telegram display.
-- Keep the existing identity checks, explicit role scope and function grants.
create or replace function kinetria_private.telegram_bridge(p_tg bigint,p_op text,p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid; pr public.profiles; r public.requests; t uuid; result jsonb; q jsonb; upd bigint;
begin
 if p_tg<=0 then raise exception 'Invalid Telegram ID'; end if;
 if p_op='link' then
   delete from public.telegram_tokens where token=(p_data->>'token')::uuid and expires_at>now() returning user_id into u;
   if u is null or not exists(select 1 from public.profiles where id=u and active) then raise exception 'Invalid or expired link'; end if;
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
 select * into pr from public.profiles where id=u and active;
 if not found then raise exception 'Account not linked' using errcode='42501'; end if;
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 if p_op='portal' then return kinetria_private.feedback_portal(p_data->>'op',coalesce(p_data->'data','{}'));
 elsif pr.role='client' and p_op not in('context','state','unlink') then raise exception 'Forbidden' using errcode='42501';
 elsif p_op='unlink' then
   delete from public.telegram_links where telegram_id=p_tg;
   delete from public.telegram_sessions where telegram_id=p_tg;
   return 'true';
 elsif p_op='context' then
   return jsonb_build_object('role',pr.role,'name',pr.display_name,'state',coalesce((select state from public.telegram_sessions where telegram_id=p_tg),'{}'), 'categories',(select jsonb_agg(jsonb_build_object('id',id,'name',name_ru) order by id) from public.request_categories where active));
 elsif p_op='state' then
   insert into public.telegram_sessions values(p_tg,p_data,now()) on conflict(telegram_id) do update set state=excluded.state,updated_at=now(); return 'true';
 elsif p_op='submit' then
   t:=kinetria_private.submit_with_impact((p_data->>'key')::uuid,p_data->>'category',(p_data->>'kind')::public.request_kind,p_data->>'title',p_data->>'description',p_data->>'proposal',(p_data->>'sentiment')::smallint,array(select jsonb_array_elements_text(p_data->'tags')),coalesce(p_data->'files','[]'),coalesce(p_data->>'hint',''));
   return jsonb_build_object('id',t,'number',(select number from public.requests where id=t));
 end if;
 -- Explicit scope predicate is required because the bridge itself is SECURITY DEFINER.
 if p_op='qvin' then
  if pr.role not in('admin','manager') then raise exception 'Forbidden' using errcode='42501'; end if;
  select coalesce(jsonb_agg(x),'[]') into result from(select selected.id,selected.title,selected.description,selected.status,selected.created_at,selected.category_id,selected.origin,e.report from public.requests selected left join public.request_enrichments e on e.request_id=selected.id where pr.role='admin' or kinetria_private.manages_category(selected.category_id) order by selected.created_at desc limit 100) x;
  return result;
 end if;
 if p_op in ('list','stats','reserve') then
   select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc, x.number desc),'[]') into result from (
     select id,number,title,status,assignee_id,due_at,created_at from public.requests where
      (p_op<>'reserve' or (pr.role='admin' and assignee_id is null and status not in ('implemented','rejected','closed'))) and
      (pr.role='admin' or (pr.role='employee' and author_id=u) or (pr.role='handler' and assignee_id=u) or (pr.role='manager' and kinetria_private.manages_category(category_id)))
      order by created_at desc,number desc limit (case when p_op='stats' then 30 else 10 end)) x;
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

create or replace function kinetria_private.telegram_link_token() returns uuid
language plpgsql security definer set search_path='' as $$
declare t uuid;
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and active) then raise exception 'Forbidden' using errcode='42501'; end if;
 insert into public.telegram_tokens(user_id) values(auth.uid()) on conflict(user_id) do update set token=gen_random_uuid(),expires_at=now()+interval '10 minutes' returning token into t;
 return t;
end; $$;

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

notify pgrst, 'reload schema';
