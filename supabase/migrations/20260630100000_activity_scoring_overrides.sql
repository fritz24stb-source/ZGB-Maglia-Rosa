alter table public.activities
add column if not exists scoring_override_rule_id uuid
references public.scoring_rules(id) on delete set null;

create index if not exists activities_scoring_override_rule_id_idx
on public.activities (scoring_override_rule_id);
