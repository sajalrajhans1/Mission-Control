-- ============================================================
-- Migration 008 — Private Sticky Notes
-- ============================================================

alter table public.sticky_notes add column if not exists is_private boolean not null default false;
