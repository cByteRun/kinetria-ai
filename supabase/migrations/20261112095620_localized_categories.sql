-- Keep the old RPC for older app versions; the new editor saves all locales atomically.
create or replace function kinetria_private.save_localized_category(
  p_id text, p_name_ru text, p_name_en text, p_name_kk text,
  p_active boolean, p_department text, p_days integer
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if not exists(select 1 from public.profiles where id = auth.uid() and active and role = 'admin') then
    raise exception 'Forbidden' using errcode = '42501';
  end if;
  if p_id is null or p_id !~ '^[a-z0-9-]{1,64}$'
    or p_name_ru is null or char_length(btrim(p_name_ru)) not between 3 and 100
    or p_name_en is null or char_length(btrim(p_name_en)) not between 3 and 100
    or p_name_kk is null or char_length(btrim(p_name_kk)) not between 3 and 100
    or p_department is null or char_length(btrim(p_department)) not between 1 and 100
    or p_days is null or p_days not between 1 and 90 or p_active is null then
    raise exception 'Invalid category' using errcode = '22023';
  end if;
  insert into public.request_categories(id, name_ru, name_en, name_kk, active, department, sla_days)
  values(p_id, btrim(p_name_ru), btrim(p_name_en), btrim(p_name_kk), p_active, btrim(p_department), p_days)
  on conflict(id) do update set name_ru = excluded.name_ru, name_en = excluded.name_en,
    name_kk = excluded.name_kk, active = excluded.active, department = excluded.department, sla_days = excluded.sla_days;
end;
$$;
create or replace function public.save_localized_category(
  p_id text, p_name_ru text, p_name_en text, p_name_kk text,
  p_active boolean, p_department text, p_days integer
) returns void language sql security invoker set search_path = '' as $$
  select kinetria_private.save_localized_category(p_id, p_name_ru, p_name_en, p_name_kk, p_active, p_department, p_days);
$$;
revoke all on function kinetria_private.save_localized_category(text,text,text,text,boolean,text,integer),
  public.save_localized_category(text,text,text,text,boolean,text,integer) from public, anon;
grant execute on function kinetria_private.save_localized_category(text,text,text,text,boolean,text,integer),
  public.save_localized_category(text,text,text,text,boolean,text,integer) to authenticated;
notify pgrst, 'reload schema';
