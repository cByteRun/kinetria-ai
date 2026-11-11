create table kinetria_private.manager_categories (
  manager_id uuid not null references public.profiles(id) on delete cascade,
  category_id text not null references public.request_categories(id),
  primary key (manager_id, category_id)
);

-- Existing assignments define the initial manager scope.
insert into kinetria_private.manager_categories
select r.assignee_id, r.category_id from kinetria_private.category_routes r
join public.profiles p on p.id = r.assignee_id where p.role = 'manager';

create function kinetria_private.manages_category(p_category text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from kinetria_private.manager_categories s
    join public.profiles p on p.id = s.manager_id
    where s.manager_id = auth.uid() and s.category_id = p_category and p.active and p.role = 'manager');
$$;
revoke all on function kinetria_private.manages_category(text) from public, anon;
grant execute on function kinetria_private.manages_category(text) to authenticated;

drop policy "Staff read requests in scope" on public.requests;
create policy "Staff read requests in scope" on public.requests for select to authenticated
using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.active
  and (p.role = 'admin' or (p.role = 'manager' and kinetria_private.manages_category(category_id))
    or (p.role = 'employee' and author_id = p.id)
    or (p.role = 'handler' and assignee_id = p.id))));

create function kinetria_private.routing_preview() returns table(category_id text, recipient text)
language sql stable security definer set search_path = '' as $$
  select c.id, coalesce(p.display_name, case when p.role = 'manager' then 'Руководитель направления'
    when p.role = 'handler' then 'Ответственный специалист' else 'Резервная очередь · администратор' end)
  from public.request_categories c
  left join kinetria_private.category_routes r on r.category_id = c.id
  left join public.profiles p on p.id = r.assignee_id and p.active and p.role in ('manager', 'handler')
  where exists(select 1 from public.profiles actor where actor.id = auth.uid() and actor.active and actor.role <> 'client');
$$;
create function public.routing_preview() returns table(category_id text, recipient text)
language sql stable security invoker set search_path = '' as $$
  select * from kinetria_private.routing_preview();
$$;
revoke execute on function kinetria_private.routing_preview(), public.routing_preview() from public, anon;
grant execute on function kinetria_private.routing_preview(), public.routing_preview() to authenticated;
create or replace function kinetria_private.review_request(
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
    (v_role = 'manager' and kinetria_private.manages_category(category_id)) or (v_role = 'handler' and assignee_id = v_actor)
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
          select 1 from public.profiles where id = p_assignee and active and role in ('manager', 'handler') and (role = 'handler' or exists (select 1 from kinetria_private.manager_categories s where s.manager_id = p_assignee and s.category_id = v_request.category_id))
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


create function kinetria_private.routing_managers() returns table(id uuid, display_name text)
language sql stable security definer set search_path = '' as $$
  select p.id, coalesce(p.display_name, 'Руководитель') from public.profiles p
  where p.active and p.role = 'manager' and exists(
    select 1 from public.profiles a where a.id = auth.uid() and a.active and a.role = 'admin');
$$;
create function public.routing_managers() returns table(id uuid, display_name text)
language sql stable security invoker set search_path = '' as $$
  select * from kinetria_private.routing_managers();
$$;
create function kinetria_private.save_routing(p_category text, p_manager uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.profiles where id = auth.uid() and active and role = 'admin') then
    raise exception 'Forbidden' using errcode = '42501';
  end if;
  perform 1 from public.request_categories where id = p_category for update;
  if not found or not exists(select 1 from public.profiles where id = p_manager and active and role = 'manager') then
    raise exception 'Invalid route' using errcode = '22023';
  end if;
  delete from kinetria_private.manager_categories where category_id = p_category;
  insert into kinetria_private.manager_categories values (p_manager, p_category);
  insert into kinetria_private.category_routes values(p_category, p_manager)
    on conflict(category_id) do update set assignee_id = excluded.assignee_id;
end;
$$;
create function public.save_routing(p_category text, p_manager uuid) returns void
language sql security invoker set search_path = '' as $$
  select kinetria_private.save_routing(p_category, p_manager);
$$;
revoke execute on function kinetria_private.routing_managers(), public.routing_managers(),
 kinetria_private.save_routing(text, uuid), public.save_routing(text, uuid) from public, anon;
grant execute on function kinetria_private.routing_managers(), public.routing_managers(),
 kinetria_private.save_routing(text, uuid), public.save_routing(text, uuid) to authenticated;
