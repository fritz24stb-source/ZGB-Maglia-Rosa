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
    ((sprint_day + 1)::timestamp + time '18:00') at time zone 'Europe/Berlin'
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

revoke all on function public.ensure_ciclamino_sprint_days_for_season(uuid)
from public;
grant execute on function public.ensure_ciclamino_sprint_days_for_season(uuid)
to service_role;

create or replace function public.create_ciclamino_sprint_days_for_season()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.ensure_ciclamino_sprint_days_for_season(new.id);
  return new;
end;
$$;

create trigger create_ciclamino_sprint_days_after_season_insert
after insert on public.seasons
for each row execute function public.create_ciclamino_sprint_days_for_season();

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

drop function public.get_ciclamino_leaderboard(uuid);

create function public.get_ciclamino_leaderboard(p_season_id uuid)
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
  combative_awards bigint,
  sprint_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with vote_counts as (
    select vote.season_id, vote.sprint_date, vote.candidate_user_id,
      count(*)::bigint as vote_count
    from public.ciclamino_combative_votes vote
    join public.ciclamino_combative_voting_windows voting_window
      on voting_window.season_id = vote.season_id
      and voting_window.sprint_date = vote.sprint_date
    where voting_window.closes_at <= now()
      and (p_season_id is null or vote.season_id = p_season_id)
      and exists (
        select 1 from public.ciclamino_sprints sprint
        where sprint.season_id = vote.season_id
          and sprint.sprint_date = vote.sprint_date
      )
    group by vote.season_id, vote.sprint_date, vote.candidate_user_id
  ),
  candidate_scores as (
    select count_result.*,
      coalesce(sum(placement.points), 0)::integer as sprint_points
    from vote_counts count_result
    left join public.ciclamino_sprints sprint
      on sprint.season_id = count_result.season_id
      and sprint.sprint_date = count_result.sprint_date
    left join public.ciclamino_placements placement
      on placement.sprint_id = sprint.id
      and placement.user_id = count_result.candidate_user_id
    group by count_result.season_id, count_result.sprint_date,
      count_result.candidate_user_id, count_result.vote_count
  ),
  ranked_candidates as (
    select candidate.*,
      rank() over (
        partition by candidate.season_id, candidate.sprint_date
        order by candidate.vote_count desc, candidate.sprint_points desc
      ) as candidate_rank
    from candidate_scores candidate
  ),
  automatic_winners as (
    select candidate.season_id, candidate.sprint_date,
      (array_agg(candidate.candidate_user_id))[1] as user_id,
      5::smallint as points
    from ranked_candidates candidate
    where candidate.candidate_rank = 1
    group by candidate.season_id, candidate.sprint_date
    having count(*) = 1
  ),
  effective_awards as (
    select award.season_id, award.sprint_date, award.user_id, award.points
    from public.ciclamino_combative_awards award
    join public.ciclamino_combative_voting_windows voting_window
      on voting_window.season_id = award.season_id
      and voting_window.sprint_date = award.sprint_date
    where voting_window.closes_at <= now()
      and (p_season_id is null or award.season_id = p_season_id)
    union all
    select winner.season_id, winner.sprint_date, winner.user_id, winner.points
    from automatic_winners winner
    where not exists (
      select 1 from public.ciclamino_combative_awards override_award
      where override_award.season_id = winner.season_id
        and override_award.sprint_date = winner.sprint_date
    )
  ),
  placement_totals as (
    select placement.user_id, sprint.season_id,
      sum(placement.points)::integer as placement_points,
      count(*) filter (where placement.place = 1)::bigint as wins,
      count(*) filter (where placement.place = 2)::bigint as second_places,
      count(*) filter (where placement.place = 3)::bigint as third_places,
      count(*) filter (where placement.place = 4)::bigint as fourth_places,
      count(*) filter (where placement.place = 5)::bigint as fifth_places,
      count(*)::bigint as sprint_count
    from public.ciclamino_placements placement
    join public.ciclamino_sprints sprint on sprint.id = placement.sprint_id
    join public.ciclamino_combative_voting_windows voting_window
      on voting_window.season_id = sprint.season_id
      and voting_window.sprint_date = sprint.sprint_date
    where voting_window.closes_at <= now()
      and (p_season_id is null or sprint.season_id = p_season_id)
    group by placement.user_id, sprint.season_id
  ),
  award_totals as (
    select award.user_id, award.season_id,
      sum(award.points)::integer as award_points,
      count(*)::bigint as combative_awards
    from effective_awards award
    group by award.user_id, award.season_id
  ),
  participants as (
    select user_id, season_id from placement_totals
    union select user_id, season_id from award_totals
  ),
  aggregated as (
    select profile.id as user_id, profile.display_name,
      season.id as season_id, season.name as season_name,
      coalesce(placement.placement_points, 0)
        + coalesce(award.award_points, 0) as total_points,
      coalesce(placement.wins, 0)::bigint as wins,
      coalesce(placement.second_places, 0)::bigint as second_places,
      coalesce(placement.third_places, 0)::bigint as third_places,
      coalesce(placement.fourth_places, 0)::bigint as fourth_places,
      coalesce(placement.fifth_places, 0)::bigint as fifth_places,
      coalesce(award.combative_awards, 0)::bigint as combative_awards,
      coalesce(placement.sprint_count, 0)::bigint as sprint_count
    from participants participant
    join public.profiles profile on profile.id = participant.user_id
    join public.seasons season on season.id = participant.season_id
    left join placement_totals placement
      on placement.user_id = participant.user_id
      and placement.season_id = participant.season_id
    left join award_totals award
      on award.user_id = participant.user_id
      and award.season_id = participant.season_id
    where profile.is_active
  )
  select row_number() over (
      partition by aggregated.season_id
      order by aggregated.total_points desc, aggregated.wins desc,
        aggregated.second_places desc, aggregated.third_places desc,
        aggregated.fourth_places desc, aggregated.fifth_places desc,
        aggregated.combative_awards desc, aggregated.display_name asc
    )::integer as place,
    aggregated.user_id, aggregated.display_name, aggregated.season_id,
    aggregated.season_name, aggregated.total_points, aggregated.wins,
    aggregated.second_places, aggregated.third_places,
    aggregated.fourth_places, aggregated.fifth_places,
    aggregated.combative_awards, aggregated.sprint_count
  from aggregated
  order by season_name, place;
$$;

revoke all on function public.get_ciclamino_leaderboard(uuid) from public;
grant execute on function public.get_ciclamino_leaderboard(uuid)
to anon, authenticated, service_role;

comment on function public.ensure_ciclamino_sprint_days_for_season(uuid) is
  'Creates the three Ciclamino sprints and voting window for every Wednesday in a season.';
