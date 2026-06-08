-- ============================================================
-- Mission Control v2 — Migration 002
-- Adds: vaults, vault_items, project.color, project.archived
-- ============================================================

create extension if not exists "pgcrypto";

-- Dynamic vault containers
create table if not exists public.vaults (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  icon text,
  order_index integer not null default 0,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Generic vault items (used by custom vaults; default vaults still use their own tables)
create table if not exists public.vault_items (
  id uuid primary key default gen_random_uuid(),
  vault_id uuid not null references public.vaults(id) on delete cascade,
  title text not null,
  body text not null default '',
  meta jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Extend projects with color + archived
alter table public.projects add column if not exists color text;
alter table public.projects add column if not exists archived boolean not null default false;

-- Triggers
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists set_vaults_updated_at on public.vaults;
create trigger set_vaults_updated_at before update on public.vaults
  for each row execute function public.set_updated_at();

drop trigger if exists set_vault_items_updated_at on public.vault_items;
create trigger set_vault_items_updated_at before update on public.vault_items
  for each row execute function public.set_updated_at();

-- RLS
alter table public.vaults enable row level security;
alter table public.vault_items enable row level security;

drop policy if exists "anonymous full access" on public.vaults;
create policy "anonymous full access" on public.vaults for all to anon using (true) with check (true);

drop policy if exists "anonymous full access" on public.vault_items;
create policy "anonymous full access" on public.vault_items for all to anon using (true) with check (true);

-- Realtime
alter publication supabase_realtime add table public.vaults;
alter publication supabase_realtime add table public.vault_items;

-- Seed default vaults (idempotent)
insert into public.vaults (name, icon, order_index, is_default) values
  ('Prompts',      'WandSparkles', 0, true),
  ('Ideas',        'Lightbulb',    1, true),
  ('Resources',    'Link',         2, true),
  ('Sticky Notes', 'StickyNote',   3, true)
on conflict do nothing;

-- User name settings (idempotent)
insert into public.settings (key, value) values
  ('user1_name', '"Phoenix"'),
  ('user2_name', '"Friend"')
on conflict (key) do nothing;
