-- ============================================================
-- Migration 003 — Auth, Money Splits, and Project Details
-- ============================================================

-- Upgrading Tasks for "Both" assignments
alter table public.tasks add column if not exists completed_user1 boolean not null default false;
alter table public.tasks add column if not exists completed_user2 boolean not null default false;

-- Upgrading Money entries for splits and categories
alter table public.money_entries add column if not exists added_by text not null default 'user1';
alter table public.money_entries add column if not exists category text not null default 'Misc';
alter table public.money_entries add column if not exists is_request boolean not null default false;
alter table public.money_entries add column if not exists request_to text;
alter table public.money_entries add column if not exists request_status text default 'pending' check (request_status in ('pending', 'approved', 'settled'));

-- Upgrading Projects for PRD/description
alter table public.projects add column if not exists description text not null default '';

-- Project Files table for uploads (base64) & links
create table if not exists public.project_files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  file_data text, -- for base64 content
  url text, -- for link attachments
  uploaded_by text not null,
  created_at timestamptz not null default now()
);

-- Enable RLS and setup publication
alter table public.project_files enable row level security;
create policy "anon full access" on public.project_files for all to anon using (true) with check (true);
alter publication supabase_realtime add table public.project_files;
