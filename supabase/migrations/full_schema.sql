-- ============================================================
-- Mission Control — Full Schema (run once in Supabase SQL Editor)
-- ============================================================

create extension if not exists "pgcrypto";

-- Projects
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tasks (assigned_to is free text so custom names work)
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  assigned_to text not null default 'Phoenix',
  project_id uuid references public.projects(id) on delete set null,
  priority text not null default 'Medium' check (priority in ('Low', 'Medium', 'High')),
  due_date date,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Prompts
create table if not exists public.prompts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'Misc',
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Ideas
create table if not exists public.ideas (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Resources
create table if not exists public.resources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  url text not null,
  category text not null default 'Misc',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Sticky Notes (author is free text so custom names work)
create table if not exists public.sticky_notes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  color text not null default 'Yellow' check (color in ('Yellow', 'Blue', 'Green', 'Pink')),
  author text not null default 'Phoenix',
  pinned boolean not null default false,
  read boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Money entries
create table if not exists public.money_entries (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  amount numeric(12, 2) not null,
  type text not null check (type in ('Income', 'Expense')),
  entry_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Daily logs
create table if not exists public.daily_logs (
  id uuid primary key default gen_random_uuid(),
  log_date date not null unique,
  phoenix text not null default '',
  friend text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Wins
create table if not exists public.wins (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Settings
create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Vaults
create table if not exists public.vaults (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon text,
  order_index integer not null default 0,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Vault items (for custom vaults)
create table if not exists public.vault_items (
  id uuid primary key default gen_random_uuid(),
  vault_id uuid not null references public.vaults(id) on delete cascade,
  title text not null,
  body text not null default '',
  meta jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── updated_at trigger ────────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger set_projects_updated_at      before update on public.projects      for each row execute function public.set_updated_at();
create trigger set_tasks_updated_at         before update on public.tasks         for each row execute function public.set_updated_at();
create trigger set_prompts_updated_at       before update on public.prompts       for each row execute function public.set_updated_at();
create trigger set_ideas_updated_at         before update on public.ideas         for each row execute function public.set_updated_at();
create trigger set_resources_updated_at     before update on public.resources     for each row execute function public.set_updated_at();
create trigger set_sticky_notes_updated_at  before update on public.sticky_notes  for each row execute function public.set_updated_at();
create trigger set_money_entries_updated_at before update on public.money_entries  for each row execute function public.set_updated_at();
create trigger set_daily_logs_updated_at    before update on public.daily_logs    for each row execute function public.set_updated_at();
create trigger set_wins_updated_at          before update on public.wins          for each row execute function public.set_updated_at();
create trigger set_settings_updated_at      before update on public.settings      for each row execute function public.set_updated_at();
create trigger set_vaults_updated_at        before update on public.vaults        for each row execute function public.set_updated_at();
create trigger set_vault_items_updated_at   before update on public.vault_items   for each row execute function public.set_updated_at();

-- ── Row Level Security (allow anonymous access) ───────────────────────────────

alter table public.projects      enable row level security;
alter table public.tasks         enable row level security;
alter table public.prompts       enable row level security;
alter table public.ideas         enable row level security;
alter table public.resources     enable row level security;
alter table public.sticky_notes  enable row level security;
alter table public.money_entries enable row level security;
alter table public.daily_logs    enable row level security;
alter table public.wins          enable row level security;
alter table public.settings      enable row level security;
alter table public.vaults        enable row level security;
alter table public.vault_items   enable row level security;

create policy "anon full access" on public.projects      for all to anon using (true) with check (true);
create policy "anon full access" on public.tasks         for all to anon using (true) with check (true);
create policy "anon full access" on public.prompts       for all to anon using (true) with check (true);
create policy "anon full access" on public.ideas         for all to anon using (true) with check (true);
create policy "anon full access" on public.resources     for all to anon using (true) with check (true);
create policy "anon full access" on public.sticky_notes  for all to anon using (true) with check (true);
create policy "anon full access" on public.money_entries for all to anon using (true) with check (true);
create policy "anon full access" on public.daily_logs    for all to anon using (true) with check (true);
create policy "anon full access" on public.wins          for all to anon using (true) with check (true);
create policy "anon full access" on public.settings      for all to anon using (true) with check (true);
create policy "anon full access" on public.vaults        for all to anon using (true) with check (true);
create policy "anon full access" on public.vault_items   for all to anon using (true) with check (true);

-- ── Realtime ──────────────────────────────────────────────────────────────────

alter publication supabase_realtime add table public.projects;
alter publication supabase_realtime add table public.tasks;
alter publication supabase_realtime add table public.prompts;
alter publication supabase_realtime add table public.ideas;
alter publication supabase_realtime add table public.resources;
alter publication supabase_realtime add table public.sticky_notes;
alter publication supabase_realtime add table public.money_entries;
alter publication supabase_realtime add table public.daily_logs;
alter publication supabase_realtime add table public.wins;
alter publication supabase_realtime add table public.settings;
alter publication supabase_realtime add table public.vaults;
alter publication supabase_realtime add table public.vault_items;

-- ── Seed data ─────────────────────────────────────────────────────────────────

insert into public.vaults (name, icon, order_index, is_default) values
  ('Prompts',      'WandSparkles', 0, true),
  ('Ideas',        'Lightbulb',    1, true),
  ('Resources',    'Link',         2, true),
  ('Sticky Notes', 'StickyNote',   3, true)
on conflict do nothing;

insert into public.settings (key, value) values
  ('user1_name',    '"Phoenix"'),
  ('user2_name',    '"Friend"')
on conflict (key) do nothing;

insert into public.wins (title) values
  ('First $100 Day'),
  ('First International Client')
on conflict do nothing;
