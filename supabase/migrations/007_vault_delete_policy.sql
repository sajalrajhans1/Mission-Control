-- ============================================================
-- Mission Control v3 — Migration 007
-- Restricts deleting vaults:
-- 1. Default vaults (is_default = true) cannot be deleted.
-- 2. Custom vaults can be deleted by users.
-- ============================================================

-- Drop existing broad RLS policy for vaults
drop policy if exists "anonymous full access" on public.vaults;

-- Create granular policies for SELECT, INSERT, UPDATE, and DELETE
create policy "anon select vaults" on public.vaults for select to anon using (true);
create policy "anon insert vaults" on public.vaults for insert to anon with check (true);
create policy "anon update vaults" on public.vaults for update to anon using (true) with check (true);

-- Restrict DELETE: only allowed for non-default vaults (is_default = false)
create policy "anon delete vaults" on public.vaults for delete to anon using (is_default = false);
