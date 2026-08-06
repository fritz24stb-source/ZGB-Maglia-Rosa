create table public.ciclamino_result_submissions (
  season_id uuid not null,
  sprint_date date not null,
  location text not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  place smallint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (season_id, sprint_date, location, user_id),
  foreign key (season_id, sprint_date)
    references public.ciclamino_combative_voting_windows(season_id, sprint_date)
    on delete cascade,
  constraint ciclamino_result_submissions_location_check
    check (location in ('Okel', 'Heiligenfelde I', 'Heiligenfelde II')),
  constraint ciclamino_result_submissions_place_check
    check (place is null or place between 1 and 5)
);

create unique index ciclamino_result_submissions_open_place_idx
on public.ciclamino_result_submissions (season_id, sprint_date, location, place)
where place is not null;

create table public.ciclamino_placement_overrides (
  season_id uuid not null,
  sprint_date date not null,
  location text not null,
  place smallint not null,
  user_id uuid not null references public.profiles(id) on delete restrict,
  overridden_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (season_id, sprint_date, location, place),
  foreign key (season_id, sprint_date)
    references public.ciclamino_combative_voting_windows(season_id, sprint_date)
    on delete cascade,
  constraint ciclamino_placement_overrides_location_check
    check (location in ('Okel', 'Heiligenfelde I', 'Heiligenfelde II')),
  constraint ciclamino_placement_overrides_place_check
    check (place between 1 and 5),
  constraint ciclamino_placement_overrides_user_unique
    unique (season_id, sprint_date, location, user_id)
);

create trigger set_ciclamino_result_submissions_updated_at
before update on public.ciclamino_result_submissions
for each row execute function public.set_updated_at();

create trigger set_ciclamino_placement_overrides_updated_at
before update on public.ciclamino_placement_overrides
for each row execute function public.set_updated_at();

create trigger validate_ciclamino_result_submission_date
before insert or update of season_id, sprint_date
on public.ciclamino_result_submissions
for each row execute function public.validate_ciclamino_sprint_date();

create trigger validate_ciclamino_placement_override_date
before insert or update of season_id, sprint_date
on public.ciclamino_placement_overrides
for each row execute function public.validate_ciclamino_sprint_date();

alter table public.ciclamino_result_submissions enable row level security;
alter table public.ciclamino_placement_overrides enable row level security;

create policy ciclamino_result_submissions_select_own_or_manager
on public.ciclamino_result_submissions for select
to authenticated
using (user_id = (select auth.uid()) or public.can_manage_ciclamino());

create policy ciclamino_result_submissions_insert_own
on public.ciclamino_result_submissions for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy ciclamino_result_submissions_update_own
on public.ciclamino_result_submissions for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy ciclamino_placement_overrides_manage
on public.ciclamino_placement_overrides for all
to authenticated
using (public.can_manage_ciclamino())
with check (public.can_manage_ciclamino());

revoke all on table public.ciclamino_result_submissions from anon, authenticated;
revoke all on table public.ciclamino_placement_overrides from anon, authenticated;
grant select, insert, update on table public.ciclamino_result_submissions to authenticated;
grant select, insert, update, delete on table public.ciclamino_placement_overrides to authenticated;
grant all on table public.ciclamino_result_submissions to service_role;
grant all on table public.ciclamino_placement_overrides to service_role;

drop trigger if exists ciclamino_sprint_complete_after_sprint
on public.ciclamino_sprints;
drop trigger if exists ciclamino_sprint_complete_after_placement
on public.ciclamino_placements;
drop function if exists public.assert_ciclamino_sprint_has_five_places();

insert into public.ciclamino_placement_overrides (
  season_id,
  sprint_date,
  location,
  place,
  user_id,
  overridden_by
)
select
  sprint.season_id,
  sprint.sprint_date,
  sprint.name,
  placement.place,
  placement.user_id,
  sprint.created_by
from public.ciclamino_placements placement
join public.ciclamino_sprints sprint on sprint.id = placement.sprint_id
join public.ciclamino_combative_voting_windows voting_window
  on voting_window.season_id = sprint.season_id
  and voting_window.sprint_date = sprint.sprint_date
on conflict (season_id, sprint_date, location, place) do nothing;

create or replace function public.refresh_ciclamino_effective_placements(
  p_season_id uuid,
  p_sprint_date date,
  p_actor_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  location_name text;
  saved_sprint_id uuid;
begin
  for location_name in
    select value from unnest(array[
      'Okel', 'Heiligenfelde I', 'Heiligenfelde II'
    ]) as locations(value)
  loop
    insert into public.ciclamino_sprints (
      season_id, sprint_date, name, created_by
    ) values (
      p_season_id, p_sprint_date, location_name, p_actor_user_id
    )
    on conflict (season_id, sprint_date, name)
    do update set updated_at = now()
    returning id into saved_sprint_id;

    delete from public.ciclamino_placements
    where sprint_id = saved_sprint_id;

    insert into public.ciclamino_placements (sprint_id, place, user_id)
    select saved_sprint_id, effective.place, effective.user_id
    from (
      select override_result.place, override_result.user_id
      from public.ciclamino_placement_overrides override_result
      where override_result.season_id = p_season_id
        and override_result.sprint_date = p_sprint_date
        and override_result.location = location_name

      union all

      select submission.place, submission.user_id
      from public.ciclamino_result_submissions submission
      where submission.season_id = p_season_id
        and submission.sprint_date = p_sprint_date
        and submission.location = location_name
        and submission.place is not null
        and not exists (
          select 1
          from public.ciclamino_placement_overrides place_override
          where place_override.season_id = submission.season_id
            and place_override.sprint_date = submission.sprint_date
            and place_override.location = submission.location
            and place_override.place = submission.place
        )
        and not exists (
          select 1
          from public.ciclamino_placement_overrides rider_override
          where rider_override.season_id = submission.season_id
            and rider_override.sprint_date = submission.sprint_date
            and rider_override.location = submission.location
            and rider_override.user_id = submission.user_id
        )
    ) effective
    order by effective.place;
  end loop;
end;
$$;

revoke all on function public.refresh_ciclamino_effective_placements(
  uuid, date, uuid
) from public;
grant execute on function public.refresh_ciclamino_effective_placements(
  uuid, date, uuid
) to service_role;

create or replace function public.save_ciclamino_member_vote(
  p_season_id uuid,
  p_sprint_date date,
  p_voter_user_id uuid,
  p_candidate_user_id uuid,
  p_results jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  voting_window public.ciclamino_combative_voting_windows;
  result_input jsonb;
  location_name text;
  selected_place smallint;
begin
  select * into voting_window
  from public.ciclamino_combative_voting_windows
  where season_id = p_season_id and sprint_date = p_sprint_date
  for update;

  if not found then
    raise exception 'Voting window not found.' using errcode = 'P0002';
  end if;

  if now() < voting_window.opens_at or now() >= voting_window.closes_at then
    raise exception 'Voting window is closed.' using errcode = '23514';
  end if;

  if not exists (
    select 1 from public.profiles
    where id = p_voter_user_id and is_active
  ) or not exists (
    select 1 from public.profiles
    where id = p_candidate_user_id and is_active
  ) then
    raise exception 'Voter and candidate must be active members.'
      using errcode = '23514';
  end if;

  if jsonb_typeof(p_results) <> 'array'
    or jsonb_array_length(p_results) <> 3
    or (
      select count(distinct item ->> 'location')
      from jsonb_array_elements(p_results) item
    ) <> 3
    or exists (
      select 1
      from jsonb_array_elements(p_results) item
      where item ->> 'location' not in (
        'Okel', 'Heiligenfelde I', 'Heiligenfelde II'
      )
    ) then
    raise exception 'All three locations are required exactly once.'
      using errcode = '23514';
  end if;

  for result_input in select value from jsonb_array_elements(p_results)
  loop
    location_name := result_input ->> 'location';
    selected_place := case
      when result_input -> 'place' is null
        or jsonb_typeof(result_input -> 'place') = 'null' then null
      else (result_input ->> 'place')::smallint
    end;

    if selected_place is not null and selected_place not between 1 and 5 then
      raise exception 'Placements must be between one and five.'
        using errcode = '23514';
    end if;

    insert into public.ciclamino_result_submissions (
      season_id, sprint_date, location, user_id, place
    ) values (
      p_season_id, p_sprint_date, location_name,
      p_voter_user_id, selected_place
    )
    on conflict (season_id, sprint_date, location, user_id)
    do update set place = excluded.place, updated_at = now();
  end loop;

  insert into public.ciclamino_combative_votes (
    season_id, sprint_date, voter_user_id, candidate_user_id
  ) values (
    p_season_id, p_sprint_date, p_voter_user_id, p_candidate_user_id
  )
  on conflict (season_id, sprint_date, voter_user_id)
  do update set candidate_user_id = excluded.candidate_user_id, updated_at = now();

  perform public.refresh_ciclamino_effective_placements(
    p_season_id, p_sprint_date, p_voter_user_id
  );
end;
$$;

revoke all on function public.save_ciclamino_member_vote(
  uuid, date, uuid, uuid, jsonb
) from public;
grant execute on function public.save_ciclamino_member_vote(
  uuid, date, uuid, uuid, jsonb
) to service_role;

drop function public.save_ciclamino_race_day(
  uuid, date, jsonb, uuid, uuid, uuid, date
);

create function public.save_ciclamino_race_day(
  p_season_id uuid,
  p_sprint_date date,
  p_sprints jsonb,
  p_combative_user_id uuid,
  p_actor_user_id uuid,
  p_original_season_id uuid,
  p_original_sprint_date date,
  p_vote_opens_at timestamptz,
  p_vote_closes_at timestamptz
)
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
  sprint_input jsonb;
  sprint_name text;
  override_user_id uuid;
  place_index integer;
  saved_id uuid;
  saved_ids uuid[] := array[]::uuid[];
begin
  if p_vote_opens_at >= p_vote_closes_at then
    raise exception 'Voting start must be before voting end.'
      using errcode = '23514';
  end if;

  if p_combative_user_id is not null and not exists (
    select 1 from public.profiles
    where id = p_combative_user_id and is_active
  ) then
    raise exception 'Admin override must be an active member.'
      using errcode = '23514';
  end if;

  if jsonb_typeof(p_sprints) <> 'array'
    or jsonb_array_length(p_sprints) <> 3
    or (
      select count(distinct item ->> 'name')
      from jsonb_array_elements(p_sprints) item
    ) <> 3
    or exists (
      select 1 from jsonb_array_elements(p_sprints) item
      where item ->> 'name' not in (
        'Okel', 'Heiligenfelde I', 'Heiligenfelde II'
      )
    ) then
    raise exception 'All three locations are required exactly once.'
      using errcode = '23514';
  end if;

  if p_original_season_id is not null
    and p_original_sprint_date is not null
    and (
      p_original_season_id <> p_season_id
      or p_original_sprint_date <> p_sprint_date
    ) then
    delete from public.ciclamino_combative_awards
    where season_id = p_original_season_id
      and sprint_date = p_original_sprint_date;
    delete from public.ciclamino_combative_voting_windows
    where season_id = p_original_season_id
      and sprint_date = p_original_sprint_date;
    delete from public.ciclamino_sprints
    where season_id = p_original_season_id
      and sprint_date = p_original_sprint_date;
  end if;

  insert into public.ciclamino_combative_voting_windows (
    season_id, sprint_date, opens_at, closes_at, updated_by
  ) values (
    p_season_id, p_sprint_date, p_vote_opens_at,
    p_vote_closes_at, p_actor_user_id
  )
  on conflict (season_id, sprint_date)
  do update set
    opens_at = excluded.opens_at,
    closes_at = excluded.closes_at,
    updated_by = excluded.updated_by,
    updated_at = now();

  delete from public.ciclamino_placement_overrides
  where season_id = p_season_id and sprint_date = p_sprint_date;

  for sprint_input in select value from jsonb_array_elements(p_sprints)
  loop
    sprint_name := sprint_input ->> 'name';

    if jsonb_typeof(sprint_input -> 'userIds') <> 'array'
      or jsonb_array_length(sprint_input -> 'userIds') <> 5 then
      raise exception 'Every location requires five override fields.'
        using errcode = '23514';
    end if;

    insert into public.ciclamino_sprints (
      season_id, sprint_date, name, created_by
    ) values (
      p_season_id, p_sprint_date, sprint_name, p_actor_user_id
    )
    on conflict (season_id, sprint_date, name)
    do update set updated_at = now()
    returning id into saved_id;

    for place_index in 0..4
    loop
      override_user_id := nullif(
        sprint_input -> 'userIds' ->> place_index, ''
      )::uuid;

      if override_user_id is not null then
        if not exists (
          select 1 from public.profiles
          where id = override_user_id and is_active
        ) then
          raise exception 'All overrides require active members.'
            using errcode = '23514';
        end if;

        insert into public.ciclamino_placement_overrides (
          season_id, sprint_date, location, place,
          user_id, overridden_by
        ) values (
          p_season_id, p_sprint_date, sprint_name,
          (place_index + 1)::smallint, override_user_id, p_actor_user_id
        );
      end if;
    end loop;

    saved_ids := array_append(saved_ids, saved_id);
  end loop;

  perform public.refresh_ciclamino_effective_placements(
    p_season_id, p_sprint_date, p_actor_user_id
  );

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

revoke all on function public.save_ciclamino_race_day(
  uuid, date, jsonb, uuid, uuid, uuid, date, timestamptz, timestamptz
) from public;
grant execute on function public.save_ciclamino_race_day(
  uuid, date, jsonb, uuid, uuid, uuid, date, timestamptz, timestamptz
) to service_role;

comment on table public.ciclamino_result_submissions is
  'Members self-report their own place for every Ciclamino location.';
comment on table public.ciclamino_placement_overrides is
  'Optional admin overrides for individual Ciclamino places.';
