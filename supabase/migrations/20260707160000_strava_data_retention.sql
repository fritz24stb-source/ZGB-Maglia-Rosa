alter table public.strava_connections
alter column refresh_token drop not null;

alter table public.activities
add column if not exists strava_erased_at timestamptz;

alter table public.activities
drop constraint if exists activities_strava_id_required;

alter table public.activities
add constraint activities_strava_id_required check (
  source = 'manual'
  or strava_activity_id is not null
  or strava_erased_at is not null
);

comment on column public.activities.strava_erased_at is
'Set when Strava-origin detail data has been erased while aggregate scoring data is retained.';
