-- Names are readable only in the context of an already authorized request.
create function kinetria_private.request_people(p_id uuid)
returns table(author_name text,assignee_name text)
language sql stable security definer set search_path = '' as $$
 select coalesce(author.display_name,'Сотрудник'), coalesce(assignee.display_name,'Резервная очередь')
 from public.requests r
 join public.profiles actor on actor.id=auth.uid() and actor.active
 join public.profiles author on author.id=r.author_id
 left join public.profiles assignee on assignee.id=r.assignee_id
 where r.id=p_id and (actor.role='admin' or
  (actor.role='employee' and r.author_id=actor.id) or
  (actor.role='handler' and r.assignee_id=actor.id) or
  (actor.role='manager' and kinetria_private.manages_category(r.category_id)));
$$;
create function public.request_people(p_id uuid) returns table(author_name text,assignee_name text)
language sql stable security invoker set search_path = '' as $$ select * from kinetria_private.request_people(p_id); $$;
revoke all on function kinetria_private.request_people(uuid), public.request_people(uuid) from public,anon;
grant execute on function kinetria_private.request_people(uuid), public.request_people(uuid) to authenticated;
