create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  role text not null default 'member',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_role_check check (role in ('admin', 'member')),
  constraint profiles_display_name_not_blank check (length(btrim(display_name)) > 0)
);

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create table public.strava_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  strava_athlete_id bigint not null,
  access_token text,
  refresh_token text not null,
  expires_at timestamptz,
  scope text,
  revoked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint strava_connections_user_unique unique (user_id),
  constraint strava_connections_athlete_unique unique (strava_athlete_id)
);

create trigger set_strava_connections_updated_at
before update on public.strava_connections
for each row execute function public.set_updated_at();

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  starts_on date not null,
  ends_on date not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seasons_name_not_blank check (length(btrim(name)) > 0),
  constraint seasons_date_range_check check (ends_on >= starts_on)
);

create unique index seasons_one_active_idx
on public.seasons (is_active)
where is_active;

create trigger set_seasons_updated_at
before update on public.seasons
for each row execute function public.set_updated_at();

create table public.scoring_rules (
  id uuid primary key default gen_random_uuid(),
  season_id uuid references public.seasons(id) on delete cascade,
  name text not null,
  category text not null,
  points integer not null,
  rule_type text not null,
  priority integer not null,
  name_keywords text[] not null,
  allowed_weekdays integer[],
  valid_from timestamptz,
  valid_until timestamptz,
  min_distance_m numeric,
  allowed_sport_types text[],
  manual_entry_allowed boolean not null default false,
  manual_entry_valid_from_rule text,
  manual_entry_valid_until_rule text,
  max_manual_entries_per_user integer not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint scoring_rules_name_not_blank check (length(btrim(name)) > 0),
  constraint scoring_rules_category_not_blank check (length(btrim(category)) > 0),
  constraint scoring_rules_points_positive check (points > 0),
  constraint scoring_rules_rule_type_check check (rule_type in ('standard', 'special')),
  constraint scoring_rules_keywords_not_empty check (array_length(name_keywords, 1) > 0),
  constraint scoring_rules_weekdays_valid check (
    allowed_weekdays is null
    or allowed_weekdays <@ array[1, 2, 3, 4, 5, 6, 7]
  ),
  constraint scoring_rules_valid_range_check check (
    valid_from is null
    or valid_until is null
    or valid_until >= valid_from
  ),
  constraint scoring_rules_min_distance_check check (
    min_distance_m is null or min_distance_m >= 0
  ),
  constraint scoring_rules_manual_limit_check check (max_manual_entries_per_user > 0)
);

create trigger set_scoring_rules_updated_at
before update on public.scoring_rules
for each row execute function public.set_updated_at();

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  season_id uuid not null references public.seasons(id) on delete restrict,
  strava_activity_id bigint,
  source text not null,
  activity_name text not null,
  sport_type text,
  activity_started_at timestamptz not null,
  activity_started_local_at timestamptz,
  uploaded_or_created_at timestamptz,
  category text,
  points integer not null default 0,
  matched_rule_id uuid references public.scoring_rules(id) on delete set null,
  matched_rule_name text,
  matched_category text,
  awarded_points integer not null default 0,
  scoring_reason text,
  scored_at timestamptz,
  status text not null default 'active',
  manually_entered boolean not null default false,
  manual_comment text,
  manual_entry_key text,
  strava_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint activities_source_check check (source in ('strava', 'manual')),
  constraint activities_status_check check (status in ('active', 'ignored', 'deleted')),
  constraint activities_name_not_blank check (length(btrim(activity_name)) > 0),
  constraint activities_points_check check (points >= 0 and awarded_points >= 0),
  constraint activities_strava_id_required check (
    source = 'manual'
    or strava_activity_id is not null
  )
);

create unique index activities_strava_activity_id_unique_idx
on public.activities (strava_activity_id)
where strava_activity_id is not null;

create unique index activities_manual_entry_key_unique_idx
on public.activities (user_id, season_id, manual_entry_key)
where source = 'manual'
  and status = 'active'
  and manual_entry_key is not null;

create trigger set_activities_updated_at
before update on public.activities
for each row execute function public.set_updated_at();

create table public.manual_entry_windows (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  weekday_start integer not null,
  time_start time not null,
  weekday_end integer not null,
  time_end time not null,
  points integer not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint manual_entry_windows_category_not_blank check (length(btrim(category)) > 0),
  constraint manual_entry_windows_weekday_start_check check (weekday_start between 1 and 7),
  constraint manual_entry_windows_weekday_end_check check (weekday_end between 1 and 7),
  constraint manual_entry_windows_points_positive check (points > 0)
);

create trigger set_manual_entry_windows_updated_at
before update on public.manual_entry_windows
for each row execute function public.set_updated_at();

create table public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  title text not null,
  message text not null,
  user_id uuid references public.profiles(id) on delete set null,
  activity_id uuid references public.activities(id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint admin_notifications_type_not_blank check (length(btrim(type)) > 0),
  constraint admin_notifications_title_not_blank check (length(btrim(title)) > 0),
  constraint admin_notifications_message_not_blank check (length(btrim(message)) > 0)
);

create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  object_type text not null,
  object_id bigint not null,
  aspect_type text not null,
  owner_id bigint not null,
  event_time timestamptz not null,
  raw_payload jsonb not null,
  processed_at timestamptz,
  processing_status text not null default 'pending',
  processing_error text,
  created_at timestamptz not null default now(),
  constraint webhook_events_status_check check (
    processing_status in ('pending', 'processing', 'processed', 'ignored', 'failed')
  ),
  constraint webhook_events_unique unique (object_type, object_id, aspect_type, event_time)
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now(),
  constraint audit_log_action_not_blank check (length(btrim(action)) > 0),
  constraint audit_log_entity_type_not_blank check (length(btrim(entity_type)) > 0)
);

create index strava_connections_user_id_idx on public.strava_connections (user_id);
create index strava_connections_active_athlete_idx
on public.strava_connections (strava_athlete_id)
where not revoked;

create index seasons_active_dates_idx on public.seasons (is_active, starts_on, ends_on);
create index scoring_rules_season_active_priority_idx
on public.scoring_rules (season_id, is_active, priority desc);
create index scoring_rules_keywords_gin_idx on public.scoring_rules using gin (name_keywords);
create index scoring_rules_sport_types_gin_idx
on public.scoring_rules using gin (allowed_sport_types)
where allowed_sport_types is not null;

create index activities_user_id_idx on public.activities (user_id);
create index activities_season_user_active_idx
on public.activities (season_id, user_id)
where status = 'active';
create index activities_season_category_source_idx
on public.activities (season_id, category, source)
where status = 'active';
create index activities_started_local_idx
on public.activities (activity_started_local_at)
where status = 'active';
create index activities_matched_rule_id_idx on public.activities (matched_rule_id);

create index admin_notifications_unread_idx
on public.admin_notifications (created_at desc)
where read_at is null;
create index admin_notifications_user_id_idx on public.admin_notifications (user_id);
create index admin_notifications_activity_id_idx on public.admin_notifications (activity_id);

create index webhook_events_owner_status_idx
on public.webhook_events (owner_id, processing_status, created_at desc);

create index audit_log_actor_user_id_idx on public.audit_log (actor_user_id);
create index audit_log_entity_idx on public.audit_log (entity_type, entity_id);

create or replace function public.is_admin()
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
      and role = 'admin'
      and is_active
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, service_role;

alter table public.profiles enable row level security;
alter table public.strava_connections enable row level security;
alter table public.seasons enable row level security;
alter table public.scoring_rules enable row level security;
alter table public.activities enable row level security;
alter table public.manual_entry_windows enable row level security;
alter table public.admin_notifications enable row level security;
alter table public.webhook_events enable row level security;
alter table public.audit_log enable row level security;

create policy profiles_select_own_or_admin
on public.profiles for select
to authenticated
using (id = (select auth.uid()) or public.is_admin());

create policy profiles_admin_all
on public.profiles for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy strava_connections_select_own_or_admin
on public.strava_connections for select
to authenticated
using (user_id = (select auth.uid()) or public.is_admin());

create policy seasons_select_authenticated
on public.seasons for select
to authenticated
using (true);

create policy seasons_admin_all
on public.seasons for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy scoring_rules_select_active_or_admin
on public.scoring_rules for select
to authenticated
using (is_active or public.is_admin());

create policy scoring_rules_admin_all
on public.scoring_rules for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy activities_select_own_or_admin
on public.activities for select
to authenticated
using (user_id = (select auth.uid()) or public.is_admin());

create policy activities_admin_all
on public.activities for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy manual_entry_windows_select_active_or_admin
on public.manual_entry_windows for select
to authenticated
using (active or public.is_admin());

create policy manual_entry_windows_admin_all
on public.manual_entry_windows for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy admin_notifications_admin_all
on public.admin_notifications for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy webhook_events_admin_select
on public.webhook_events for select
to authenticated
using (public.is_admin());

create policy audit_log_admin_select
on public.audit_log for select
to authenticated
using (public.is_admin());

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.strava_connections from anon, authenticated;
revoke all on table public.seasons from anon, authenticated;
revoke all on table public.scoring_rules from anon, authenticated;
revoke all on table public.activities from anon, authenticated;
revoke all on table public.manual_entry_windows from anon, authenticated;
revoke all on table public.admin_notifications from anon, authenticated;
revoke all on table public.webhook_events from anon, authenticated;
revoke all on table public.audit_log from anon, authenticated;

grant select, insert, update, delete on table public.profiles to authenticated;
grant select (id, user_id, strava_athlete_id, expires_at, scope, revoked, created_at, updated_at)
on public.strava_connections to authenticated;
grant select, insert, update, delete on table public.seasons to authenticated;
grant select, insert, update, delete on table public.scoring_rules to authenticated;
grant select, insert, update, delete on table public.activities to authenticated;
grant select, insert, update, delete on table public.manual_entry_windows to authenticated;
grant select, insert, update, delete on table public.admin_notifications to authenticated;
grant select on table public.webhook_events to authenticated;
grant select on table public.audit_log to authenticated;

grant all on table public.profiles to service_role;
grant all on table public.strava_connections to service_role;
grant all on table public.seasons to service_role;
grant all on table public.scoring_rules to service_role;
grant all on table public.activities to service_role;
grant all on table public.manual_entry_windows to service_role;
grant all on table public.admin_notifications to service_role;
grant all on table public.webhook_events to service_role;
grant all on table public.audit_log to service_role;

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
    where (select auth.uid()) is not null
      and p.is_active
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
to authenticated;
