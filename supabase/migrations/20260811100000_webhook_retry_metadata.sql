alter table public.webhook_events
  add column if not exists attempt_count integer not null default 0,
  add column if not exists next_retry_at timestamptz;

alter table public.webhook_events
  add constraint webhook_events_attempt_count_non_negative
  check (attempt_count >= 0);

create index if not exists webhook_events_retry_queue_idx
  on public.webhook_events (next_retry_at, created_at)
  where processing_status = 'failed';
