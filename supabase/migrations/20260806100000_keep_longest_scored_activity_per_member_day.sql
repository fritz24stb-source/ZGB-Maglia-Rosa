-- A member can receive points for only one activity per local calendar day.
-- The longest scored activity wins; ties use the most recently uploaded activity.
create or replace function public.enforce_longest_scored_activity_per_member_day()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  winning_activity_id uuid;
  activity_day date;
begin
  activity_day := (
    coalesce(new.activity_started_local_at, new.activity_started_at)
    at time zone 'Europe/Berlin'
  )::date;

  select a.id
  into winning_activity_id
  from public.activities a
  where a.user_id = new.user_id
    and a.status = 'active'
    and a.points > 0
    and a.matched_rule_id is not null
    and (
      coalesce(a.activity_started_local_at, a.activity_started_at)
      at time zone 'Europe/Berlin'
    )::date = activity_day
  order by
    a.distance_m desc nulls last,
    coalesce(a.uploaded_or_created_at, a.created_at) desc,
    a.created_at desc,
    a.id desc
  limit 1;

  if winning_activity_id is null then
    return new;
  end if;

  update public.activities
  set
    points = 0,
    awarded_points = 0,
    scoring_reason = 'Keine Punkte: Eine laengere Aktivitaet desselben Mitglieds wurde an diesem Tag gewertet.',
    scored_at = now()
  where user_id = new.user_id
    and id <> winning_activity_id
    and status = 'active'
    and points > 0
    and matched_rule_id is not null
    and (
      coalesce(activity_started_local_at, activity_started_at)
      at time zone 'Europe/Berlin'
    )::date = activity_day;

  return new;
end;
$$;

drop trigger if exists activities_enforce_longest_scored_activity_per_member_day
on public.activities;

create trigger activities_enforce_longest_scored_activity_per_member_day
after insert or update of
  activity_started_at,
  activity_started_local_at,
  distance_m,
  matched_rule_id,
  points,
  status,
  user_id
on public.activities
for each row
when (new.status = 'active')
execute function public.enforce_longest_scored_activity_per_member_day();

-- Apply the rule to activities already stored before this migration.
with ranked_activities as (
  select
    a.id,
    row_number() over (
      partition by
        a.user_id,
        (coalesce(a.activity_started_local_at, a.activity_started_at)
          at time zone 'Europe/Berlin')::date
      order by
        a.distance_m desc nulls last,
        coalesce(a.uploaded_or_created_at, a.created_at) desc,
        a.created_at desc,
        a.id desc
    ) as daily_score_order
  from public.activities a
  where a.status = 'active'
    and a.points > 0
    and a.matched_rule_id is not null
)
update public.activities a
set
  points = 0,
  awarded_points = 0,
  scoring_reason = 'Keine Punkte: Eine laengere Aktivitaet desselben Mitglieds wurde an diesem Tag gewertet.',
  scored_at = now()
from ranked_activities ranked
where ranked.id = a.id
  and ranked.daily_score_order > 1;