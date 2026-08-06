create table public.ciclamino_combative_voting_windows (
  season_id uuid not null references public.seasons(id) on delete cascade,
  sprint_date date not null,
  opens_at timestamptz not null,
  closes_at timestamptz not null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (season_id, sprint_date),
  constraint ciclamino_combative_voting_window_order
    check (opens_at < closes_at)
);

create table public.ciclamino_combative_votes (
  season_id uuid not null,
  sprint_date date not null,
  voter_user_id uuid not null references public.profiles(id) on delete cascade,
  candidate_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (season_id, sprint_date, voter_user_id),
  foreign key (season_id, sprint_date)
    references public.ciclamino_combative_voting_windows(season_id, sprint_date)
    on delete cascade
);

create index ciclamino_combative_votes_candidate_idx
on public.ciclamino_combative_votes (season_id, sprint_date, candidate_user_id);

create trigger set_ciclamino_combative_voting_windows_updated_at
before update on public.ciclamino_combative_voting_windows
for each row execute function public.set_updated_at();

create trigger set_ciclamino_combative_votes_updated_at
before update on public.ciclamino_combative_votes
for each row execute function public.set_updated_at();

create trigger validate_ciclamino_combative_voting_window_date
before insert or update of season_id, sprint_date
on public.ciclamino_combative_voting_windows
for each row execute function public.validate_ciclamino_sprint_date();

alter table public.ciclamino_combative_voting_windows enable row level security;
alter table public.ciclamino_combative_votes enable row level security;

create policy ciclamino_combative_voting_windows_select_authenticated
on public.ciclamino_combative_voting_windows for select
to authenticated using (true);

create policy ciclamino_combative_voting_windows_manage
on public.ciclamino_combative_voting_windows for all
to authenticated
using (public.can_manage_ciclamino())
with check (public.can_manage_ciclamino());

create policy ciclamino_combative_votes_select_own_or_manager
on public.ciclamino_combative_votes for select
to authenticated
using (
  voter_user_id = (select auth.uid())
  or public.can_manage_ciclamino()
);

create policy ciclamino_combative_votes_insert_own
on public.ciclamino_combative_votes for insert
to authenticated
with check (voter_user_id = (select auth.uid()));

create policy ciclamino_combative_votes_update_own
on public.ciclamino_combative_votes for update
to authenticated
using (voter_user_id = (select auth.uid()))
with check (voter_user_id = (select auth.uid()));

revoke all on table public.ciclamino_combative_voting_windows from anon, authenticated;
revoke all on table public.ciclamino_combative_votes from anon, authenticated;
grant select, insert, update, delete on table public.ciclamino_combative_voting_windows to authenticated;
grant select, insert, update on table public.ciclamino_combative_votes to authenticated;
grant all on table public.ciclamino_combative_voting_windows to service_role;
grant all on table public.ciclamino_combative_votes to service_role;

insert into public.ciclamino_combative_voting_windows (
  season_id,
  sprint_date,
  opens_at,
  closes_at
)
select distinct
  sprint.season_id,
  sprint.sprint_date,
  (sprint.sprint_date::timestamp + time '18:00') at time zone 'Europe/Berlin',
  ((sprint.sprint_date + 1)::timestamp + time '18:00') at time zone 'Europe/Berlin'
from public.ciclamino_sprints sprint
on conflict (season_id, sprint_date) do nothing;

create or replace function public.save_ciclamino_race_day(
  p_season_id uuid,
  p_sprint_date date,
  p_sprints jsonb,
  p_combative_user_id uuid,
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
  if p_combative_user_id is not null and not exists (
    select 1 from public.profiles
    where id = p_combative_user_id and is_active
  ) then
    raise exception 'Admin override must be an active member.'
      using errcode = '23514';
  end if;

  if jsonb_typeof(p_sprints) <> 'array'
    or jsonb_array_length(p_sprints) <> 3 then
    raise exception 'Exactly three locations are required.' using errcode = '23514';
  end if;

  if (
    select count(distinct item ->> 'name')
    from jsonb_array_elements(p_sprints) item
  ) <> 3 or exists (
    select 1 from jsonb_array_elements(p_sprints) item
    where item ->> 'name' not in ('Okel', 'Heiligenfelde I', 'Heiligenfelde II')
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
    delete from public.ciclamino_combative_awards
    where season_id = p_original_season_id and sprint_date = p_original_sprint_date;
    delete from public.ciclamino_combative_voting_windows
    where season_id = p_original_season_id and sprint_date = p_original_sprint_date;
    delete from public.ciclamino_sprints
    where season_id = p_original_season_id and sprint_date = p_original_sprint_date;
  end if;

  for sprint_input in select value from jsonb_array_elements(p_sprints)
  loop
    sprint_name := sprint_input ->> 'name';
    if jsonb_typeof(sprint_input -> 'userIds') <> 'array'
      or jsonb_array_length(sprint_input -> 'userIds') <> 5 then
      raise exception 'Every location requires exactly five members.' using errcode = '23514';
    end if;

    select array_agg(value::uuid order by ordinality)
    into member_ids
    from jsonb_array_elements_text(sprint_input -> 'userIds')
      with ordinality as members(value, ordinality);

    if (select count(distinct value) from unnest(member_ids) value) <> 5 then
      raise exception 'Every member may occur only once per location.' using errcode = '23514';
    end if;

    if (
      select count(*) from public.profiles
      where id = any(member_ids) and is_active
    ) <> 5 then
      raise exception 'All placements require active members.' using errcode = '23514';
    end if;

    insert into public.ciclamino_sprints (season_id, sprint_date, name, created_by)
    values (p_season_id, p_sprint_date, sprint_name, p_actor_user_id)
    on conflict (season_id, sprint_date, name)
    do update set updated_at = now()
    returning id into saved_id;

    delete from public.ciclamino_placements where sprint_id = saved_id;
    insert into public.ciclamino_placements (sprint_id, place, user_id)
    select saved_id, ordinality::smallint, user_id
    from unnest(member_ids) with ordinality as placements(user_id, ordinality);
    saved_ids := array_append(saved_ids, saved_id);
  end loop;

  if p_combative_user_id is null then
    delete from public.ciclamino_combative_awards
    where season_id = p_season_id and sprint_date = p_sprint_date;
  else
    insert into public.ciclamino_combative_awards (
      season_id, sprint_date, user_id, awarded_by
    ) values (
      p_season_id, p_sprint_date, p_combative_user_id, p_actor_user_id
    )
    on conflict (season_id, sprint_date)
    do update set
      user_id = excluded.user_id,
      awarded_by = excluded.awarded_by,
      updated_at = now();
  end if;

  return saved_ids;
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
      (array_agg(candidate.candidate_user_id))[1] as user_id, 5::smallint as points
    from ranked_candidates candidate
    where candidate.candidate_rank = 1
    group by candidate.season_id, candidate.sprint_date
    having count(*) = 1
  ),
  effective_awards as (
    select award.season_id, award.sprint_date, award.user_id, award.points
    from public.ciclamino_combative_awards award
    where p_season_id is null or award.season_id = p_season_id
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
    where p_season_id is null or sprint.season_id = p_season_id
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
      coalesce(placement.placement_points, 0) + coalesce(award.award_points, 0) as total_points,
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
      on placement.user_id = participant.user_id and placement.season_id = participant.season_id
    left join award_totals award
      on award.user_id = participant.user_id and award.season_id = participant.season_id
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

comment on table public.ciclamino_combative_voting_windows is
  'Configurable voting windows for the Most Combative Rider.';
comment on table public.ciclamino_combative_votes is
  'One changeable Most Combative Rider vote per member and race day.';
