-- ==============================================================================
-- POULTRY HUB — Migration 029: Customer Order Items Egg Type Support
--
-- Adds optional/defaulted egg_type ('WHITE' | 'BROWN') to customer_order_items
-- so customers can choose between White Egg and Brown Egg for each product line.
--
-- Backward-compatible: Existing records without egg_type default to 'WHITE'.
-- Safe: Replaces 3-tuple UNIQUE (order_id, size, packaging) with
--       4-tuple UNIQUE (order_id, size, packaging, egg_type) so White and Brown
--       eggs of the same size and packaging can coexist in the same order.
-- ==============================================================================

-- 1. Add egg_type column with default 'WHITE'
ALTER TABLE public.customer_order_items
  ADD COLUMN IF NOT EXISTS egg_type TEXT DEFAULT 'WHITE';

-- 2. Add validation constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'customer_order_items_egg_type_check'
  ) THEN
    ALTER TABLE public.customer_order_items
      ADD CONSTRAINT customer_order_items_egg_type_check
      CHECK (egg_type IS NULL OR egg_type IN ('WHITE', 'BROWN'));
  END IF;
END $$;

-- 3. Backfill any existing NULL records safely
UPDATE public.customer_order_items
  SET egg_type = 'WHITE'
  WHERE egg_type IS NULL;

-- 4. Replace unique constraint to include egg_type
ALTER TABLE public.customer_order_items
  DROP CONSTRAINT IF EXISTS customer_order_items_order_id_size_packaging_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'customer_order_items_order_id_size_packaging_egg_type_key'
  ) THEN
    ALTER TABLE public.customer_order_items
      ADD CONSTRAINT customer_order_items_order_id_size_packaging_egg_type_key
      UNIQUE (order_id, size, packaging, egg_type);
  END IF;
END $$;

COMMENT ON COLUMN public.customer_order_items.egg_type IS
  'Customer selected egg shell color: WHITE (White Egg) or BROWN (Brown Egg). Defaults to WHITE.';
