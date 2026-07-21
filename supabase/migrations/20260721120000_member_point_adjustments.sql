create table public.member_point_adjustments (
  user_id uuid not null references public.profiles(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete cascade,
  points integer not null default 0,
  last_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, season_id),
  constraint member_point_adjustments_reason_length_check check (
    last_reason is null or length(last_reason) <= 500
  )
);

create trigger set_member_point_adjustments_updated_at
before update on public.member_point_adjustments
for each row execute function public.set_updated_at();

alter table public.member_point_adjustments enable row level security;

create policy member_point_adjustments_select_own_or_admin
on public.member_point_adjustments for select
using (auth.uid() = user_id or public.is_admin());

create policy member_point_adjustments_admin_all
on public.member_point_adjustments for all
using (public.is_admin())
with check (public.is_admin());

revoke all on table public.member_point_adjustments from anon, authenticated;
grant select, insert, update, delete on table public.member_point_adjustments to authenticated;
grant all on table public.member_point_adjustments to service_role;

create or replace function public.get_leaderboard(
  p_season_id uuid default null,
  p_category text default null,
  p_source text default null,
  p_from date default null,
  p_to date default null,
  p_member_id uuid default null,
  p_sport_type text default null
)
returns table (
  place integer,
  user_id uuid,
  display_name text,
  season_id uuid,
  season_name text,
  total_points integer,
  total_rides bigint,
  samstags_fahrten bigint,
  mittwochs_fahrten bigint,
  sonderevents bigint,
  manual_points integer,
  last_activity_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with filtered as (
    select
      a.user_id,
      p.display_name,
      a.season_id,
      s.name as season_name,
      a.points,
      a.category,
      a.source,
      a.activity_started_local_at,
      a.activity_started_at,
      coalesce(sr.rule_type = 'special', false) as is_special
    from public.activities a
    join public.profiles p on p.id = a.user_id
    join public.seasons s on s.id = a.season_id
    join public.scoring_rules sr on sr.id = a.matched_rule_id
    where p.is_active
      and a.status = 'active'
      and a.points > 0
      and (p_season_id is null or a.season_id = p_season_id)
      and (p_category is null or p_category = 'all' or a.category = p_category)
      and (p_source is null or p_source = 'all' or a.source = p_source)
      and (p_member_id is null or a.user_id = p_member_id)
      and (p_sport_type is null or p_sport_type = 'all' or a.sport_type = p_sport_type)
      and (
        p_from is null
        or (coalesce(a.activity_started_local_at, a.activity_started_at) at time zone 'Europe/Berlin')::date >= p_from
      )
      and (
        p_to is null
        or (coalesce(a.activity_started_local_at, a.activity_started_at) at time zone 'Europe/Berlin')::date <= p_to
      )
  ),
  activity_aggregated as (
    select
      filtered.user_id,
      filtered.display_name,
      filtered.season_id,
      filtered.season_name,
      coalesce(sum(filtered.points), 0)::integer as activity_points,
      count(*)::bigint as total_rides,
      count(*) filter (where filtered.category = 'fondo')::bigint as samstags_fahrten,
      count(*) filter (
        where filtered.category in ('zug', 'scuola', 'scuderia')
      )::bigint as mittwochs_fahrten,
      count(*) filter (where filtered.is_special)::bigint as sonderevents,
      coalesce(sum(filtered.points) filter (where filtered.source = 'manual'), 0)::integer as manual_points,
      max(coalesce(filtered.activity_started_local_at, filtered.activity_started_at)) as last_activity_at
    from filtered
    group by filtered.user_id, filtered.display_name, filtered.season_id, filtered.season_name
  ),
  eligible_adjustments as (
    select
      adjustment.user_id,
      profile.display_name,
      adjustment.season_id,
      season.name as season_name,
      adjustment.points
    from public.member_point_adjustments adjustment
    join public.profiles profile on profile.id = adjustment.user_id
    join public.seasons season on season.id = adjustment.season_id
    where profile.is_active
      and adjustment.points <> 0
      and (p_season_id is null or adjustment.season_id = p_season_id)
      and (p_member_id is null or adjustment.user_id = p_member_id)
      and (p_category is null or p_category = 'all')
      and (p_source is null or p_source = 'all')
      and p_from is null
      and p_to is null
      and (p_sport_type is null or p_sport_type = 'all')
  ),
  aggregated as (
    select
      coalesce(activity.user_id, adjustment.user_id) as user_id,
      coalesce(activity.display_name, adjustment.display_name) as display_name,
      coalesce(activity.season_id, adjustment.season_id) as season_id,
      coalesce(activity.season_name, adjustment.season_name) as season_name,
      (coalesce(activity.activity_points, 0) + coalesce(adjustment.points, 0))::integer as total_points,
      coalesce(activity.total_rides, 0)::bigint as total_rides,
      coalesce(activity.samstags_fahrten, 0)::bigint as samstags_fahrten,
      coalesce(activity.mittwochs_fahrten, 0)::bigint as mittwochs_fahrten,
      coalesce(activity.sonderevents, 0)::bigint as sonderevents,
      coalesce(activity.manual_points, 0)::integer as manual_points,
      activity.last_activity_at
    from activity_aggregated activity
    full join eligible_adjustments adjustment
      on adjustment.user_id = activity.user_id
      and adjustment.season_id = activity.season_id
  )
  select
    row_number() over (
      partition by aggregated.season_id
      order by
        aggregated.total_points desc,
        aggregated.total_rides desc,
        aggregated.samstags_fahrten desc,
        aggregated.display_name asc
    )::integer as place,
    aggregated.user_id,
    aggregated.display_name,
    aggregated.season_id,
    aggregated.season_name,
    aggregated.total_points,
    aggregated.total_rides,
    aggregated.samstags_fahrten,
    aggregated.mittwochs_fahrten,
    aggregated.sonderevents,
    aggregated.manual_points,
    aggregated.last_activity_at
  from aggregated
  order by place asc;
$$;

revoke all on function public.get_leaderboard(uuid, text, text, date, date, uuid, text) from public;
grant execute on function public.get_leaderboard(uuid, text, text, date, date, uuid, text)
to anon, authenticated, service_role;
