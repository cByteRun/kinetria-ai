-- Human-entered potential metrics are independent of replaceable AI enrichment.
create table public.request_impact_metrics (
 request_id uuid primary key references public.requests(id) on delete cascade,
 hours_per_month numeric check (hours_per_month >= 0 and hours_per_month <= 100000),
 monthly_value numeric check (monthly_value >= 0 and monthly_value <= 1000000000000),
 currency text check (currency ~ '^[A-Z]{3}$'),
 basis text not null default '' check (char_length(basis) <= 4000),
 updated_at timestamptz not null default now(),
 check (monthly_value is null or currency is not null),
 check ((hours_per_month is null and monthly_value is null) or char_length(btrim(basis)) > 0)
);
alter table public.request_impact_metrics enable row level security;
revoke all on public.request_impact_metrics from public, anon, authenticated;
grant select, insert, update on public.request_impact_metrics to authenticated;
grant all on public.request_impact_metrics to service_role;
create policy "Staff read scoped metrics" on public.request_impact_metrics for select to authenticated using (
 exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role in ('admin','manager','handler'))
 and exists(select 1 from public.requests r where r.id=request_id)
);
create policy "Staff insert scoped metrics" on public.request_impact_metrics for insert to authenticated with check (
 exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role in ('admin','manager','handler'))
 and exists(select 1 from public.requests r where r.id=request_id)
);
create policy "Staff update scoped metrics" on public.request_impact_metrics for update to authenticated using (
 exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role in ('admin','manager','handler'))
 and exists(select 1 from public.requests r where r.id=request_id)
) with check (
 exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.active and p.role in ('admin','manager','handler'))
 and exists(select 1 from public.requests r where r.id=request_id)
);
