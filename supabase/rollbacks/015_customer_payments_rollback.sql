-- ============================================================
-- Rollback for Migration 015: Customer Payment Submissions
-- POULTRY HUB — Customer-Portal Payment Method Support
-- ============================================================
--
-- STATUS: UNAPPLIED (Local rollback script only)
-- SAFETY: Do NOT run against production database.
--
-- ROLLBACK AUDIT NOTES:
--   - Dropping public.customer_payment_submissions with CASCADE automatically drops
--     its indexes (idx_cps_order_id, idx_cps_customer_id, idx_cps_status, idx_cps_created_at,
--     idx_cps_one_active_per_order), constraints (cps_reference_required_for_digital),
--     and RLS policies (cps_select_scoped, cps_insert_own, cps_update_staff_admin, cps_delete_admin).
--   - Parent tables (customer_orders, customers, profiles) have NO inbound FK references
--     from other tables dependent on this table, so CASCADE does not affect them.
--   - Core operational ledger tables (egg_sales, payments, egg_inventory) are completely untouched.
-- ============================================================

BEGIN;

-- 1. Drop trigger
DROP TRIGGER IF EXISTS trg_cps_updated_at ON public.customer_payment_submissions;

-- 2. Drop table (cascades RLS policies, indexes, and constraints)
DROP TABLE IF EXISTS public.customer_payment_submissions CASCADE;

-- 3. Drop enums if no other objects depend on them
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'customer_payment_status') THEN
    DROP TYPE public.customer_payment_status;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'customer_payment_method') THEN
    DROP TYPE public.customer_payment_method;
  END IF;
END $$;

COMMIT;
