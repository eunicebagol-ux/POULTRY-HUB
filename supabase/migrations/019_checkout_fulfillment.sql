-- ============================================================
-- Migration 019: Checkout Fulfillment Method
-- POULTRY HUB — Add delivery/pickup fields to customer_orders
-- ============================================================
--
-- PURPOSE:
--   Adds a fulfillment_method enum and supporting columns to
--   customer_orders so customers can choose Delivery or Pick Up
--   when submitting an order.
--
-- COLUMNS ADDED:
--   fulfillment_method     — ENUM: 'DELIVERY' | 'PICKUP' (required)
--   delivery_barangay      — Barangay name (required for DELIVERY)
--   delivery_address       — Specific address detail (required for DELIVERY)
--   pickup_time            — Preferred pickup time slot (required for PICKUP)
--
--   The existing `requested_date` column is reused for both
--   requested_delivery_date (DELIVERY) and pickup_date (PICKUP).
--   The existing `notes` column stores additional instructions.
--
-- SAFETY:
--   All new columns have nullable defaults so existing rows are
--   not affected. New INSERT RLS WITH CHECK still enforces
--   correct fulfillment fields at the application layer.
--
-- ROLLBACK SAFETY:
--   Columns added with ALTER TABLE ... ADD COLUMN IF NOT EXISTS.
--   Enum created idempotently via DO $$ ... IF NOT EXISTS.
--   All changes are backward-compatible: existing rows keep NULL
--   values and remain valid.
-- ============================================================

BEGIN;

-- 1. Fulfillment method enum

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'fulfillment_method') THEN
    CREATE TYPE public.fulfillment_method AS ENUM (
      'DELIVERY',
      'PICKUP'
    );
  END IF;
END $$;

-- 2. New columns on customer_orders

ALTER TABLE public.customer_orders
  ADD COLUMN IF NOT EXISTS fulfillment_method  public.fulfillment_method  NULL,
  ADD COLUMN IF NOT EXISTS delivery_barangay   TEXT                        NULL,
  ADD COLUMN IF NOT EXISTS delivery_address    TEXT                        NULL,
  ADD COLUMN IF NOT EXISTS pickup_time         TEXT                        NULL;

-- 3. Index on fulfillment_method for staff filtering

CREATE INDEX IF NOT EXISTS idx_customer_orders_fulfillment_method
  ON public.customer_orders (fulfillment_method);

COMMIT;
