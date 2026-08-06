-- Allow workspace peers to read each other's profile identity (email / display_name).
-- Needed for member list UI; does not broaden write access.

create or replace function public.shares_workspace_with(target_profile uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    target_profile = auth.uid()
    or exists (
      select 1
      from public.workspace_members me
      where me.profile_id = auth.uid()
        and (
          exists (
            select 1
            from public.workspace_members peer
            where peer.workspace_id = me.workspace_id
              and peer.profile_id = target_profile
          )
          or exists (
            select 1
            from public.workspaces w
            where w.id = me.workspace_id
              and w.owner_id = target_profile
          )
        )
    )
    or exists (
      select 1
      from public.workspaces w
      where w.owner_id = auth.uid()
        and (
          w.owner_id = target_profile
          or exists (
            select 1
            from public.workspace_members peer
            where peer.workspace_id = w.id
              and peer.profile_id = target_profile
          )
        )
    );
$$;

drop policy if exists "profiles_select_workspace_peers" on public.profiles;
create policy "profiles_select_workspace_peers" on public.profiles
  for select to authenticated
  using (public.shares_workspace_with(id));
