-- ============================================================
-- Migration 015: Customer Payment Submissions
-- POULTRY HUB — Customer-Portal Payment Method Support
-- ============================================================
--
-- PURPOSE:
--   Adds a customer_payment_submissions table that stores customer-initiated
--   payment proofs and delivery payment intents for customer_orders.
--
--   This is intentionally SEPARATE from the existing payments / egg_sales
--   payment ledger, which is an admin-controlled invoicing system. The two
--   domains serve different purposes:
--     * payments                     -> Admin records authoritative receipts against egg_sales
--     * customer_payment_submissions -> Customer submits payment evidence for review;
--                                       Staff/Admin verify before an invoice is ever created.
--
-- SUPPORTED PAYMENT METHODS (DEMO -- no live API):
--   1. GCASH          -- customer provides reference number
--   2. BANK_TRANSFER  -- customer provides reference number / bank details
--   3. CASH_ON_DELIVERY -- customer declares intent to pay on pickup/delivery
--
-- PAYMENT STATUS LIFECYCLE:
--   PENDING_SUBMISSION -> SUBMITTED -> VERIFIED (or REJECTED) -> (REFUNDED)
--   Customers submit; STAFF/ADMIN verify. Customers cannot self-verify.
--
-- DEPENDENCIES:
--   * Migration 001 (customers table)
--   * Migration 012 (CUSTOMER role, is_staff_or_admin(), is_admin(),
--                    is_active_user(), get_current_customer_id())
--   * Migration 014 (customer_orders table, set_updated_at() function)
--
-- SAFETY:
--   Does NOT touch egg_inventory, egg_sales, or the payments ledger.
--
-- STATUS: UNAPPLIED -- requires Migrations 012 and 014 to be applied first.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. CUSTOMER PAYMENT METHOD ENUM
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'customer_payment_method') THEN
    CREATE TYPE public.customer_payment_method AS ENUM (
      'GCASH',
      'BANK_TRANSFER',
      'CASH_ON_DELIVERY'
    );
  END IF;
END $$;

-- ============================================================
-- 2. CUSTOMER PAYMENT SUBMISSION STATUS ENUM
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'customer_payment_status') THEN
    CREATE TYPE public.customer_payment_status AS ENUM (
      'PENDING_SUBMISSION',
      'SUBMITTED',
      'VERIFIED',
      'REJECTED',
      'REFUNDED'
    );
  END IF;
END $$;

-- ============================================================
-- 3. CUSTOMER PAYMENT SUBMISSIONS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.customer_payment_submissions (
  id                  UUID                           PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            UUID                           NOT NULL
                        REFERENCES public.customer_orders(id) ON DELETE CASCADE,
  customer_id         UUID                           NOT NULL
                        REFERENCES public.customers(id) ON DELETE RESTRICT,
  payment_method      public.customer_payment_method NOT NULL,
  status              public.customer_payment_status NOT NULL DEFAULT 'PENDING_SUBMISSION',
  reference_number    TEXT                           CHECK (char_length(reference_number) <= 200),
  customer_notes      TEXT                           CHECK (char_length(customer_notes) <= 500),
  declared_amount     NUMERIC(12, 2)                 CHECK (declared_amount > 0),
  verified_by         TEXT                           REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_at         TIMESTAMPTZ,
  verification_notes  TEXT                           CHECK (char_length(verification_notes) <= 500),
  rejection_reason    TEXT                           CHECK (char_length(rejection_reason) <= 500),
  created_at          TIMESTAMPTZ                    NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ                    NOT NULL DEFAULT NOW(),
  -- Digital payment methods (GCASH, BANK_TRANSFER) require a non-empty reference number.
  -- CASH_ON_DELIVERY does not require a reference number.
  CONSTRAINT cps_reference_required_for_digital CHECK (
    payment_method = 'CASH_ON_DELIVERY'
    OR (reference_number IS NOT NULL AND trim(reference_number) <> '')
  )
);

-- ============================================================
-- 4. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_cps_order_id
  ON public.customer_payment_submissions(order_id);

CREATE INDEX IF NOT EXISTS idx_cps_customer_id
  ON public.customer_payment_submissions(customer_id);

CREATE INDEX IF NOT EXISTS idx_cps_status
  ON public.customer_payment_submissions(status);

CREATE INDEX IF NOT EXISTS idx_cps_created_at
  ON public.customer_payment_submissions(created_at DESC);

-- Concurrency protection: prevent duplicate active (non-REJECTED) submissions per order.
-- Permits resubmission only after an existing submission is REJECTED.
CREATE UNIQUE INDEX IF NOT EXISTS idx_cps_one_active_per_order
  ON public.customer_payment_submissions(order_id)
  WHERE status NOT IN ('REJECTED');

-- ============================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.customer_payment_submissions ENABLE ROW LEVEL SECURITY;

-- SELECT: STAFF/ADMIN see all rows; CUSTOMER sees only their own
CREATE POLICY cps_select_scoped
  ON public.customer_payment_submissions FOR SELECT TO authenticated
  USING (
    public.is_staff_or_admin()
    OR customer_id = public.get_current_customer_id()
  );

-- INSERT: Approved CUSTOMER inserts for their own orders.
-- RLS WITH CHECK ensures:
--   1. customer_id matches the authenticated customer (resolved via public.get_current_customer_id()).
--   2. order_id strictly references an order belonging to this same customer.
--   3. All staff verification fields are NULL on insert (cannot self-verify).
--   4. status must be 'SUBMITTED'.
-- NOTE: public.get_current_customer_id() is SECURITY DEFINER, preventing infinite RLS recursion.
CREATE POLICY cps_insert_own
  ON public.customer_payment_submissions FOR INSERT TO authenticated
  WITH CHECK (
    customer_id = public.get_current_customer_id()
    AND order_id IN (
      SELECT id FROM public.customer_orders
      WHERE customer_id = public.get_current_customer_id()
    )
    AND verified_by IS NULL
    AND verified_at IS NULL
    AND verification_notes IS NULL
    AND rejection_reason IS NULL
    AND status = 'SUBMITTED'
  );

-- UPDATE: STAFF/ADMIN only (verification/rejection)
CREATE POLICY cps_update_staff_admin
  ON public.customer_payment_submissions FOR UPDATE TO authenticated
  USING   (public.is_staff_or_admin())
  WITH CHECK (public.is_staff_or_admin());

-- DELETE: ADMIN only
CREATE POLICY cps_delete_admin
  ON public.customer_payment_submissions FOR DELETE TO authenticated
  USING (public.is_admin());

-- ============================================================
-- 6. TABLE GRANTS
-- ============================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_payment_submissions TO authenticated;

-- ============================================================
-- 7. UPDATED_AT TRIGGER
-- ============================================================

DROP TRIGGER IF EXISTS trg_cps_updated_at ON public.customer_payment_submissions;
CREATE TRIGGER trg_cps_updated_at
  BEFORE UPDATE ON public.customer_payment_submissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 8. COMMENTS
-- ============================================================

COMMENT ON TABLE public.customer_payment_submissions IS
  'Customer-submitted payment evidence for customer_orders. '
  'Separate from the payments ledger (egg_sales payments). '
  'Staff/Admin verify submissions before an official invoice is created.';

COMMENT ON COLUMN public.customer_payment_submissions.status IS
  'PENDING_SUBMISSION: method chosen, not yet submitted. '
  'SUBMITTED: customer provided proof/intent. '
  'VERIFIED: staff confirmed. '
  'REJECTED: staff rejected (reason in rejection_reason). '
  'REFUNDED: refund issued (future use).';

COMMENT ON COLUMN public.customer_payment_submissions.declared_amount IS
  'Amount declared by the customer for reference only. '
  'Authoritative invoice total is set by Staff/Admin via record_egg_sale().';

COMMIT;
