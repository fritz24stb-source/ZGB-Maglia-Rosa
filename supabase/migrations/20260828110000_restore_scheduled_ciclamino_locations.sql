create or replace function public.ensure_ciclamino_sprint_days_for_season(
  p_season_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_season public.seasons;
begin
  select * into selected_season
  from public.seasons
  where id = p_season_id;

  if not found then
    raise exception 'Season not found.' using errcode = 'P0002';
  end if;

  insert into public.ciclamino_combative_voting_windows (
    season_id,
    sprint_date,
    opens_at,
    closes_at
  )
  select
    selected_season.id,
    sprint_day,
    (sprint_day::timestamp + time '18:00') at time zone 'Europe/Berlin',
    ((sprint_day + 2)::timestamp + time '18:00') at time zone 'Europe/Berlin'
  from (
    select generated_day::date as sprint_day
    from generate_series(
      selected_season.starts_on,
      selected_season.ends_on,
      interval '1 day'
    ) generated_day
    where extract(isodow from generated_day) = 3
  ) season_wednesdays
  on conflict (season_id, sprint_date) do nothing;

  insert into public.ciclamino_sprints (
    season_id,
    sprint_date,
    name
  )
  select
    selected_season.id,
    season_wednesday.sprint_date,
    location.name
  from public.ciclamino_combative_voting_windows season_wednesday
  cross join unnest(array[
    'Okel',
    'Heiligenfelde I',
    'Heiligenfelde II'
  ]::text[]) as location(name)
  where season_wednesday.season_id = selected_season.id
    and season_wednesday.sprint_date between
      selected_season.starts_on and selected_season.ends_on
  on conflict (season_id, sprint_date, name) do nothing;
end;
$$;

do $$
declare
  selected_season record;
begin
  for selected_season in select id from public.seasons
  loop
    perform public.ensure_ciclamino_sprint_days_for_season(selected_season.id);
  end loop;
end;
$$;
