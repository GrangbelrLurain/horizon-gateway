-- Team Pro plan tracking (Lemon Squeezy)
-- Safe to re-run.

alter table public.workspaces
  add column if not exists plan text not null default 'free';

alter table public.workspaces
  add column if not exists ls_subscription_id text;

do $$
begin
  alter table public.workspaces
    add constraint workspaces_plan_check check (plan in ('free', 'pro'));
exception
  when duplicate_object then null;
end $$;

-- Free tier default seats = 3 (Pro webhook sets 5)
-- Only bump rows that are still free and still on the old default of 5 with no subscription.
update public.workspaces
set seat_limit = 3
where plan = 'free'
  and ls_subscription_id is null
  and seat_limit = 5;

create index if not exists idx_workspaces_ls_subscription_id
  on public.workspaces (ls_subscription_id);
