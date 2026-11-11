alter table public.requests
  add column sentiment smallint check (sentiment between 0 and 10),
  add column tags text[] not null default '{}' check (
    cardinality(tags) <= 8 and coalesce(array_ndims(tags), 1) = 1
    and array_position(tags, null) is null and char_length(array_to_string(tags, '')) <= 384
  );

create function kinetria_private.submit_classified_request(
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
    where r.category_id = p_category and p.active and p.role in ('manager', 'handler');

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
create function public.submit_classified_request(
  p_key uuid, p_category text, p_kind public.request_kind, p_title text,
  p_description text, p_proposal text, p_sentiment smallint, p_tags text[]
) returns uuid language sql security invoker set search_path = '' as $$
  select kinetria_private.submit_classified_request(p_key, p_category, p_kind, p_title,
    p_description, p_proposal, p_sentiment, p_tags);
$$;

revoke execute on function kinetria_private.submit_classified_request(uuid, text, public.request_kind, text, text, text, smallint, text[]),
  public.submit_classified_request(uuid, text, public.request_kind, text, text, text, smallint, text[]) from public, anon;
grant execute on function kinetria_private.submit_classified_request(uuid, text, public.request_kind, text, text, text, smallint, text[]),
  public.submit_classified_request(uuid, text, public.request_kind, text, text, text, smallint, text[]) to authenticated;
