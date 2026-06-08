-- ============================================================
-- Mission Control v3 — Migration 006
-- Adds: vaults.created_by text
-- ============================================================

alter table public.vaults add column if not exists created_by text;
