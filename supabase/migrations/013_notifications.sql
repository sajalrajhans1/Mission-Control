-- 013_notifications.sql
-- Creates the notifications table for persistent in-app notifications

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  for_user text not null, -- 'user1' or 'user2'
  title text not null,
  body text not null default '',
  read boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS
alter table public.notifications enable row level security;

-- Drop existing policy if exists to avoid conflicts on re-run
drop policy if exists "anon full access" on public.notifications;
create policy "anon full access" on public.notifications for all to anon using (true) with check (true);

-- Enable realtime by checking if not already added
alter publication supabase_realtime add table public.notifications;

-- Trigger for updated_at
drop trigger if exists set_notifications_updated_at on public.notifications;
create trigger set_notifications_updated_at before update on public.notifications for each row execute function public.set_updated_at();
