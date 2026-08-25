-- The standard voting window is Wednesday 18:00 through Friday 18:00 (Berlin).
-- Only values matching the former default are migrated; individually configured windows stay untouched.
update public.ciclamino_combative_voting_windows
set closes_at = ((sprint_date + 2)::timestamp + time '18:00') at time zone 'Europe/Berlin'
where closes_at = ((sprint_date + 1)::timestamp + time '18:00') at time zone 'Europe/Berlin';

create or replace function public.ensure_ciclamino_sprint_days_for_season(p_season_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare selected_season public.seasons;
begin
  select * into selected_season from public.seasons where id = p_season_id;
  if not found then raise exception 'Season not found.' using errcode = 'P0002'; end if;
  insert into public.ciclamino_combative_voting_windows (season_id, sprint_date, opens_at, closes_at)
  select selected_season.id, sprint_day,
    (sprint_day::timestamp + time '18:00') at time zone 'Europe/Berlin',
    ((sprint_day + 2)::timestamp + time '18:00') at time zone 'Europe/Berlin'
  from (select generated_day::date as sprint_day from generate_series(selected_season.starts_on, selected_season.ends_on, interval '1 day') generated_day where extract(isodow from generated_day) = 3) wednesdays
  on conflict (season_id, sprint_date) do nothing;
end;
$$;

-- Sprint placements count immediately. Combative points remain restricted to closed votes.
create or replace function public.get_ciclamino_leaderboard(p_season_id uuid)
returns table (place integer, user_id uuid, display_name text, season_id uuid, season_name text, total_points integer, wins bigint, second_places bigint, third_places bigint, fourth_places bigint, fifth_places bigint, combative_awards bigint, sprint_count bigint)
language sql stable security definer set search_path = public as $$
  with vote_counts as (
    select v.season_id, v.sprint_date, v.candidate_user_id, count(*)::bigint vote_count
    from public.ciclamino_combative_votes v join public.ciclamino_combative_voting_windows w on w.season_id=v.season_id and w.sprint_date=v.sprint_date
    where w.closes_at <= now() and (p_season_id is null or v.season_id=p_season_id)
    group by v.season_id, v.sprint_date, v.candidate_user_id
  ), candidates as (
    select vc.*, coalesce(sum(p.points),0)::integer sprint_points from vote_counts vc
    left join public.ciclamino_sprints s on s.season_id=vc.season_id and s.sprint_date=vc.sprint_date
    left join public.ciclamino_placements p on p.sprint_id=s.id and p.user_id=vc.candidate_user_id
    group by vc.season_id, vc.sprint_date, vc.candidate_user_id, vc.vote_count
  ), ranked as (
    select c.*, rank() over(partition by season_id,sprint_date order by vote_count desc,sprint_points desc) candidate_rank from candidates c
  ), effective_awards as (
    select a.season_id,a.sprint_date,a.user_id,a.points from public.ciclamino_combative_awards a join public.ciclamino_combative_voting_windows w on w.season_id=a.season_id and w.sprint_date=a.sprint_date where w.closes_at<=now() and (p_season_id is null or a.season_id=p_season_id)
    union all
    select r.season_id,r.sprint_date,(array_agg(r.candidate_user_id))[1],5::smallint from ranked r where r.candidate_rank=1 and not exists (select 1 from public.ciclamino_combative_awards a where a.season_id=r.season_id and a.sprint_date=r.sprint_date) group by r.season_id,r.sprint_date having count(*)=1
  ), placements as (
    select p.user_id,s.season_id,sum(p.points)::integer placement_points,count(*) filter(where p.place=1)::bigint wins,count(*) filter(where p.place=2)::bigint second_places,count(*) filter(where p.place=3)::bigint third_places,count(*) filter(where p.place=4)::bigint fourth_places,count(*) filter(where p.place=5)::bigint fifth_places,count(*)::bigint sprint_count
    from public.ciclamino_placements p join public.ciclamino_sprints s on s.id=p.sprint_id where p_season_id is null or s.season_id=p_season_id group by p.user_id,s.season_id
  ), awards as (
    select user_id,season_id,sum(points)::integer award_points,count(*)::bigint combative_awards from effective_awards group by user_id,season_id
  ), people as (select user_id,season_id from placements union select user_id,season_id from awards), totals as (
    select pr.id user_id,pr.display_name,se.id season_id,se.name season_name,coalesce(pl.placement_points,0)+coalesce(a.award_points,0) total_points,coalesce(pl.wins,0)::bigint wins,coalesce(pl.second_places,0)::bigint second_places,coalesce(pl.third_places,0)::bigint third_places,coalesce(pl.fourth_places,0)::bigint fourth_places,coalesce(pl.fifth_places,0)::bigint fifth_places,coalesce(a.combative_awards,0)::bigint combative_awards,coalesce(pl.sprint_count,0)::bigint sprint_count
    from people pe join public.profiles pr on pr.id=pe.user_id join public.seasons se on se.id=pe.season_id left join placements pl on pl.user_id=pe.user_id and pl.season_id=pe.season_id left join awards a on a.user_id=pe.user_id and a.season_id=pe.season_id where pr.is_active
  ) select row_number() over(partition by season_id order by total_points desc,wins desc,second_places desc,third_places desc,fourth_places desc,fifth_places desc,combative_awards desc,display_name)::integer, user_id,display_name,season_id,season_name,total_points,wins,second_places,third_places,fourth_places,fifth_places,combative_awards,sprint_count from totals order by season_name,place;
$$;
