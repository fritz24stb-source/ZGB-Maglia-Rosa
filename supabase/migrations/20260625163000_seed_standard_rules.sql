insert into public.seasons (id, name, starts_on, ends_on, is_active)
values (
  '00000000-0000-4000-8000-000000002026',
  'Test-Saison 2026',
  date '2026-01-01',
  date '2026-12-31',
  true
)
on conflict (id) do update
set
  name = excluded.name,
  starts_on = excluded.starts_on,
  ends_on = excluded.ends_on,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.scoring_rules (
  id,
  season_id,
  name,
  category,
  points,
  rule_type,
  priority,
  name_keywords,
  allowed_weekdays,
  manual_entry_allowed,
  manual_entry_valid_from_rule,
  manual_entry_valid_until_rule,
  max_manual_entries_per_user,
  is_active
)
values
  (
    '00000000-0000-4000-8000-000000000101',
    null,
    'Samstags-Fondo',
    'fondo',
    100,
    'standard',
    100,
    array['fondo'],
    array[6, 7],
    true,
    'weekly:saturday:10:00:Europe/Berlin',
    'weekly:sunday:18:00:Europe/Berlin',
    1,
    true
  ),
  (
    '00000000-0000-4000-8000-000000000102',
    null,
    'ZGB Zug',
    'zgb_zug',
    80,
    'standard',
    80,
    array['zgb', 'zug'],
    array[3, 4],
    true,
    'weekly:wednesday:18:00:Europe/Berlin',
    'weekly:thursday:18:00:Europe/Berlin',
    1,
    true
  ),
  (
    '00000000-0000-4000-8000-000000000103',
    null,
    'Scuola',
    'scuola',
    80,
    'standard',
    80,
    array['scuola'],
    array[3, 4],
    true,
    'weekly:wednesday:18:00:Europe/Berlin',
    'weekly:thursday:18:00:Europe/Berlin',
    1,
    true
  ),
  (
    '00000000-0000-4000-8000-000000000104',
    null,
    'Scuderia',
    'scuderia',
    80,
    'standard',
    80,
    array['scuderia'],
    array[3, 4],
    true,
    'weekly:wednesday:18:00:Europe/Berlin',
    'weekly:thursday:18:00:Europe/Berlin',
    1,
    true
  )
on conflict (id) do update
set
  season_id = excluded.season_id,
  name = excluded.name,
  category = excluded.category,
  points = excluded.points,
  rule_type = excluded.rule_type,
  priority = excluded.priority,
  name_keywords = excluded.name_keywords,
  allowed_weekdays = excluded.allowed_weekdays,
  manual_entry_allowed = excluded.manual_entry_allowed,
  manual_entry_valid_from_rule = excluded.manual_entry_valid_from_rule,
  manual_entry_valid_until_rule = excluded.manual_entry_valid_until_rule,
  max_manual_entries_per_user = excluded.max_manual_entries_per_user,
  is_active = excluded.is_active,
  updated_at = now();

insert into public.manual_entry_windows (
  id,
  category,
  weekday_start,
  time_start,
  weekday_end,
  time_end,
  points,
  active
)
values
  (
    '00000000-0000-4000-8000-000000000201',
    'fondo',
    6,
    time '10:00',
    7,
    time '18:00',
    100,
    true
  ),
  (
    '00000000-0000-4000-8000-000000000202',
    'zgb_zug',
    3,
    time '18:00',
    4,
    time '18:00',
    80,
    true
  ),
  (
    '00000000-0000-4000-8000-000000000203',
    'scuola',
    3,
    time '18:00',
    4,
    time '18:00',
    80,
    true
  ),
  (
    '00000000-0000-4000-8000-000000000204',
    'scuderia',
    3,
    time '18:00',
    4,
    time '18:00',
    80,
    true
  )
on conflict (id) do update
set
  category = excluded.category,
  weekday_start = excluded.weekday_start,
  time_start = excluded.time_start,
  weekday_end = excluded.weekday_end,
  time_end = excluded.time_end,
  points = excluded.points,
  active = excluded.active,
  updated_at = now();
