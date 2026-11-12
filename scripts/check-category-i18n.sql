\set ON_ERROR_STOP on
begin;
select id as admin_id from public.profiles where role='admin' and active limit 1 \gset
select id as employee_id from public.profiles where role='employee' and active limit 1 \gset
set local role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', :'admin_id', 'role', 'authenticated')::text, true) as ignored \gset
select public.save_localized_category('training', 'Обучение тест', 'Training test', 'Оқыту сынағы', true, 'Test department', 3);
do $$ begin
  if not exists(select 1 from public.request_categories where id='training'
    and name_ru='Обучение тест' and name_en='Training test' and name_kk='Оқыту сынағы') then
    raise exception 'Locale fields were not saved independently';
  end if;
  begin
    perform public.save_localized_category('training', 'Обучение', null, 'Оқыту', true, 'Test department', 3);
    raise exception 'Null translation accepted';
  exception when sqlstate '22023' then null;
  end;
end $$;
select set_config('request.jwt.claims', json_build_object('sub', :'employee_id', 'role', 'authenticated')::text, true) as ignored \gset
do $$ begin
  begin
    perform public.save_localized_category('training', 'Обучение', 'Training', 'Оқыту', true, 'Test department', 3);
    raise exception 'Employee was allowed to edit category';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;
do $$ begin
  if has_function_privilege('anon', 'public.save_localized_category(text,text,text,text,boolean,text,integer)', 'EXECUTE') then
    raise exception 'Anonymous caller can execute category mutation';
  end if;
  if (select prosecdef from pg_proc where oid='public.save_localized_category(text,text,text,text,boolean,text,integer)'::regprocedure) then
    raise exception 'Public wrapper must be SECURITY INVOKER';
  end if;
end $$;
rollback;
\echo PASS category locale fields, validation, admin access, employee/anon denial; all writes rolled back
