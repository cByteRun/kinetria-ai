create type public.kinetria_role as enum ('employee', 'handler', 'manager', 'admin', 'client');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.kinetria_role not null,
  active boolean not null default true
);

alter table public.profiles enable row level security;
revoke all on public.profiles from public, anon, authenticated;
grant select on public.profiles to authenticated;
grant select, insert, update on public.profiles to service_role;

create policy "Read active own profile"
on public.profiles for select to authenticated
using (id = (select auth.uid()) and active);
