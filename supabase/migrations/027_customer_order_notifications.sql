-- ============================================================
-- Migration 027: Customer Order Status Notifications
-- POULTRY HUB — Customer Portal Order Status Notifications
-- ============================================================
--
-- PURPOSE:
--   Tracks real-time and persistent order status notifications for customers
--   so they receive instant feedback when their orders change state (e.g.,
--   Submitted -> Confirmed -> In Progress -> Ready -> Completed -> Cancelled).
--
-- CONSTRAINTS & GUARANTEES:
--   - Unique (order_id, status) prevents duplicate notifications for repeated
--     status updates on the same order.
--   - Dismissing an order's notification for one status (e.g., Confirmed)
--     does NOT dismiss future status changes (e.g., Ready for Pickup).
--   - RLS strictly isolates notifications: customers can only view and update
--     their own notifications.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.customer_order_notifications (
  id           UUID                     PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID                     NOT NULL REFERENCES public.customer_orders(id) ON DELETE CASCADE,
  customer_id  UUID                     NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  status       public.customer_order_status NOT NULL,
  title        TEXT                     NOT NULL CHECK (char_length(title) BETWEEN 1 AND 150),
  message      TEXT                     NOT NULL CHECK (char_length(message) BETWEEN 1 AND 500),
  is_dismissed BOOLEAN                  NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ              NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ              NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_customer_order_status_notif UNIQUE (order_id, status)
);

-- Indexes for performant lookup
CREATE INDEX IF NOT EXISTS idx_con_customer_lookup
  ON public.customer_order_notifications (customer_id, is_dismissed, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_con_order_id
  ON public.customer_order_notifications (order_id);

-- Row Level Security
ALTER TABLE public.customer_order_notifications ENABLE ROW LEVEL SECURITY;

-- SELECT: STAFF/ADMIN can read all; CUSTOMER can read only their own
DROP POLICY IF EXISTS con_select_scoped ON public.customer_order_notifications;
CREATE POLICY con_select_scoped
  ON public.customer_order_notifications FOR SELECT TO authenticated
  USING (
    public.is_staff_or_admin()
    OR customer_id = public.get_current_customer_id()
  );

-- INSERT: STAFF/ADMIN or service_role or CUSTOMER (for own submissions)
DROP POLICY IF EXISTS con_insert_scoped ON public.customer_order_notifications;
CREATE POLICY con_insert_scoped
  ON public.customer_order_notifications FOR INSERT TO authenticated
  WITH CHECK (
    public.is_staff_or_admin()
    OR customer_id = public.get_current_customer_id()
  );

-- UPDATE: CUSTOMER can dismiss their own notifications; STAFF/ADMIN can update
DROP POLICY IF EXISTS con_update_scoped ON public.customer_order_notifications;
CREATE POLICY con_update_scoped
  ON public.customer_order_notifications FOR UPDATE TO authenticated
  USING (
    public.is_staff_or_admin()
    OR customer_id = public.get_current_customer_id()
  )
  WITH CHECK (
    public.is_staff_or_admin()
    OR customer_id = public.get_current_customer_id()
  );

GRANT SELECT, INSERT, UPDATE ON public.customer_order_notifications TO authenticated;

-- Add to realtime publication if publication exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_order_notifications;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

COMMIT;
