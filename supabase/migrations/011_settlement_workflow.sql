-- 011_settlement_workflow.sql
-- Adds multi-step settlement workflow columns to money_entries

-- Add paid_amount to track partial/full payments
ALTER TABLE money_entries
ADD COLUMN IF NOT EXISTS paid_amount numeric DEFAULT 0;

-- Add paid_by to track who made the payment
ALTER TABLE money_entries
ADD COLUMN IF NOT EXISTS paid_by text;

-- Add payment_confirmed to track receiver confirmation
ALTER TABLE money_entries
ADD COLUMN IF NOT EXISTS payment_confirmed boolean DEFAULT false;

-- Wipe all existing approved/settled/confirming entries to reset settlement history
DELETE FROM money_entries
WHERE request_status IN ('approved', 'settled');
