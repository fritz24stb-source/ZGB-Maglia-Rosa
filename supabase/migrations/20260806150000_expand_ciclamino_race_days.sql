drop function if exists public.save_ciclamino_sprint(
  uuid, uuid, date, text, uuid[], uuid
);

alter table public.ciclamino_placements
drop constraint if exists ciclamino_placements_place_check;

alter table public.ciclamino_placements
drop column points;

alter table public.ciclamino_placements
add column points smallint generated always as (
  case place
    when 1 then 5
    when 2 then 4
    when 3 then 3
    when 4 then 2
    when 5 then 1
  end
) stored;

alter table public.ciclamino_placements
add constraint ciclamino_placements_place_check
check (place between 1 and 5);

alter table public.ciclamino_sprints
drop constraint if exists ciclamino_sprints_name_not_blank;

alter table public.ciclamino_sprints
add constraint ciclamino_sprints_location_check
check (name in ('Okel', 'Heiligenfelde I', 'Heiligenfelde II'));

create or replace function public.validate_ciclamino_sprint_date()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  selected_season public.seasons;
begin
  select * into selected_season
  from public.seasons
  where id = new.season_id;

  if not found then
    raise exception 'Unknown season.' using errcode = '23503';
  end if;

  if new.sprint_date < selected_season.starts_on
    or new.sprint_date > selected_season.ends_on then
    raise exception 'Sprint date must be inside the selected season.'
      using errcode = '23514';
  end if;

  if extract(isodow from new.sprint_date) <> 3 then
    raise exception 'Ciclamino race days must be Wednesdays.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.assert_ciclamino_sprint_has_five_places()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  selected_sprint_id uuid;
begin
  if tg_table_name = 'ciclamino_sprints' then
    selected_sprint_id := new.id;
  else
    selected_sprint_id := coalesce(new.sprint_id, old.sprint_id);
  end if;

  if exists (
    select 1 from public.ciclamino_sprints where id = selected_sprint_id
  ) and (
    select count(*) from public.ciclamino_placements
    where sprint_id = selected_sprint_id
  ) <> 5 then
    raise exception 'Every Ciclamino sprint requires exactly five placements.'
      using errcode = '23514';
  end if;

  return null;
end;
$$;

create constraint trigger ciclamino_sprint_complete_after_sprint
after insert or update on public.ciclamino_sprints
deferrable initially deferred
for each row execute function public.assert_ciclamino_sprint_has_five_places();

create constraint trigger ciclamino_sprint_complete_after_placement
after insert or update or delete on public.ciclamino_placements
deferrable initially deferred
for each row execute function public.assert_ciclamino_sprint_has_five_places();

create or replace function public.save_ciclamino_race_day(
  p_season_id uuid,
  p_sprint_date date,
  p_sprints jsonb,
  p_actor_user_id uuid,
  p_original_season_id uuid,
  p_original_sprint_date date
)
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
  sprint_input jsonb;
  sprint_name text;
  member_ids uuid[];
  saved_id uuid;
  saved_ids uuid[] := array[]::uuid[];
begin
  if jsonb_typeof(p_sprints) <> 'array'
    or jsonb_array_length(p_sprints) <> 3 then
    raise exception 'Exactly three locations are required.'
      using errcode = '23514';
  end if;

  if (
    select count(distinct item ->> 'name')
    from jsonb_array_elements(p_sprints) item
  ) <> 3 or exists (
    select 1
    from jsonb_array_elements(p_sprints) item
    where item ->> 'name' not in (
      'Okel', 'Heiligenfelde I', 'Heiligenfelde II'
    )
  ) then
    raise exception 'All three Ciclamino locations are required exactly once.'
      using errcode = '23514';
  end if;

  if p_original_season_id is not null
    and p_original_sprint_date is not null
    and (
      p_original_season_id <> p_season_id
      or p_original_sprint_date <> p_sprint_date
    ) then
    delete from public.ciclamino_sprints
    where season_id = p_original_season_id
      and sprint_date = p_original_sprint_date;
  end if;

  for sprint_input in
    select value from jsonb_array_elements(p_sprints)
  loop
    sprint_name := sprint_input ->> 'name';

    if jsonb_typeof(sprint_input -> 'userIds') <> 'array'
      or jsonb_array_length(sprint_input -> 'userIds') <> 5 then
      raise exception 'Every location requires exactly five members.'
        using errcode = '23514';
    end if;

    select array_agg(value::uuid order by ordinality)
    into member_ids
    from jsonb_array_elements_text(sprint_input -> 'userIds')
      with ordinality as members(value, ordinality);

    if (select count(distinct value) from unnest(member_ids) value) <> 5 then
      raise exception 'Every member may occur only once per location.'
        using errcode = '23514';
    end if;

    if (
      select count(*)
      from public.profiles
      where id = any(member_ids)
        and is_active
    ) <> 5 then
      raise exception 'All placements require active members.'
        using errcode = '23514';
    end if;

    insert into public.ciclamino_sprints (
      season_id,
      sprint_date,
      name,
      created_by
    ) values (
      p_season_id,
      p_sprint_date,
      sprint_name,
      p_actor_user_id
    )
    on conflict (season_id, sprint_date, name)
    do update set updated_at = now()
    returning id into saved_id;

    delete from public.ciclamino_placements
    where sprint_id = saved_id;

    insert into public.ciclamino_placements (sprint_id, place, user_id)
    select saved_id, ordinality::smallint, user_id
    from unnest(member_ids) with ordinality as placements(user_id, ordinality);

    saved_ids := array_append(saved_ids, saved_id);
  end loop;

  return saved_ids;
end;
$$;

revoke all on function public.save_ciclamino_race_day(
  uuid, date, jsonb, uuid, uuid, date
) from public;
grant execute on function public.save_ciclamino_race_day(
  uuid, date, jsonb, uuid, uuid, date
) to service_role;

drop function public.get_ciclamino_leaderboard(uuid);

create function public.get_ciclamino_leaderboard(
  p_season_id uuid
)
returns table (
  place integer,
  user_id uuid,
  display_name text,
  season_id uuid,
  season_name text,
  total_points integer,
  wins bigint,
  second_places bigint,
  third_places bigint,
  fourth_places bigint,
  fifth_places bigint,
  sprint_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with aggregated as (
    select
      profile.id as user_id,
      profile.display_name,
      season.id as season_id,
      season.name as season_name,
      sum(placement.points)::integer as total_points,
      count(*) filter (where placement.place = 1)::bigint as wins,
      count(*) filter (where placement.place = 2)::bigint as second_places,
      count(*) filter (where placement.place = 3)::bigint as third_places,
      count(*) filter (where placement.place = 4)::bigint as fourth_places,
      count(*) filter (where placement.place = 5)::bigint as fifth_places,
      count(*)::bigint as sprint_count
    from public.ciclamino_placements placement
    join public.ciclamino_sprints sprint on sprint.id = placement.sprint_id
    join public.profiles profile on profile.id = placement.user_id
    join public.seasons season on season.id = sprint.season_id
    where profile.is_active
      and (p_season_id is null or sprint.season_id = p_season_id)
    group by profile.id, profile.display_name, season.id, season.name
  )
  select
    row_number() over (
      partition by aggregated.season_id
      order by
        aggregated.total_points desc,
        aggregated.wins desc,
        aggregated.second_places desc,
        aggregated.third_places desc,
        aggregated.fourth_places desc,
        aggregated.fifth_places desc,
        aggregated.display_name asc
    )::integer as place,
    aggregated.user_id,
    aggregated.display_name,
    aggregated.season_id,
    aggregated.season_name,
    aggregated.total_points,
    aggregated.wins,
    aggregated.second_places,
    aggregated.third_places,
    aggregated.fourth_places,
    aggregated.fifth_places,
    aggregated.sprint_count
  from aggregated
  order by season_name, place;
$$;

revoke all on function public.get_ciclamino_leaderboard(uuid) from public;
grant execute on function public.get_ciclamino_leaderboard(uuid)
to anon, authenticated, service_role;

comment on function public.save_ciclamino_race_day(
  uuid, date, jsonb, uuid, uuid, date
) is 'Atomically saves all three Ciclamino location sprints for one Wednesday.';
