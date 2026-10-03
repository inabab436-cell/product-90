-- =============================================================================
-- CUPAI — Staff members (team accounts with scoped permissions).
--
-- The owner creates an INVITE (name + permissions). The app generates a unique
-- invite link; the staff member opens that link and registers themself, which
-- stores their email and activates the row. When a staff email signs in, the
-- app session is created with the OWNER's user id (so every existing data query
-- keeps working) plus the staff id, and every server function checks the staff
-- permissions.
--
-- All reads/writes go through server functions using the service role, so RLS
-- is enabled with NO policies (anon/authenticated get nothing).
-- Safe to re-run.
-- =============================================================================

create table if not exists public.staff_members (
  id            uuid primary key default gen_random_uuid(),
  merchant_id   uuid not null,
  invite_token  text not null,
  email         text,
  name          text not null default '',
  permissions   text[] not null default '{}',
  full_access   boolean not null default false,
  status        text not null default 'invited',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  accepted_at   timestamptz,
  last_login_at timestamptz
);

-- Bring an older version of the table up to date (no-ops on a fresh install).
alter table public.staff_members add column if not exists invite_token text;
alter table public.staff_members add column if not exists accepted_at timestamptz;
alter table public.staff_members alter column email drop not null;
update public.staff_members
   set invite_token = replace(gen_random_uuid()::text, '-', '')
 where invite_token is null;
alter table public.staff_members alter column invite_token set not null;

-- Allowed statuses: invited (link not used yet), active, disabled.
alter table public.staff_members drop constraint if exists staff_members_status_check;
alter table public.staff_members
  add constraint staff_members_status_check
  check (status in ('invited', 'active', 'disabled'));

-- The invite token is the secret in the link: it must be unique.
create unique index if not exists staff_members_invite_token_key
  on public.staff_members (invite_token);

-- One staff row per email: a single email must resolve to exactly one brand at
-- sign-in time. NULL emails (pending invites) are ignored by this index.
drop index if exists public.staff_members_email_key;
create unique index if not exists staff_members_email_key
  on public.staff_members (lower(email))
  where email is not null;

create index if not exists staff_members_merchant_idx
  on public.staff_members (merchant_id, created_at desc);

grant all on public.staff_members to service_role;

alter table public.staff_members enable row level security;
