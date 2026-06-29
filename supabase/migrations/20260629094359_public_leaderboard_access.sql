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
    left join public.scoring_rules sr on sr.id = a.matched_rule_id
    where p.is_active
      and a.status = 'active'
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
  aggregated as (
    select
      filtered.user_id,
      filtered.display_name,
      filtered.season_id,
      filtered.season_name,
      coalesce(sum(filtered.points), 0)::integer as total_points,
      count(*)::bigint as total_rides,
      count(*) filter (where filtered.category = 'fondo')::bigint as samstags_fahrten,
      count(*) filter (
        where filtered.category in ('zgb_zug', 'scuola', 'scuderia')
      )::bigint as mittwochs_fahrten,
      count(*) filter (where filtered.is_special)::bigint as sonderevents,
      coalesce(sum(filtered.points) filter (where filtered.source = 'manual'), 0)::integer as manual_points,
      max(coalesce(filtered.activity_started_local_at, filtered.activity_started_at)) as last_activity_at
    from filtered
    group by filtered.user_id, filtered.display_name, filtered.season_id, filtered.season_name
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
