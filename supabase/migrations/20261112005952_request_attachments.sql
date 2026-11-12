-- Small materials from the prototype are stored in the existing Postgres service.
-- Limit: three files of 1 MiB per request; all reads follow request RLS.
create table public.request_attachments (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null references public.requests(id) on delete cascade,
 name text not null check(char_length(name) between 1 and 200 and name !~ '[\r\n]'),
 content text not null,
 size integer not null check(size between 1 and 1048576),
 created_at timestamptz not null default now(),
 unique(request_id,name),
 check(octet_length(content)<=1398104 and octet_length(decode(content,'base64'))=size)
);
alter table public.request_attachments enable row level security;
revoke all on public.request_attachments from public,anon,authenticated;
grant select on public.request_attachments to authenticated;
create policy "Read materials of visible requests" on public.request_attachments for select to authenticated using(exists(select 1 from public.requests r where r.id=request_id));
create function kinetria_private.submit_with_files(p_key uuid,p_category text,p_kind public.request_kind,p_title text,p_description text,p_proposal text,p_sentiment smallint,p_tags text[],p_files jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; f jsonb;
begin
 if jsonb_typeof(p_files) is distinct from 'array' or jsonb_array_length(p_files)>3 then raise exception 'Invalid files' using errcode='22023'; end if;
 v_id:=kinetria_private.submit_classified_request(p_key,p_category,p_kind,p_title,p_description,p_proposal,p_sentiment,p_tags);
 perform 1 from public.requests where id=v_id for update;
 for f in select value from jsonb_array_elements(p_files) loop
   insert into public.request_attachments(request_id,name,content,size) values(v_id,f->>'name',f->>'content',(f->>'size')::integer) on conflict(request_id,name) do nothing;
 end loop;
 if (select count(*) from public.request_attachments where request_id=v_id)>3 then raise exception 'Too many files' using errcode='22023'; end if;
 return v_id;
end;
$$;
create function public.submit_with_files(p_key uuid,p_category text,p_kind public.request_kind,p_title text,p_description text,p_proposal text,p_sentiment smallint,p_tags text[],p_files jsonb)
returns uuid language sql security invoker set search_path = '' as $$ select kinetria_private.submit_with_files(p_key,p_category,p_kind,p_title,p_description,p_proposal,p_sentiment,p_tags,p_files); $$;
revoke all on function kinetria_private.submit_with_files(uuid,text,public.request_kind,text,text,text,smallint,text[],jsonb),public.submit_with_files(uuid,text,public.request_kind,text,text,text,smallint,text[],jsonb) from public,anon;
grant execute on function kinetria_private.submit_with_files(uuid,text,public.request_kind,text,text,text,smallint,text[],jsonb),public.submit_with_files(uuid,text,public.request_kind,text,text,text,smallint,text[],jsonb) to authenticated;

-- Preserve the supplied prototype content, explicitly marked as synthetic.
update public.requests set title='Полные данные в заявках на оборудование', department='Закупки', priority='normal', due_at='2026-11-14', created_at='2026-11-01T09:00:00+05:00', first_response_at=null, resolved_at=null, decision=coalesce(decision,null), next_step=coalesce(next_step,'Запросить пример корректно заполненной заявки; оценить изменение шаблона.'), acknowledged_at=null where source_ref='A-001' and is_demo and status='new';
update public.requests set title='Статус проекта для отдела закупок', department='Закупки', priority='normal', due_at='2026-11-12', created_at='2026-11-02T09:00:00+05:00', first_response_at='2026-11-02T07:00:00.000Z', resolved_at=null, decision=coalesce(decision,null), next_step=coalesce(next_step,'Определить перечень доступных статусов и источник их обновления.'), acknowledged_at=null where source_ref='A-002' and is_demo and status='review';
update public.requests set title='Единые обозначения в каталоге', department='Проектирование', priority='high', due_at='2026-11-10', created_at='2026-11-03T09:00:00+05:00', first_response_at='2026-11-03T08:00:00.000Z', resolved_at=null, decision=coalesce(decision,null), next_step=coalesce(next_step,'Подготовить правило проверки и корректировки номенклатуры.'), acknowledged_at=null where source_ref='A-003' and is_demo and status='in_progress';
update public.requests set title='Короткие занятия по новым товарным линейкам', department='Закупки', priority='low', due_at='2026-11-09', created_at='2026-11-04T09:00:00+05:00', first_response_at='2026-11-04T09:00:00.000Z', resolved_at='2026-11-08T11:00:00+05:00', decision=coalesce(decision,'запланирован пробный обучающий семинар.'), next_step=coalesce(next_step,'запланирован пробный обучающий семинар.'), acknowledged_at=null where source_ref='A-004' and is_demo and status='implemented';
update public.requests set title='Прозрачный статус пакета документов', department='Бухгалтерия', priority='normal', due_at='2026-11-11', created_at='2026-11-05T09:00:00+05:00', first_response_at='2026-11-05T10:00:00.000Z', resolved_at=null, decision=coalesce(decision,null), next_step=coalesce(next_step,'Уточнить виды документов и ключевые этапы согласования.'), acknowledged_at=null where source_ref='A-005' and is_demo and status='clarification';
update public.requests set title='Памятка для межотдельных операций', department='Бухгалтерия', priority='normal', due_at='2026-11-16', created_at='2026-11-06T09:00:00+05:00', first_response_at='2026-11-06T06:00:00.000Z', resolved_at=null, decision=coalesce(decision,null), next_step=coalesce(next_step,'Назначить владельца процесса и согласовать черновик инструкции.'), acknowledged_at=null where source_ref='A-006' and is_demo and status='review';
update public.requests set title='Повторный ввод данных в рабочих системах', department='Бухгалтерия', priority='high', due_at='2026-11-12', created_at='2026-11-07T09:00:00+05:00', first_response_at=null, resolved_at=null, decision=coalesce(decision,null), next_step=coalesce(next_step,'Собрать примеры операций и оценить техническую реализуемость.'), acknowledged_at=null where source_ref='A-007' and is_demo and status='new';
update public.requests set title='Памятка для передачи сложных задач', department='Бухгалтерия', priority='low', due_at='2026-11-09', created_at='2026-11-01T09:00:00+05:00', first_response_at='2026-11-01T08:00:00.000Z', resolved_at='2026-11-08T11:00:00+05:00', decision=coalesce(decision,'создана учебная инструкция.'), next_step=coalesce(next_step,'создана учебная инструкция.'), acknowledged_at='2026-11-08T11:00:00+05:00' where source_ref='A-008' and is_demo and status='implemented';
update public.requests set title='Кто согласовывает приложение к договору', department='Продажи', priority='high', due_at='2026-11-11', created_at='2026-11-02T09:00:00+05:00', first_response_at='2026-11-02T09:00:00.000Z', resolved_at=null, decision=coalesce(decision,null), next_step=coalesce(next_step,'Разграничить этапы подготовки, проверки и утверждения.'), acknowledged_at=null where source_ref='A-009' and is_demo and status='in_progress';
update public.requests set title='Подтверждение результата перед закрытием задачи', department='Продажи', priority='normal', due_at='2026-11-13', created_at='2026-11-03T09:00:00+05:00', first_response_at='2026-11-03T10:00:00.000Z', resolved_at=null, decision=coalesce(decision,null), next_step=coalesce(next_step,'Проверить, подходит ли правило для разных типов задач.'), acknowledged_at=null where source_ref='A-010' and is_demo and status='review';
update public.requests set title='Срок ответа смежных подразделений', department='Продажи', priority='high', due_at='2026-11-12', created_at='2026-11-04T09:00:00+05:00', first_response_at=null, resolved_at=null, decision=coalesce(decision,null), next_step=coalesce(next_step,'Определить допустимые сроки реакции для разных категорий.'), acknowledged_at=null where source_ref='A-011' and is_demo and status='new';
update public.requests set title='Единое место для итоговых решений', department='Продажи', priority='low', due_at='2026-11-13', created_at='2026-11-05T09:00:00+05:00', first_response_at='2026-11-05T07:00:00.000Z', resolved_at=null, decision=coalesce(decision,null), next_step=coalesce(next_step,'Сравнить варианты и предложить правила фиксации итогов.'), acknowledged_at=null where source_ref='A-012' and is_demo and status='review';
update public.requests set title='История изменений спецификации', department='Проектирование', priority='normal', due_at='2026-11-13', created_at='2026-11-06T09:00:00+05:00', first_response_at='2026-11-06T08:00:00.000Z', resolved_at=null, decision=coalesce(decision,null), next_step=coalesce(next_step,'Уточнить формат исходных файлов и способы сравнения версий.'), acknowledged_at=null where source_ref='A-013' and is_demo and status='clarification';
update public.requests set title='Обзор загрузки проектной группы', department='Проектирование', priority='normal', due_at='2026-11-16', created_at='2026-11-07T09:00:00+05:00', first_response_at='2026-11-07T09:00:00.000Z', resolved_at=null, decision=coalesce(decision,null), next_step=coalesce(next_step,'Согласовать показатели загрузки и права просмотра.'), acknowledged_at=null where source_ref='A-014' and is_demo and status='review';
update public.requests set title='Цель и срок в каждом поручении', department='Проектирование', priority='normal', due_at='2026-11-10', created_at='2026-11-01T09:00:00+05:00', first_response_at='2026-11-01T10:00:00.000Z', resolved_at=null, decision=coalesce(decision,null), next_step=coalesce(next_step,'Подготовить шаблон с целью, сроком, приоритетом и ответственным.'), acknowledged_at=null where source_ref='A-015' and is_demo and status='in_progress';
update public.requests set title='Практические занятия для новых сотрудников', department='Проектирование', priority='low', due_at='2026-11-16', created_at='2026-11-02T09:00:00+05:00', first_response_at=null, resolved_at=null, decision=coalesce(decision,null), next_step=coalesce(next_step,'Проверить наличие образцов и составить план пилота.'), acknowledged_at=null where source_ref='A-016' and is_demo and status='new';
update public.requests set title='Зона для коротких перерывов', department='Офис', priority='low', due_at='2026-11-08', created_at='2026-11-03T09:00:00+05:00', first_response_at='2026-11-03T07:00:00.000Z', resolved_at='2026-11-08T11:00:00+05:00', decision=coalesce(decision,'сейчас нет подходящего помещения; вернуться к вопросу при перепланировке.'), next_step=coalesce(next_step,'Пример мотивированного ответа: сейчас нет подходящего помещения; вернуться к вопросу при перепланировке.'), acknowledged_at=null where source_ref='A-017' and is_demo and status='rejected';
update public.requests set title='Сохранить формат внутренних учебных встреч', department='Офис', priority='low', due_at='2026-11-08', created_at='2026-11-04T09:00:00+05:00', first_response_at='2026-11-04T08:00:00.000Z', resolved_at='2026-11-08T11:00:00+05:00', decision=coalesce(decision,'Спасибо за обратную связь. Польза учебных встреч зафиксирована; отзыв передан организаторам. Формат сохраняем.'), next_step=coalesce(next_step,'Зафиксировать положительный отзыв и передать организаторам обучения.'), acknowledged_at='2026-11-08T11:00:00+05:00' where source_ref='A-018' and is_demo and status='closed';
update public.requests set title='Как найти актуальную редакцию инструкции', department='Проектирование', priority='normal', due_at='2026-11-14', created_at='2026-11-05T09:00:00+05:00', first_response_at='2026-11-05T09:00:00.000Z', resolved_at=null, decision=coalesce(decision,null), next_step=coalesce(next_step,'Согласовать порядок хранения и владельцев папок.'), acknowledged_at=null where source_ref='A-019' and is_demo and status='review';
update public.requests set title='Обзор завершённых внутренних улучшений', department='Закупки', priority='low', due_at='2026-11-13', created_at='2026-11-06T09:00:00+05:00', first_response_at=null, resolved_at=null, decision=coalesce(decision,null), next_step=coalesce(next_step,'Рассмотреть формат квартальной подборки без конфиденциальных сведений.'), acknowledged_at=null where source_ref='A-020' and is_demo and status='new';
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

  if p_kind is null or p_kind not in ('problem', 'idea', 'praise') or p_sentiment is null then
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
create or replace function kinetria_private.submit_request(
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
    where r.category_id = p_category and r.enabled and p.active and p.role in ('manager', 'handler');

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

