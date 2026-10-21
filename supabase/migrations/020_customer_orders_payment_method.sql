-- ============================================================
-- Migration 020: Customer Orders Payment Method
-- POULTRY HUB — Add payment_method column to customer_orders
-- ============================================================
--
-- PURPOSE:
--   Adds a payment_method column to customer_orders so that the
--   customer's selected checkout payment method (Cash on Delivery,
--   GCash, or Bank Transfer) is saved with the order intake header.
--
-- ENUM REUSE:
--   Reuses the existing public.customer_payment_method enum:
--   ('GCASH', 'BANK_TRANSFER', 'CASH_ON_DELIVERY')
--   created in Migration 015.
--
-- SAFETY & BACKWARD-COMPATIBILITY:
--   - Added as NULLable so existing orders remain valid.
--   - Idempotent ADD COLUMN IF NOT EXISTS.
--   - Creates an index on payment_method for filtering.
-- ============================================================

BEGIN;

-- 1. Ensure enum exists (in case 015 was partially applied or customized)
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

-- 2. Add payment_method column to customer_orders
ALTER TABLE public.customer_orders
  ADD COLUMN IF NOT EXISTS payment_method public.customer_payment_method NULL;

-- 3. Index for performance / staff filtering
CREATE INDEX IF NOT EXISTS idx_customer_orders_payment_method
  ON public.customer_orders (payment_method);

COMMIT;
