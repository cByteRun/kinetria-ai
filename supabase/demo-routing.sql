-- Apply after all migrations and seed:demo in the synthetic project.
begin;
insert into kinetria_private.manager_categories (manager_id, category_id)
select u.id, c.id from public.request_categories c
join auth.users u on u.email = case
  when c.id in ('catalog', 'it', 'communication', 'filing') then 'manager-it@kinetria.example'
  when c.id in ('training', 'mentoring', 'workplace') then 'manager-people@kinetria.example'
  else 'manager@kinetria.example' end
where u.raw_app_meta_data ->> 'kinetria_demo' = 'true'
on conflict do nothing;
delete from kinetria_private.manager_categories s using auth.users u
where u.id = s.manager_id and u.email = 'manager@kinetria.example'
  and u.raw_app_meta_data ->> 'kinetria_demo' = 'true'
  and s.category_id in ('catalog', 'it', 'communication', 'filing', 'training', 'mentoring', 'workplace');
insert into kinetria_private.category_routes (category_id, assignee_id)
select s.category_id, s.manager_id from kinetria_private.manager_categories s
join auth.users u on u.id = s.manager_id
where u.raw_app_meta_data ->> 'kinetria_demo' = 'true'
on conflict(category_id) do update set assignee_id = excluded.assignee_id;
insert into kinetria_private.category_routes (category_id, assignee_id)
select demo.category_id, u.id
from (values ('collaboration', 'handler'), ('catalog', 'handler-catalog'), ('training', 'handler-training')) demo(category_id, account)
join auth.users u on u.email = demo.account || '@kinetria.example'
join public.profiles p on p.id = u.id and p.active and p.role = 'handler'
where u.raw_app_meta_data ->> 'kinetria_demo' = 'true'
on conflict(category_id) do update set assignee_id = excluded.assignee_id;
update public.requests r set assignee_id = route.assignee_id
from kinetria_private.category_routes route
where r.category_id = route.category_id and r.source_ref like 'A-%';
commit;
