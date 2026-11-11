create schema if not exists kinetria_private;
revoke all on schema kinetria_private from public, anon, authenticated;
grant usage on schema kinetria_private to authenticated;

alter table public.profiles add column display_name text;

create type public.request_kind as enum ('problem', 'idea', 'praise');
create type public.request_status as enum (
  'new', 'review', 'clarification', 'in_progress', 'implemented', 'rejected', 'closed'
);

create table public.request_categories (
  id text primary key,
  name_ru text not null,
  name_en text not null,
  name_kk text not null,
  active boolean not null default true
);

create table kinetria_private.category_routes (
  category_id text primary key references public.request_categories(id),
  assignee_id uuid not null references public.profiles(id) on delete cascade
);

create table public.requests (
  id uuid primary key default gen_random_uuid(),
  number bigint generated always as identity unique,
  source_ref text unique,
  author_id uuid not null references auth.users(id),
  assignee_id uuid references public.profiles(id) on delete set null,
  submission_key uuid not null,
  category_id text not null references public.request_categories(id),
  kind public.request_kind not null,
  title text not null check (char_length(title) <= 120 and title ~ '[^[:space:]]'),
  description text not null check (char_length(description) <= 4000 and description ~ '[^[:space:]]'),
  proposal text check (char_length(proposal) <= 2000),
  status public.request_status not null default 'new',
  decision text check (char_length(decision) <= 2000),
  next_step text check (char_length(next_step) <= 1000),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (author_id, submission_key)
);

create table public.request_events (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.requests(id) on delete cascade,
  actor_role public.kinetria_role not null,
  event_type text not null check (event_type in ('created', 'assigned', 'reviewed', 'replied')),
  status public.request_status not null,
  message text,
  next_step text,
  created_at timestamptz not null default now()
);

create index requests_author_updated on public.requests (author_id, updated_at desc);
create index requests_assignee_updated on public.requests (assignee_id, updated_at desc);
create index requests_updated on public.requests (updated_at desc);
create index request_events_request_history on public.request_events (request_id, id);

alter table public.request_categories enable row level security;
alter table public.requests enable row level security;
alter table public.request_events enable row level security;
revoke all on public.request_categories, public.requests, public.request_events from public, anon, authenticated;
grant select on public.request_categories, public.requests, public.request_events to authenticated;

create policy "Staff read categories" on public.request_categories for select to authenticated
using (exists (select 1 from public.profiles p where p.id = (select auth.uid())
  and p.active and p.role in ('employee', 'manager', 'handler', 'admin')));

create policy "Staff read requests in scope" on public.requests for select to authenticated
using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.active
  and (p.role = 'manager' or (p.role = 'employee' and author_id = p.id)
    or (p.role = 'handler' and assignee_id = p.id))));

create policy "Staff read history in scope" on public.request_events for select to authenticated
using (exists (select 1 from public.requests r where r.id = request_id));

insert into public.request_categories (id, name_ru, name_en, name_kk) values
  ('collaboration', 'Межотдельное взаимодействие', 'Cross-team collaboration', 'Бөлімдер арасындағы жұмыс'),
  ('visibility', 'Информационная прозрачность', 'Information visibility', 'Ақпараттың ашықтығы'),
  ('catalog', 'Каталог и данные', 'Catalog and data', 'Каталог және деректер'),
  ('training', 'Обучение', 'Training', 'Оқыту'),
  ('documents', 'Документооборот', 'Document workflows', 'Құжат айналымы'),
  ('processes', 'Регламенты', 'Procedures', 'Рәсімдер'),
  ('it', 'Интеграции и IT', 'Integrations and IT', 'Интеграциялар және IT'),
  ('mentoring', 'Знания и наставничество', 'Knowledge and mentoring', 'Білім және тәлімгерлік'),
  ('contracts', 'Договорная работа', 'Contracts', 'Келісімшарттар'),
  ('tasks', 'Задачи и коммуникации', 'Tasks and communication', 'Тапсырмалар және байланыс'),
  ('timing', 'Оперативность', 'Response times', 'Жауап беру жылдамдығы'),
  ('communication', 'Коммуникации', 'Communication', 'Байланыс'),
  ('projects', 'Проектная деятельность', 'Project work', 'Жоба жұмысы'),
  ('planning', 'Планирование ресурсов', 'Resource planning', 'Ресурстарды жоспарлау'),
  ('briefs', 'Постановка задач', 'Task briefs', 'Тапсырма қою'),
  ('workplace', 'Корпоративная среда', 'Workplace', 'Жұмыс ортасы'),
  ('filing', 'Хранение документов', 'Document storage', 'Құжаттарды сақтау'),
  ('results', 'Прозрачность результатов', 'Visibility of outcomes', 'Нәтижелердің ашықтығы');

create function kinetria_private.submit_request(
  p_key uuid, p_category text, p_kind public.request_kind,
  p_title text, p_description text, p_proposal text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_request public.requests;
  v_assignee uuid;
begin
  if not exists (select 1 from public.profiles where id = v_actor and active and role = 'employee') then
    raise exception 'Forbidden' using errcode = '42501';
  end if;

  select p.id into v_assignee from kinetria_private.category_routes r
    join public.profiles p on p.id = r.assignee_id
    where r.category_id = p_category and p.active and p.role in ('manager', 'handler');

  insert into public.requests (author_id, assignee_id, submission_key, category_id, kind, title, description, proposal)
  select v_actor, v_assignee, p_key, p_category, p_kind, btrim(p_title), btrim(p_description), nullif(btrim(p_proposal), '')
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
    if (v_request.category_id, v_request.kind, v_request.title, v_request.description, v_request.proposal)
      is distinct from (p_category, p_kind, btrim(p_title), btrim(p_description), nullif(btrim(p_proposal), '')) then
      raise exception 'Submission conflict' using errcode = 'PT409';
    end if;
  end if;
  return v_request.id;
end;
$$;

create function kinetria_private.review_request(
  p_id uuid, p_version integer, p_action text, p_status public.request_status,
  p_message text, p_next_step text, p_assignee uuid
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_role public.kinetria_role;
  v_request public.requests;
  v_status public.request_status;
  v_assignee uuid;
  v_message text := case when p_message ~ '[^[:space:]]' then btrim(p_message) end;
  v_next_step text := case when p_next_step ~ '[^[:space:]]' then btrim(p_next_step) end;
  v_terminal boolean := coalesce(p_status in ('implemented', 'rejected', 'closed'), false);
begin
  select role into v_role from public.profiles where id = v_actor and active;
  select * into v_request from public.requests where id = p_id and (
    v_role = 'manager' or (v_role = 'handler' and assignee_id = v_actor)
      or (v_role = 'employee' and author_id = v_actor)
  ) for update;
  if not found then raise exception 'Request unavailable' using errcode = 'PT404'; end if;
  if v_request.version is distinct from p_version then
    raise exception 'Version conflict' using errcode = 'PT409';
  end if;
  if v_request.status in ('implemented', 'rejected', 'closed')
    or char_length(v_message) > 2000 or char_length(v_next_step) > 1000 then
    raise exception 'Invalid action' using errcode = '22023';
  end if;

  v_status := v_request.status;
  v_assignee := v_request.assignee_id;
  case p_action
    when 'assigned' then
      if v_role <> 'manager' or p_assignee is not distinct from v_assignee or
        (p_assignee is not null and not exists (
          select 1 from public.profiles where id = p_assignee and active and role in ('manager', 'handler')
        )) then raise exception 'Invalid assignment' using errcode = '22023'; end if;
      v_assignee := p_assignee;
      v_message := null;
      v_next_step := null;
    when 'replied' then
      if v_role <> 'employee' or v_status <> 'clarification' or v_message is null then
        raise exception 'Invalid reply' using errcode = '22023';
      end if;
      v_status := 'review';
      v_next_step := null;
    when 'reviewed' then
      if v_role not in ('manager', 'handler') or not coalesce(
        (v_status = 'new' and p_status = 'review') or
        (v_status in ('review', 'in_progress') and p_status = 'clarification' and v_message is not null) or
        (v_status = 'review' and p_status = 'in_progress' and v_next_step is not null) or
        (v_status in ('review', 'in_progress') and v_terminal and v_message is not null), false) then
        raise exception 'Invalid transition' using errcode = '22023';
      end if;
      v_status := p_status;
    else raise exception 'Invalid action' using errcode = '22023';
  end case;

  update public.requests set status = v_status, assignee_id = v_assignee,
    decision = case when p_action = 'reviewed' and v_terminal then v_message else decision end,
    next_step = case when p_action = 'reviewed' then v_next_step else next_step end,
    version = version + 1, updated_at = now() where id = p_id;
  insert into public.request_events (request_id, actor_role, event_type, status, message, next_step)
    values (p_id, v_role, p_action, v_status, v_message, v_next_step);
end;
$$;

create function kinetria_private.request_assignees() returns table (id uuid, role public.kinetria_role, display_name text)
language sql stable security definer set search_path = '' as $$
  select p.id, p.role, p.display_name from public.profiles p
  where p.active and p.role in ('manager', 'handler')
    and exists (select 1 from public.profiles where id = auth.uid() and active and role = 'manager')
  order by p.display_name, p.id;
$$;

create function public.submit_request(
  p_key uuid, p_category text, p_kind public.request_kind,
  p_title text, p_description text, p_proposal text
) returns uuid language sql security invoker set search_path = '' as $$
  select kinetria_private.submit_request(p_key, p_category, p_kind, p_title, p_description, p_proposal);
$$;

create function public.review_request(
  p_id uuid, p_version integer, p_action text, p_status public.request_status,
  p_message text, p_next_step text, p_assignee uuid
) returns void language sql security invoker set search_path = '' as $$
  select kinetria_private.review_request(p_id, p_version, p_action, p_status, p_message, p_next_step, p_assignee);
$$;

create function public.request_assignees() returns table (id uuid, role public.kinetria_role, display_name text)
language sql stable security invoker set search_path = '' as $$
  select * from kinetria_private.request_assignees();
$$;

revoke execute on all functions in schema kinetria_private from public, anon, authenticated;
grant execute on all functions in schema kinetria_private to authenticated;
revoke execute on function public.submit_request(uuid, text, public.request_kind, text, text, text),
  public.review_request(uuid, integer, text, public.request_status, text, text, uuid),
  public.request_assignees() from public, anon, authenticated;
grant execute on function public.submit_request(uuid, text, public.request_kind, text, text, text),
  public.review_request(uuid, integer, text, public.request_status, text, text, uuid),
  public.request_assignees() to authenticated;
