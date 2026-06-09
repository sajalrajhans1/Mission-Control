-- ============================================================
-- Migration 010 — Client Projects & Milestones
-- ============================================================

-- 1. Add new columns to public.projects
alter table public.projects add column if not exists project_type text not null default 'normal' check (project_type in ('normal', 'client'));
alter table public.projects add column if not exists is_private boolean not null default false;
alter table public.projects add column if not exists created_by text;
alter table public.projects add column if not exists client_briefing text not null default '';
alter table public.projects add column if not exists client_deadline timestamptz;

-- 2. Create project_milestones table
create table if not exists public.project_milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  due_date timestamptz,
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Enable RLS on milestones
alter table public.project_milestones enable row level security;
drop policy if exists "anon full access" on public.project_milestones;
create policy "anon full access" on public.project_milestones for all using (true) with check (true);

-- 4. Enable updated_at trigger for milestones
drop trigger if exists set_project_milestones_updated_at on public.project_milestones;
create trigger set_project_milestones_updated_at before update on public.project_milestones
  for each row execute function public.set_updated_at();

-- 5. Add to realtime publication
alter publication supabase_realtime add table public.project_milestones;
