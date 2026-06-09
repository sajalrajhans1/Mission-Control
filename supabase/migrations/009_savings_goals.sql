-- ============================================================
-- Migration 009 — Savings Goals
-- ============================================================

create table if not exists public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  target_amount numeric not null,
  current_amount numeric not null default 0,
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS
alter table public.savings_goals enable row level security;

-- Policy for full access
create policy "anon full access" on public.savings_goals for all using (true) with check (true);

-- Add to publication for realtime sync
alter publication supabase_realtime add table public.savings_goals;

-- Link money_entries to savings_goals
alter table public.money_entries add column if not exists savings_goal_id uuid references public.savings_goals(id) on delete set null;
