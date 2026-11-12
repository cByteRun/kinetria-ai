-- Additive migration: existing requests, history and role scopes are preserved.
alter table public.requests
  add column department text not null default 'Операционные процессы' check (char_length(department) between 1 and 100),
  add column priority text not null default 'normal' check (priority in ('low','normal','high')),
  add column due_at date,
  add column first_response_at timestamptz,
  add column resolved_at timestamptz,
  add column acknowledged_at timestamptz,
  add column is_demo boolean not null default false;
alter table public.request_categories
  add column department text not null default 'Операционные процессы',
  add column sla_days integer not null default 3 check (sla_days between 1 and 90);
alter table kinetria_private.category_routes add column enabled boolean not null default true;
alter table public.request_events drop constraint request_events_event_type_check;
alter table public.request_events add constraint request_events_event_type_check
  check(event_type in ('created','assigned','reviewed','replied','commented','metadata','acknowledged'));

update public.requests r set
  due_at = (r.created_at at time zone 'Asia/Qyzylorda')::date + 3,
  is_demo = coalesce(r.source_ref ~ '^A-[0-9]+$',false),
  resolved_at = case when status in ('implemented','rejected','closed') then updated_at end,
  first_response_at = (select min(e.created_at) from public.request_events e where e.request_id=r.id and e.event_type='reviewed');
create index requests_due_open on public.requests(due_at) where status not in ('implemented','rejected','closed');

create function kinetria_private.request_lifecycle() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if TG_OP = 'INSERT' then
    select c.department, (now() at time zone 'Asia/Qyzylorda')::date + c.sla_days
      into new.department, new.due_at from public.request_categories c where c.id=new.category_id;
  else
    if old.status='new' and new.status<>'new' then new.first_response_at := coalesce(old.first_response_at,now()); end if;
    if old.status not in ('implemented','rejected','closed') and new.status in ('implemented','rejected','closed') then new.resolved_at:=now(); end if;
  end if;
  return new;
end;
$$;
revoke all on function kinetria_private.request_lifecycle() from public,anon,authenticated;
create trigger request_lifecycle before insert or update on public.requests for each row execute function kinetria_private.request_lifecycle();

create table public.request_receipts (
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  request_id uuid not null references public.requests(id) on delete cascade,
  seen_version integer not null check(seen_version>0),
  primary key(user_id,request_id)
);
alter table public.request_receipts enable row level security;
revoke all on public.request_receipts from public,anon,authenticated;
grant select,insert,update on public.request_receipts to authenticated;
create policy "Read own receipts" on public.request_receipts for select to authenticated using(user_id=(select auth.uid()));
create policy "Insert own visible receipt" on public.request_receipts for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.requests r where r.id=request_id and r.version=seen_version));
create policy "Update own visible receipt" on public.request_receipts for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()) and exists(select 1 from public.requests r where r.id=request_id and r.version=seen_version));

create function kinetria_private.dashboard_action(p_id uuid,p_version integer,p_action text,p_message text default '',p_priority text default 'normal',p_due date default null,p_assignee uuid default null)
returns void language plpgsql security definer set search_path = '' as $$
declare v_actor uuid:=auth.uid(); v_role public.kinetria_role; r public.requests;
begin
  select role into v_role from public.profiles where id=v_actor and active;
  select * into r from public.requests where id=p_id and
    ((v_role='employee' and author_id=v_actor) or v_role='admin' or
      (v_role='manager' and kinetria_private.manages_category(category_id)) or
      (v_role='handler' and assignee_id=v_actor)) for update;
  if not found then raise exception 'Unavailable' using errcode='PT404'; end if;
  if r.version<>p_version then raise exception 'Version conflict' using errcode='PT409'; end if;
  if p_action='acknowledged' then
    if v_role<>'employee' or r.status not in ('implemented','rejected','closed') or nullif(btrim(r.decision),'') is null then raise exception 'Invalid acknowledgement' using errcode='22023'; end if;
    if r.acknowledged_at is not null then return; end if;
    update public.requests set acknowledged_at=now() where id=p_id;
  elsif p_action='commented' then
    if nullif(btrim(p_message),'') is null or char_length(p_message)>2000 then raise exception 'Invalid comment' using errcode='22023'; end if;
  elsif p_action='metadata' then
    if v_role not in ('manager','handler','admin') or r.status in ('implemented','rejected','closed') or p_priority is null or p_priority not in ('low','normal','high') or p_due is null then raise exception 'Invalid metadata' using errcode='22023'; end if;
    update public.requests set priority=p_priority,due_at=p_due where id=p_id;
    p_message:='Приоритет: '||p_priority||'. Срок: '||p_due::text;
  elsif p_action='assigned' then
    if v_role<>'admin' or r.assignee_id is not null or r.status in ('implemented','rejected','closed') or not exists(select 1 from public.profiles where id=p_assignee and active and role='manager') then raise exception 'Invalid reserve assignment' using errcode='22023'; end if;
    insert into kinetria_private.manager_categories(manager_id,category_id) values(p_assignee,r.category_id) on conflict do nothing;
    update public.requests set assignee_id=p_assignee where id=p_id;
    p_message:='Назначен ответственный из резервной очереди';
  else raise exception 'Invalid action' using errcode='22023'; end if;
  update public.requests set version=version+1,updated_at=now() where id=p_id;
  insert into public.request_events(request_id,actor_role,event_type,status,message) values(p_id,v_role,p_action,r.status,nullif(btrim(p_message),''));
end;
$$;
create function public.dashboard_action(p_id uuid,p_version integer,p_action text,p_message text default '',p_priority text default 'normal',p_due date default null,p_assignee uuid default null)
returns void language sql security invoker set search_path = '' as $$
 select kinetria_private.dashboard_action(p_id,p_version,p_action,p_message,p_priority,p_due,p_assignee);
$$;
revoke all on function kinetria_private.dashboard_action(uuid,integer,text,text,text,date,uuid),public.dashboard_action(uuid,integer,text,text,text,date,uuid) from public,anon;
grant execute on function kinetria_private.dashboard_action(uuid,integer,text,text,text,date,uuid),public.dashboard_action(uuid,integer,text,text,text,date,uuid) to authenticated;

create or replace function kinetria_private.submit_classified_request(
  p_key uuid, p_category text, p_kind public.request_kind,
  p_title text, p_description text, p_proposal text, p_sentiment smallint, p_tags text[]
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_request public.requests;
  v_assignee uuid;
begin
  if not exists (select 1 from public.profiles where id = v_actor and active and role = 'employee') then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  if p_kind is null or p_kind not in ('problem', 'idea') or p_sentiment is null then
    raise exception 'Invalid classification' using errcode = '22023';
  end if;

  select p.id into v_assignee from kinetria_private.category_routes r
    join public.profiles p on p.id = r.assignee_id
    where r.category_id = p_category and r.enabled and p.active and p.role in ('manager', 'handler');

  insert into public.requests (author_id, assignee_id, submission_key, category_id, kind, title, description, proposal, sentiment, tags)
  select v_actor, v_assignee, p_key, p_category, p_kind, btrim(p_title), btrim(p_description), nullif(btrim(p_proposal), ''), p_sentiment, p_tags
  where exists (select 1 from public.request_categories where id = p_category and active)
  on conflict (author_id, submission_key) do nothing returning * into v_request;

  if found then
    insert into public.request_events (request_id, actor_role, event_type, status)
      values (v_request.id, 'employee', 'created', 'new');
    if v_assignee is not null then
      insert into public.request_events (request_id, actor_role, event_type, status)
        values (v_request.id, 'employee', 'assigned', 'new');
    end if;
  else
    select * into v_request from public.requests where author_id = v_actor and submission_key = p_key;
    if not found then
      raise exception 'Invalid category' using errcode = '22023';
    end if;
    if (v_request.category_id, v_request.kind, v_request.title, v_request.description, v_request.proposal, v_request.sentiment, v_request.tags)
      is distinct from (p_category, p_kind, btrim(p_title), btrim(p_description), nullif(btrim(p_proposal), ''), p_sentiment, p_tags) then
      raise exception 'Submission conflict' using errcode = 'PT409';
    end if;
  end if;
  return v_request.id;
end;
$$;

create or replace function kinetria_private.routing_preview() returns table(category_id text, recipient text)
language sql stable security definer set search_path = '' as $$
  select c.id, coalesce(p.display_name, case when p.role = 'manager' then 'Руководитель направления'
    when p.role = 'handler' then 'Ответственный специалист' else 'Резервная очередь · администратор' end)
  from public.request_categories c
  left join kinetria_private.category_routes r on r.category_id = c.id and r.enabled
  left join public.profiles p on p.id = r.assignee_id and p.active and p.role in ('manager', 'handler')
  where exists(select 1 from public.profiles actor where actor.id = auth.uid() and actor.active and actor.role <> 'client');
$$;

create or replace function kinetria_private.save_routing(p_category text,p_manager uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and active and role='admin') then raise exception 'Forbidden' using errcode='42501'; end if;
 perform 1 from public.request_categories where id=p_category for update;
 if not found or (p_manager is not null and not exists(select 1 from public.profiles where id=p_manager and active and role='manager')) then raise exception 'Invalid route' using errcode='22023'; end if;
 if p_manager is null then
   update kinetria_private.category_routes set enabled=false where category_id=p_category;
 else
   insert into kinetria_private.manager_categories values(p_manager,p_category) on conflict do nothing;
   insert into kinetria_private.category_routes(category_id,assignee_id,enabled) values(p_category,p_manager,true)
    on conflict(category_id) do update set assignee_id=excluded.assignee_id,enabled=true;
 end if;
end;
$$;
create function kinetria_private.save_category(p_id text,p_name text,p_active boolean,p_department text,p_days integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
 if not exists(select 1 from public.profiles where id=auth.uid() and active and role='admin') then raise exception 'Forbidden' using errcode='42501'; end if;
 if p_id !~ '^[a-z0-9-]{1,64}$' or char_length(btrim(p_name)) not between 3 and 100 or char_length(btrim(p_department)) not between 1 and 100 or p_days not between 1 and 90 or p_active is null then raise exception 'Invalid category' using errcode='22023'; end if;
 insert into public.request_categories(id,name_ru,name_en,name_kk,active,department,sla_days) values(p_id,btrim(p_name),btrim(p_name),btrim(p_name),p_active,btrim(p_department),p_days)
 on conflict(id) do update set name_ru=excluded.name_ru,active=excluded.active,department=excluded.department,sla_days=excluded.sla_days;
end;
$$;
create function public.save_category(p_id text,p_name text,p_active boolean,p_department text,p_days integer) returns void
language sql security invoker set search_path = '' as $$ select kinetria_private.save_category(p_id,p_name,p_active,p_department,p_days); $$;
revoke all on function kinetria_private.save_category(text,text,boolean,text,integer), public.save_category(text,text,boolean,text,integer) from public,anon;
grant execute on function kinetria_private.save_category(text,text,boolean,text,integer), public.save_category(text,text,boolean,text,integer) to authenticated;
