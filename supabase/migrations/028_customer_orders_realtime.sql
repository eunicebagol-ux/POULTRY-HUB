-- ============================================================
-- Migration 028: Add customer_orders to Supabase Realtime
-- POULTRY HUB — Customer Portal Live Order Updates
-- ============================================================
--
-- PURPOSE:
--   The customer portal notification component subscribes to postgres_changes
--   on BOTH customer_orders AND customer_order_notifications.
--
--   Migration 027 already added customer_order_notifications to the Realtime
--   publication. This migration adds customer_orders so that the subscription
--   on that table also fires when STAFF/ADMIN changes order status, giving the
--   component a second, independent notification path.
--
--   Without this migration the customer_orders subscription is silently dead.
--   The feature still works via the customer_order_notifications channel, but
--   adding customer_orders provides defence-in-depth for live updates.
--
-- SAFETY:
--   - Idempotent: wrapped in a DO block that silences the duplicate-table error.
--   - No schema changes; no new tables, policies, or functions.
--   - No existing policies are touched.
-- ============================================================

BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    -- Only add if not already a member of the publication
    IF NOT EXISTS (
      SELECT 1
      FROM   pg_publication_tables
      WHERE  pubname   = 'supabase_realtime'
        AND  schemaname = 'public'
        AND  tablename  = 'customer_orders'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_orders;
    END IF;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- Silently continue if publication does not exist or table already a member
  NULL;
END $$;

COMMIT;
