-- ============================================================
-- Migration 004 — Add Task Creator for Deletion Controls
-- ============================================================

alter table public.tasks add column if not exists created_by text not null default 'Unknown';
