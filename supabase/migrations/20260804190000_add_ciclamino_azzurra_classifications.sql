alter table public.profiles
drop constraint if exists profiles_role_check;

alter table public.profiles
add constraint profiles_role_check
check (role in ('admin', 'member', 'scorekeeper'));

alter table public.activities
add column if not exists total_elevation_gain_m numeric;

alter table public.activities
add constraint activities_total_elevation_gain_m_check
check (
  total_elevation_gain_m is null
  or total_elevation_gain_m >= 0
);

create index activities_azzurra_lookup_idx
on public.activities (
  season_id,
  user_id,
  sport_type,
  activity_started_local_at
)
where status = 'active'
  and source = 'strava';

create or replace function public.can_manage_ciclamino()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role in ('admin', 'scorekeeper')
      and is_active
  );
$$;

revoke all on function public.can_manage_ciclamino() from public;
grant execute on function public.can_manage_ciclamino()
to authenticated, service_role;

create table public.ciclamino_sprints (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons(id) on delete cascade,
  sprint_date date not null,
  name text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ciclamino_sprints_name_not_blank
    check (length(btrim(name)) > 0),
  constraint ciclamino_sprints_identity_unique
    unique (season_id, sprint_date, name)
);

create trigger set_ciclamino_sprints_updated_at
before update on public.ciclamino_sprints
for each row execute function public.set_updated_at();

create table public.ciclamino_placements (
  sprint_id uuid not null references public.ciclamino_sprints(id) on delete cascade,
  place smallint not null,
  user_id uuid not null references public.profiles(id) on delete restrict,
  points smallint generated always as (
    case place
      when 1 then 5
      when 2 then 3
      when 3 then 1
    end
  ) stored,
  created_at timestamptz not null default now(),
  primary key (sprint_id, place),
  constraint ciclamino_placements_place_check check (place between 1 and 3),
  constraint ciclamino_placements_user_unique unique (sprint_id, user_id)
);

create index ciclamino_sprints_season_date_idx
on public.ciclamino_sprints (season_id, sprint_date desc);

create index ciclamino_placements_user_idx
on public.ciclamino_placements (user_id);

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

  return new;
end;
$$;

create trigger validate_ciclamino_sprint_date_trigger
before insert or update of season_id, sprint_date
on public.ciclamino_sprints
for each row execute function public.validate_ciclamino_sprint_date();

create or replace function public.save_ciclamino_sprint(
  p_sprint_id uuid,
  p_season_id uuid,
  p_sprint_date date,
  p_name text,
  p_user_ids uuid[],
  p_actor_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_id uuid;
begin
  if coalesce(array_length(p_user_ids, 1), 0) <> 3
    or (select count(distinct value) from unnest(p_user_ids) value) <> 3 then
    raise exception 'Exactly three distinct members are required.'
      using errcode = '23514';
  end if;

  if (
    select count(*)
    from public.profiles
    where id = any(p_user_ids)
      and is_active
  ) <> 3 then
    raise exception 'All sprint placements require active members.'
      using errcode = '23514';
  end if;

  if p_sprint_id is null then
    insert into public.ciclamino_sprints (
      season_id,
      sprint_date,
      name,
      created_by
    ) values (
      p_season_id,
      p_sprint_date,
      btrim(p_name),
      p_actor_user_id
    ) returning id into saved_id;
  else
    update public.ciclamino_sprints
    set
      season_id = p_season_id,
      sprint_date = p_sprint_date,
      name = btrim(p_name)
    where id = p_sprint_id
    returning id into saved_id;

    if saved_id is null then
      raise exception 'Sprint not found.' using errcode = 'P0002';
    end if;

    delete from public.ciclamino_placements
    where sprint_id = saved_id;
  end if;

  insert into public.ciclamino_placements (sprint_id, place, user_id)
  select saved_id, ordinality::smallint, user_id
  from unnest(p_user_ids) with ordinality as placements(user_id, ordinality);

  return saved_id;
end;
$$;

create table public.azzurra_windows (
  user_id uuid not null references public.profiles(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  starts_on date not null,
  selected_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, season_id)
);

create trigger set_azzurra_windows_updated_at
before update on public.azzurra_windows
for each row execute function public.set_updated_at();

create or replace function public.validate_azzurra_window()
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

  if new.starts_on < selected_season.starts_on
    or new.starts_on + 6 > selected_season.ends_on then
    raise exception 'Azzurra window must be fully inside the selected season.'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger validate_azzurra_window_trigger
before insert or update of season_id, starts_on
on public.azzurra_windows
for each row execute function public.validate_azzurra_window();

alter table public.ciclamino_sprints enable row level security;
alter table public.ciclamino_placements enable row level security;
alter table public.azzurra_windows enable row level security;

create policy ciclamino_sprints_select_authenticated
on public.ciclamino_sprints for select
to authenticated
using (true);

create policy ciclamino_sprints_manage
on public.ciclamino_sprints for all
to authenticated
using (public.can_manage_ciclamino())
with check (public.can_manage_ciclamino());

create policy ciclamino_placements_select_authenticated
on public.ciclamino_placements for select
to authenticated
using (true);

create policy ciclamino_placements_manage
on public.ciclamino_placements for all
to authenticated
using (public.can_manage_ciclamino())
with check (public.can_manage_ciclamino());

create policy azzurra_windows_select_own_or_admin
on public.azzurra_windows for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.is_admin()
);

create policy azzurra_windows_insert_own
on public.azzurra_windows for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and selected_by = (select auth.uid())
);

create policy azzurra_windows_admin_all
on public.azzurra_windows for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

revoke all on table public.ciclamino_sprints from anon, authenticated;
revoke all on table public.ciclamino_placements from anon, authenticated;
revoke all on table public.azzurra_windows from anon, authenticated;

grant select, insert, update, delete on table public.ciclamino_sprints
to authenticated;
grant select, insert, update, delete on table public.ciclamino_placements
to authenticated;
grant select, insert, update, delete on table public.azzurra_windows
to authenticated;

grant all on table public.ciclamino_sprints to service_role;
grant all on table public.ciclamino_placements to service_role;
grant all on table public.azzurra_windows to service_role;

revoke all on function public.save_ciclamino_sprint(
  uuid, uuid, date, text, uuid[], uuid
) from public;
grant execute on function public.save_ciclamino_sprint(
  uuid, uuid, date, text, uuid[], uuid
) to service_role;

create or replace function public.get_ciclamino_leaderboard(
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
    aggregated.sprint_count
  from aggregated
  order by season_name, place;
$$;

create or replace function public.get_azzurra_leaderboard(
  p_season_id uuid
)
returns table (
  place integer,
  user_id uuid,
  display_name text,
  season_id uuid,
  season_name text,
  starts_on date,
  ends_on date,
  total_elevation_gain_m numeric,
  total_distance_m numeric,
  ride_count bigint,
  missing_elevation_count bigint
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
      window.starts_on,
      (window.starts_on + 6)::date as ends_on,
      coalesce(sum(activity.total_elevation_gain_m), 0)::numeric
        as total_elevation_gain_m,
      coalesce(sum(activity.distance_m), 0)::numeric as total_distance_m,
      count(activity.id)::bigint as ride_count,
      count(activity.id) filter (
        where activity.total_elevation_gain_m is null
      )::bigint as missing_elevation_count
    from public.azzurra_windows window
    join public.profiles profile on profile.id = window.user_id
    join public.seasons season on season.id = window.season_id
    left join public.activities activity
      on activity.user_id = window.user_id
      and activity.season_id = window.season_id
      and activity.status = 'active'
      and activity.source = 'strava'
      and activity.sport_type in ('Ride', 'GravelRide', 'MountainBikeRide')
      and (
        coalesce(activity.activity_started_local_at, activity.activity_started_at)
          at time zone 'Europe/Berlin'
      )::date between window.starts_on and window.starts_on + 6
    where profile.is_active
      and (p_season_id is null or window.season_id = p_season_id)
    group by
      profile.id,
      profile.display_name,
      season.id,
      season.name,
      window.starts_on
  )
  select
    row_number() over (
      partition by aggregated.season_id
      order by
        aggregated.total_elevation_gain_m desc,
        aggregated.total_distance_m desc,
        aggregated.display_name asc
    )::integer as place,
    aggregated.user_id,
    aggregated.display_name,
    aggregated.season_id,
    aggregated.season_name,
    aggregated.starts_on,
    aggregated.ends_on,
    aggregated.total_elevation_gain_m,
    aggregated.total_distance_m,
    aggregated.ride_count,
    aggregated.missing_elevation_count
  from aggregated
  order by season_name, place;
$$;

revoke all on function public.get_ciclamino_leaderboard(uuid) from public;
revoke all on function public.get_azzurra_leaderboard(uuid) from public;

grant execute on function public.get_ciclamino_leaderboard(uuid)
to anon, authenticated, service_role;
grant execute on function public.get_azzurra_leaderboard(uuid)
to anon, authenticated, service_role;

comment on column public.activities.total_elevation_gain_m is
'Strava total_elevation_gain in metres. Null means not yet synchronized.';

comment on table public.ciclamino_sprints is
'Manual sprint events for the season-specific Maglia Ciclamino classification.';

comment on table public.azzurra_windows is
'One immutable seven-day climbing-classification window per member and season.';
