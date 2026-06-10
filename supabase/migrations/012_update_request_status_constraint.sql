-- 012_update_request_status_constraint.sql
-- Drops the old check constraint on request_status and updates it to allow 'confirming' status

DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT constraint_name
        FROM information_schema.constraint_column_usage
        WHERE table_name = 'money_entries' AND column_name = 'request_status'
    LOOP
        EXECUTE 'ALTER TABLE public.money_entries DROP CONSTRAINT IF EXISTS ' || quote_ident(r.constraint_name);
    END LOOP;
END $$;

-- Re-add the check constraint with the new 'confirming' status allowed
ALTER TABLE public.money_entries
ADD CONSTRAINT money_entries_request_status_check
CHECK (request_status IN ('pending', 'approved', 'confirming', 'settled'));
