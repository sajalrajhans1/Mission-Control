-- 015_work_deliverables.sql
-- Creates the work_deliverables table for tracking client deliverables and payments/pricing privately

create table if not exists public.work_deliverables (
  id uuid primary key default gen_random_uuid(),
  user_key text not null, -- 'user1' or 'user2' to ensure complete privacy isolation
  title text not null,
  description text not null default '',
  delivery_date text not null, -- YYYY-MM-DD format as text to avoid timezone issues
  client_name text not null default '',
  amount numeric not null default 0, -- price or estimated payment for the deliverable
  status text not null default 'delivered', -- 'delivered', 'pending', 'paid'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable RLS
alter table public.work_deliverables enable row level security;

-- Drop existing policy if exists to avoid conflicts on re-run
drop policy if exists "anon full access" on public.work_deliverables;
create policy "anon full access" on public.work_deliverables for all to anon using (true) with check (true);

-- Enable realtime
alter publication supabase_realtime add table public.work_deliverables;

-- Trigger for updated_at
drop trigger if exists set_work_deliverables_updated_at on public.work_deliverables;
create trigger set_work_deliverables_updated_at before update on public.work_deliverables for each row execute function public.set_updated_at();

-- Insert Work Deliverables as a default vault (where name = 'Work Deliverables' doesn't exist)
insert into public.vaults (name, icon, order_index, is_default)
select 'Work Deliverables', 'Briefcase', 4, true
where not exists (
  select 1 from public.vaults where name = 'Work Deliverables'
);
