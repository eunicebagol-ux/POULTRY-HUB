-- ============================================================
-- Migration 021: Conditional Payment Methods & Payment Details
-- POULTRY HUB — Support CASH_ON_PICKUP and Extended Payment Submissions
-- ============================================================
--
-- PURPOSE:
--   1. Adds 'CASH_ON_PICKUP' to public.customer_payment_method enum.
--   2. Updates public.customer_payment_submissions constraint to allow
--      CASH_ON_PICKUP without requiring a digital reference number.
--   3. Adds columns for real payment submission details:
--      - payment_date (DATE)
--      - bank_name (TEXT)
--      - sender_name (TEXT)
--      - receipt_url (TEXT)
--
-- SAFETY & BACKWARD-COMPATIBILITY:
--   - Non-destructive: existing orders and payments remain completely valid.
--   - Idempotent: checks for existing columns and values.
-- ============================================================

-- 1. Add CASH_ON_PICKUP to customer_payment_method enum
ALTER TYPE public.customer_payment_method ADD VALUE IF NOT EXISTS 'CASH_ON_PICKUP';

-- 2. Add extended payment fields to customer_payment_submissions
ALTER TABLE public.customer_payment_submissions
  ADD COLUMN IF NOT EXISTS payment_date DATE NULL,
  ADD COLUMN IF NOT EXISTS bank_name TEXT NULL,
  ADD COLUMN IF NOT EXISTS sender_name TEXT NULL,
  ADD COLUMN IF NOT EXISTS receipt_url TEXT NULL;

-- 3. Update reference check constraint on customer_payment_submissions
--    Using ::text comparison for maximum transaction safety
ALTER TABLE public.customer_payment_submissions
  DROP CONSTRAINT IF EXISTS cps_reference_required_for_digital;

ALTER TABLE public.customer_payment_submissions
  ADD CONSTRAINT cps_reference_required_for_digital CHECK (
    payment_method::text IN ('CASH_ON_DELIVERY', 'CASH_ON_PICKUP')
    OR (reference_number IS NOT NULL AND trim(reference_number) <> '')
  );
