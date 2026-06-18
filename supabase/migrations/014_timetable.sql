-- 014_timetable.sql
-- Creates the timetable_blocks table for private daily scheduling

create table if not exists public.timetable_blocks (
  id uuid primary key default gen_random_uuid(),
  user_key text not null, -- 'user1' or 'user2'
  title text not null,
  block_date text not null, -- YYYY-MM-DD format as text to bypass timezone shifts
  start_time text not null, -- "HH:MM" format
  end_time text not null, -- "HH:MM" format
  task_id uuid references public.tasks(id) on delete set null,
  color text not null default 'indigo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS
alter table public.timetable_blocks enable row level security;

-- Drop existing policy if exists to avoid conflicts on re-run
drop policy if exists "anon full access" on public.timetable_blocks;
create policy "anon full access" on public.timetable_blocks for all to anon using (true) with check (true);

-- Enable realtime
alter publication supabase_realtime add table public.timetable_blocks;

-- Trigger for updated_at
drop trigger if exists set_timetable_blocks_updated_at on public.timetable_blocks;
create trigger set_timetable_blocks_updated_at before update on public.timetable_blocks for each row execute function public.set_updated_at();
