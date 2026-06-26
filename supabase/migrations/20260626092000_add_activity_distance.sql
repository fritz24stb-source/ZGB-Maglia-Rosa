alter table public.activities
add column distance_m numeric;

alter table public.activities
add constraint activities_distance_m_check
check (distance_m is null or distance_m >= 0);

create index activities_distance_m_idx
on public.activities (distance_m)
where status = 'active'
  and distance_m is not null;
