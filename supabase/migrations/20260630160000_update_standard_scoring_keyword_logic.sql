update public.scoring_rules
set
  name_keywords = array['fondo oder samstags'],
  priority = 100,
  updated_at = now()
where id = '00000000-0000-4000-8000-000000000101';

update public.scoring_rules
set
  name_keywords = array['zgb oder zug', 'kein scuderia', 'kein scuola'],
  priority = 81,
  updated_at = now()
where id = '00000000-0000-4000-8000-000000000102';

update public.scoring_rules
set
  name_keywords = array['zgb oder scuola', 'kein zug', 'kein scuderia'],
  priority = 80,
  updated_at = now()
where id = '00000000-0000-4000-8000-000000000103';

update public.scoring_rules
set
  name_keywords = array['zgb oder scuderia', 'kein zug', 'kein scuola'],
  priority = 82,
  updated_at = now()
where id = '00000000-0000-4000-8000-000000000104';
