-- ============================================================
-- Migration 005 — Task Notes and Approval Fields
-- ============================================================

alter table public.tasks add column if not exists note text not null default '';
alter table public.tasks add column if not exists approved boolean not null default true;
