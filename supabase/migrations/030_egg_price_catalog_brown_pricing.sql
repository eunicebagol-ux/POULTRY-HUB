-- ==============================================================================
-- POULTRY HUB — Migration 030: Separate Brown Egg Pricing in Price Catalog
--
-- 1. Adds egg_type ('WHITE' | 'BROWN') to public.egg_price_catalog.
-- 2. Backfills existing rows as 'WHITE' and enforces NOT NULL + CHECK constraint.
-- 3. Safely removes the existing size-only uniqueness rule on public.egg_price_catalog
--    without dropping unrelated constraints or indexes.
-- 4. Replaces it with compound uniqueness on `(size, egg_type)`.
-- 5. Preserves all existing White catalog rows and their pricing values.
-- 6. Seeds Brown egg prices for all six standard sizes with approved tray prices:
--      - SMALL:       per piece ₱6.00,  tray ₱190.00
--      - MEDIUM:      per piece ₱7.00,  tray ₱220.00
--      - LARGE:       per piece ₱8.00,  tray ₱250.00
--      - EXTRA_LARGE: per piece ₱9.00,  tray ₱270.00
--      - JUMBO:       per piece ₱10.00, tray ₱300.00
--      - UNGRADED:    per piece ₱5.00,  tray ₱150.00
-- 7. Inherits `is_available` from the corresponding White row (or false if missing).
-- 8. Safe & idempotent: ON CONFLICT (size, egg_type) DO NOTHING preserves existing
--    Brown rows on reruns.
-- ==============================================================================

-- 1. Add egg_type column with default 'WHITE'
ALTER TABLE public.egg_price_catalog
  ADD COLUMN IF NOT EXISTS egg_type TEXT DEFAULT 'WHITE';

-- 2. Backfill any existing NULL records safely
UPDATE public.egg_price_catalog
  SET egg_type = 'WHITE'
  WHERE egg_type IS NULL;

-- 3. Enforce NOT NULL on egg_type
ALTER TABLE public.egg_price_catalog
  ALTER COLUMN egg_type SET NOT NULL;

-- 4. Add validation constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.egg_price_catalog'::regclass
      AND conname = 'egg_price_catalog_egg_type_check'
  ) THEN
    ALTER TABLE public.egg_price_catalog
      ADD CONSTRAINT egg_price_catalog_egg_type_check
      CHECK (egg_type IN ('WHITE', 'BROWN'));
  END IF;
END $$;

-- 5. Safely drop any size-only unique constraint without touching unrelated constraints
--    Handles standard name 'egg_price_catalog_size_key' or any name assigned by PostgreSQL
DO $$
DECLARE
  v_conname TEXT;
  v_size_attnum INT2;
  v_idxname TEXT;
BEGIN
  -- Obtain attribute number of column 'size' on public.egg_price_catalog
  SELECT attnum INTO v_size_attnum
  FROM pg_attribute
  WHERE attrelid = 'public.egg_price_catalog'::regclass
    AND attname = 'size'
    AND NOT attisdropped;

  IF v_size_attnum IS NOT NULL THEN
    -- A. Drop any unique constraint that is strictly defined on only the 'size' column
    FOR v_conname IN
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'public.egg_price_catalog'::regclass
        AND contype = 'u'
        AND conkey = ARRAY[v_size_attnum]
    LOOP
      EXECUTE format('ALTER TABLE public.egg_price_catalog DROP CONSTRAINT IF EXISTS %I', v_conname);
    END LOOP;

    -- B. Also drop any standalone unique index strictly on 'size' (not backing a constraint)
    FOR v_idxname IN
      SELECT c.relname
      FROM pg_index i
      JOIN pg_class c ON c.oid = i.indexrelid
      WHERE i.indrelid = 'public.egg_price_catalog'::regclass
        AND i.indisunique = true
        AND i.indkey::smallint[] = ARRAY[v_size_attnum]
        AND NOT EXISTS (
          SELECT 1 FROM pg_constraint con WHERE con.conindid = i.indexrelid
        )
    LOOP
      EXECUTE format('DROP INDEX IF EXISTS public.%I', v_idxname);
    END LOOP;
  END IF;
END $$;

-- Explicitly ensure standard name is dropped if present
ALTER TABLE public.egg_price_catalog
  DROP CONSTRAINT IF EXISTS egg_price_catalog_size_key;

-- 6. Add compound unique constraint on (size, egg_type)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.egg_price_catalog'::regclass
      AND conname = 'egg_price_catalog_size_egg_type_key'
  ) THEN
    ALTER TABLE public.egg_price_catalog
      ADD CONSTRAINT egg_price_catalog_size_egg_type_key
      UNIQUE (size, egg_type);
  END IF;
END $$;

-- 7. Add compound index for display ordering and lookups
CREATE INDEX IF NOT EXISTS idx_egg_price_catalog_display_order_egg_type
  ON public.egg_price_catalog(display_order, size, egg_type);

-- 8. Seed Brown egg catalog entries with confirmed tray prices and per-piece rates.
--    Inherits `is_available` from the matching White row, defaulting to false if White row is absent.
--    Preserves existing Brown prices on reruns via ON CONFLICT DO NOTHING.
INSERT INTO public.egg_price_catalog (
  size,
  egg_type,
  price_per_piece,
  price_tray_30,
  price_carton_12,
  price_box_360,
  is_available,
  display_order
)
SELECT
  v.size,
  'BROWN',
  v.price_per_piece,
  v.price_tray_30,
  NULL,
  NULL,
  COALESCE(
    (
      SELECT w.is_available
      FROM public.egg_price_catalog w
      WHERE w.size = v.size AND w.egg_type = 'WHITE'
      LIMIT 1
    ),
    false
  ),
  v.display_order
FROM (
  VALUES
    ('SMALL'::public.egg_size,       6.00,  190.00, 1),
    ('MEDIUM'::public.egg_size,      7.00,  220.00, 2),
    ('LARGE'::public.egg_size,       8.00,  250.00, 3),
    ('EXTRA_LARGE'::public.egg_size, 9.00,  270.00, 4),
    ('JUMBO'::public.egg_size,       10.00, 300.00, 5),
    ('UNGRADED'::public.egg_size,    5.00,  150.00, 6)
) AS v(size, price_per_piece, price_tray_30, display_order)
ON CONFLICT (size, egg_type) DO NOTHING;

COMMENT ON COLUMN public.egg_price_catalog.egg_type IS
  'Egg shell color / type: WHITE or BROWN. Combined with size for catalog pricing.';
