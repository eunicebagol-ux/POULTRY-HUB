-- ============================================================
-- Migration 022: GCash Payment Fields & Optional Reference
-- POULTRY HUB — Support GCash Number and Optional Pre-Payment Reference
-- ============================================================
--
-- PURPOSE:
--   1. Adds gcash_number (TEXT) to public.customer_payment_submissions.
--      (GCash Account Name is saved in the existing sender_name column).
--   2. Updates cps_reference_required_for_digital constraint to allow
--      GCASH payments without requiring an immediate reference number,
--      as customers may place their order before making the payment.
--
-- SAFETY & BACKWARD-COMPATIBILITY:
--   - Non-destructive: existing orders and payments remain completely valid.
--   - Idempotent: checks for existing columns and drops constraint before recreating.
-- ============================================================

-- 1. Add gcash_number to customer_payment_submissions
ALTER TABLE public.customer_payment_submissions
  ADD COLUMN IF NOT EXISTS gcash_number TEXT NULL;

COMMENT ON COLUMN public.customer_payment_submissions.gcash_number IS
  'Customer GCash mobile phone number for verification (e.g., 09171234567)';

-- 2. Update reference check constraint on customer_payment_submissions
--    Allows reference_number to be optional for CASH_ON_DELIVERY, CASH_ON_PICKUP, and GCASH.
--    BANK_TRANSFER still requires a reference number.
ALTER TABLE public.customer_payment_submissions
  DROP CONSTRAINT IF EXISTS cps_reference_required_for_digital;

ALTER TABLE public.customer_payment_submissions
  ADD CONSTRAINT cps_reference_required_for_digital CHECK (
    payment_method::text IN ('CASH_ON_DELIVERY', 'CASH_ON_PICKUP', 'GCASH')
    OR (reference_number IS NOT NULL AND trim(reference_number) <> '')
  );
