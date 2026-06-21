-- 016_tasks_canvas.sql
-- Migration 016 — Task Privacy & Canvas Card Positions and Connections

-- 1. Add is_private column to public.tasks if it does not exist
alter table public.tasks add column if not exists is_private boolean not null default false;

-- 2. Create task_card_positions table
create table if not exists public.task_card_positions (
  id uuid primary key default gen_random_uuid(),
  card_id text unique not null, -- 'general' or project UUID
  x numeric not null default 0,
  y numeric not null default 0,
  is_private boolean not null default false,
  created_by text not null, -- 'user1' or 'user2'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Create task_card_connections table
create table if not exists public.task_card_connections (
  id uuid primary key default gen_random_uuid(),
  source_id text not null, -- 'general' or project UUID
  target_id text not null, -- 'general' or project UUID
  is_private boolean not null default false,
  created_by text not null, -- 'user1' or 'user2'
  created_at timestamptz not null default now(),
  unique (source_id, target_id)
);

-- 4. Enable Row Level Security (RLS)
alter table public.task_card_positions enable row level security;
alter table public.task_card_connections enable row level security;

-- Drop existing policies if they exist to avoid conflict
drop policy if exists "anon full access" on public.task_card_positions;
create policy "anon full access" on public.task_card_positions for all to anon using (true) with check (true);

drop policy if exists "anon full access" on public.task_card_connections;
create policy "anon full access" on public.task_card_connections for all to anon using (true) with check (true);

-- 5. Enable Realtime Publications
-- Using exception block to handle if already added or simply check existing
alter publication supabase_realtime add table public.task_card_positions;
alter publication supabase_realtime add table public.task_card_connections;

-- 6. Triggers for updated_at
drop trigger if exists set_task_card_positions_updated_at on public.task_card_positions;
create trigger set_task_card_positions_updated_at before update on public.task_card_positions for each row execute function public.set_updated_at();
