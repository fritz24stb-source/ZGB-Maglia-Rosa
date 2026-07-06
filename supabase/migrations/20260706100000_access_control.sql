create table public.app_invites (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null,
  token_hint text not null,
  invite_type text not null,
  email text,
  expires_at timestamptz not null,
  max_uses integer,
  use_count integer not null default 0,
  used_at timestamptz,
  used_by_user_id uuid references public.profiles(id) on delete set null,
  revoked_at timestamptz,
  sent_at timestamptz,
  email_delivery_status text,
  email_delivery_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_invites_token_hash_unique unique (token_hash),
  constraint app_invites_type_check check (invite_type in ('single', 'group')),
  constraint app_invites_token_hint_not_blank check (length(btrim(token_hint)) > 0),
  constraint app_invites_email_not_blank check (email is null or length(btrim(email)) > 0),
  constraint app_invites_uses_check check (
    use_count >= 0
    and (max_uses is null or max_uses > 0)
  ),
  constraint app_invites_email_delivery_status_check check (
    email_delivery_status is null
    or email_delivery_status in ('skipped', 'sent', 'failed')
  )
);

create trigger set_app_invites_updated_at
before update on public.app_invites
for each row execute function public.set_updated_at();

create index app_invites_type_status_idx
on public.app_invites (invite_type, expires_at desc)
where revoked_at is null;

create table public.app_user_credentials (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_user_credentials_password_hash_not_blank check (length(btrim(password_hash)) > 0)
);

create trigger set_app_user_credentials_updated_at
before update on public.app_user_credentials
for each row execute function public.set_updated_at();

create table public.app_passkey_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  credential_id text not null,
  public_key_spki text not null,
  algorithm integer not null,
  sign_count bigint not null default 0,
  transports text[],
  name text,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint app_passkey_credentials_credential_unique unique (credential_id),
  constraint app_passkey_credentials_credential_not_blank check (length(btrim(credential_id)) > 0),
  constraint app_passkey_credentials_key_not_blank check (length(btrim(public_key_spki)) > 0),
  constraint app_passkey_credentials_sign_count_check check (sign_count >= 0)
);

create trigger set_app_passkey_credentials_updated_at
before update on public.app_passkey_credentials
for each row execute function public.set_updated_at();

create index app_passkey_credentials_user_id_idx
on public.app_passkey_credentials (user_id);

create unique index profiles_display_name_key_unique_idx
on public.profiles (lower(btrim(display_name)));

create or replace function public.consume_app_invite(
  p_invite_id uuid,
  p_user_id uuid
)
returns public.app_invites
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_invite public.app_invites;
begin
  update public.app_invites
  set
    use_count = use_count + 1,
    used_at = case when max_uses = 1 then now() else used_at end,
    used_by_user_id = case when max_uses = 1 then p_user_id else used_by_user_id end
  where id = p_invite_id
    and revoked_at is null
    and expires_at >= now()
    and (max_uses is null or use_count < max_uses)
  returning * into updated_invite;

  if not found then
    raise exception 'Invitation is no longer valid.' using errcode = 'P0001';
  end if;

  return updated_invite;
end;
$$;

alter table public.app_invites enable row level security;
alter table public.app_user_credentials enable row level security;
alter table public.app_passkey_credentials enable row level security;

revoke all on table public.app_invites from anon, authenticated;
revoke all on table public.app_user_credentials from anon, authenticated;
revoke all on table public.app_passkey_credentials from anon, authenticated;
revoke all on function public.consume_app_invite(uuid, uuid) from public;

grant all on table public.app_invites to service_role;
grant all on table public.app_user_credentials to service_role;
grant all on table public.app_passkey_credentials to service_role;
grant execute on function public.consume_app_invite(uuid, uuid) to service_role;
