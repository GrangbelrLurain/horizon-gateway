-- Monetization & polish baseline (v2.7 ~ v2.8)
-- See docs/planning/monetization-and-polish.md for the product rationale.
--
-- Safe to re-run: uses IF NOT EXISTS / IF EXISTS guards and DO blocks for policies.

-- =====================================================================================
-- 1. profiles: GitHub identity + sponsor_since (G1)
-- =====================================================================================

alter table public.profiles add column if not exists github_id text;
alter table public.profiles add column if not exists github_login text;
alter table public.profiles add column if not exists sponsor_since timestamptz;

create index if not exists idx_profiles_github_id on public.profiles (github_id);
create index if not exists idx_profiles_github_login on public.profiles (github_login);

-- Defense in depth: sponsor fields must only ever be written by the server
-- (GitHub Sponsors webhook Edge Function using the service_role key), never by a client
-- session, even if a future RLS policy accidentally allows a broader profile update.
create or replace function public.prevent_sponsor_field_tamper()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(auth.role(), 'anon') is distinct from 'service_role' then
    if new.is_sponsor is distinct from old.is_sponsor
       or new.sponsor_tier is distinct from old.sponsor_tier
       or new.sponsor_since is distinct from old.sponsor_since then
      raise exception 'is_sponsor / sponsor_tier / sponsor_since can only be updated by the server';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_prevent_sponsor_tamper on public.profiles;
create trigger trg_prevent_sponsor_tamper
  before update on public.profiles
  for each row execute function public.prevent_sponsor_field_tamper();

-- =====================================================================================
-- 2. feedbacks: version/OS/category/context metadata (G3)
-- =====================================================================================

alter table public.feedbacks add column if not exists category text;
alter table public.feedbacks add column if not exists app_version text;
alter table public.feedbacks add column if not exists os text;
alter table public.feedbacks add column if not exists install_id text;
alter table public.feedbacks add column if not exists context text;

do $$
begin
  alter table public.feedbacks
    add constraint feedbacks_category_check check (category in ('bug', 'feature', 'question'));
exception
  when duplicate_object then null;
end $$;

alter table public.feedbacks enable row level security;

do $$
begin
  create policy "feedbacks_insert_anyone" on public.feedbacks
    for insert
    to anon, authenticated
    with check (true);
exception
  when duplicate_object then null;
end $$;

-- =====================================================================================
-- 3. events: anonymous, opt-in telemetry (G2)
-- =====================================================================================

create table if not exists public.events (
  id bigint generated always as identity primary key,
  install_id text not null,
  app_version text,
  os text,
  event text not null,
  props jsonb not null default '{}'::jsonb,
  ts timestamptz not null default now()
);

create index if not exists idx_events_event on public.events (event);
create index if not exists idx_events_ts on public.events (ts);
create index if not exists idx_events_install_id on public.events (install_id);

alter table public.events enable row level security;

-- Insert-only: no SELECT policy is defined, so anon/authenticated clients cannot read
-- events back (only the service_role / dashboard can, since it bypasses RLS).
do $$
begin
  create policy "events_insert_anyone" on public.events
    for insert
    to anon, authenticated
    with check (true);
exception
  when duplicate_object then null;
end $$;

grant insert on public.events to anon, authenticated;
grant usage, select on sequence public.events_id_seq to anon, authenticated;

-- =====================================================================================
-- 4. Team MVP: workspaces / members / invites / resources (v2.9)
-- =====================================================================================

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references public.profiles (id) on delete cascade,
  seat_limit integer not null default 5,
  status text not null default 'active' check (status in ('active', 'past_due', 'canceled')),
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  unique (workspace_id, profile_id)
);

create table if not exists public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  invited_by uuid references public.profiles (id) on delete set null,
  token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  unique (token)
);

create table if not exists public.workspace_resources (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  -- Mirrors the desktop `.hg.json` export bundle's resource kinds (G4).
  kind text not null check (kind in ('domains', 'groups', 'domain_group_links', 'scenarios', 'mock_rules')),
  payload jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (workspace_id, kind)
);

create index if not exists idx_workspace_members_profile on public.workspace_members (profile_id);
create index if not exists idx_workspace_invites_email on public.workspace_invites (email);
create index if not exists idx_workspace_resources_workspace on public.workspace_resources (workspace_id);

-- security definer helpers avoid infinite RLS recursion on workspace_members itself
-- (the function body runs as the table owner, which is not subject to its own RLS).
create or replace function public.is_workspace_member(ws_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws_id and m.profile_id = auth.uid()
  );
$$;

create or replace function public.is_workspace_admin(ws_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws_id and m.profile_id = auth.uid() and m.role in ('owner', 'admin')
  );
$$;

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_invites enable row level security;
alter table public.workspace_resources enable row level security;

-- workspaces
do $$
begin
  create policy "workspaces_select_member" on public.workspaces
    for select to authenticated
    using (public.is_workspace_member(id));
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "workspaces_insert_owner" on public.workspaces
    for insert to authenticated
    with check (owner_id = auth.uid());
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "workspaces_update_admin" on public.workspaces
    for update to authenticated
    using (public.is_workspace_admin(id))
    with check (public.is_workspace_admin(id));
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "workspaces_delete_owner" on public.workspaces
    for delete to authenticated
    using (owner_id = auth.uid());
exception when duplicate_object then null;
end $$;

-- workspace_members
do $$
begin
  create policy "workspace_members_select_member" on public.workspace_members
    for select to authenticated
    using (public.is_workspace_member(workspace_id));
exception when duplicate_object then null;
end $$;

do $$
begin
  -- Self-service inserts only: creating your own owner row (createWorkspace) or
  -- accepting an invite (acceptInvite). Admin-adding-others goes through invites instead.
  create policy "workspace_members_insert_self" on public.workspace_members
    for insert to authenticated
    with check (profile_id = auth.uid());
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "workspace_members_update_admin" on public.workspace_members
    for update to authenticated
    using (public.is_workspace_admin(workspace_id))
    with check (public.is_workspace_admin(workspace_id));
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "workspace_members_delete_admin_or_self" on public.workspace_members
    for delete to authenticated
    using (public.is_workspace_admin(workspace_id) or profile_id = auth.uid());
exception when duplicate_object then null;
end $$;

-- workspace_invites
do $$
begin
  create policy "workspace_invites_select_member_or_invitee" on public.workspace_invites
    for select to authenticated
    using (
      public.is_workspace_member(workspace_id)
      or email = (auth.jwt() ->> 'email')
    );
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "workspace_invites_insert_admin" on public.workspace_invites
    for insert to authenticated
    with check (public.is_workspace_admin(workspace_id));
exception when duplicate_object then null;
end $$;

do $$
begin
  -- Admins can revoke; the invitee (matching JWT email) can accept their own invite.
  create policy "workspace_invites_update_admin_or_invitee" on public.workspace_invites
    for update to authenticated
    using (public.is_workspace_admin(workspace_id) or email = (auth.jwt() ->> 'email'))
    with check (public.is_workspace_admin(workspace_id) or email = (auth.jwt() ->> 'email'));
exception when duplicate_object then null;
end $$;

-- workspace_resources (MVP: any member can push/pull)
do $$
begin
  create policy "workspace_resources_select_member" on public.workspace_resources
    for select to authenticated
    using (public.is_workspace_member(workspace_id));
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "workspace_resources_insert_member" on public.workspace_resources
    for insert to authenticated
    with check (public.is_workspace_member(workspace_id));
exception when duplicate_object then null;
end $$;

do $$
begin
  create policy "workspace_resources_update_member" on public.workspace_resources
    for update to authenticated
    using (public.is_workspace_member(workspace_id))
    with check (public.is_workspace_member(workspace_id));
exception when duplicate_object then null;
end $$;
