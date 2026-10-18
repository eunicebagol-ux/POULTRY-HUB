-- ============================================================
-- Migration 014: Customer Orders (Request-Only, No Inventory Deduction)
-- POULTRY HUB — Customer-Facing Egg Order Intake Tables
-- ============================================================
--
-- PURPOSE:
--   Introduces a dedicated customer_orders / customer_order_items table pair
--   so that approved CUSTOMER accounts can submit egg purchase requests
--   WITHOUT:
--     (a) prematurely creating a completed egg_sale record, or
--     (b) reducing physical egg_inventory stock.
--
-- WORKFLOW:
--   1. CUSTOMER submits an order -> status='PENDING', no stock deduction.
--   2. STAFF/ADMIN reviews -> changes status to CONFIRMED, PREPARING, READY.
--   3. STAFF/ADMIN fulfills -> calls record_egg_sale() to produce an actual
--      invoice and atomically deduct inventory.
--   4. Both order record and invoice record co-exist; order.sale_id is set
--      once fulfilled.
--
-- DEPENDENCIES:
--   * Migration 001 (customers table with UUID PK, egg_size/packaging_type enums)
--   * Migration 007 (profiles.id changed to TEXT referencing Clerk user IDs)
--   * Migration 012 (CUSTOMER role enum, customers.clerk_user_id FK,
--                    get_current_customer_id(), is_staff_or_admin(), is_admin(),
--                    is_active_user())
--
-- SAFETY:
--   This migration does NOT touch egg_inventory, egg_sales, or
--   egg_inventory_transactions. It creates only NEW tables and NEW policies.
--
-- STATUS: UNAPPLIED — requires Migration 012 to be confirmed live first.
--         Do NOT run supabase db push until 012 is applied.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. ORDER STATUS ENUM
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'customer_order_status') THEN
    CREATE TYPE public.customer_order_status AS ENUM (
      'PENDING',
      'CONFIRMED',
      'PREPARING',
      'READY',
      'COMPLETED',
      'CANCELLED'
    );
  END IF;
END $$;

-- ============================================================
-- 2. CUSTOMER ORDERS TABLE (ORDER INTAKE HEADER)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.customer_orders (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Ownership: always resolved server-side via customers.clerk_user_id -> customers.id
  customer_id         UUID        NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  -- Status lifecycle; customers may only submit PENDING; transitions beyond that
  -- are exclusively performed by STAFF/ADMIN.
  status              public.customer_order_status NOT NULL DEFAULT 'PENDING',
  -- Customer-requested delivery or pickup date (informational only)
  requested_date      DATE,
  -- Set by STAFF/ADMIN once the order is fulfilled via record_egg_sale()
  sale_id             UUID        REFERENCES public.egg_sales(id) ON DELETE SET NULL,
  -- Customer delivery notes / special instructions
  notes               TEXT        CHECK (char_length(notes) <= 1000),
  -- STAFF/ADMIN internal notes — NOT exposed to customer portal UI
  admin_notes         TEXT        CHECK (char_length(admin_notes) <= 1000),
  -- Reason required when status transitions to CANCELLED
  cancellation_reason TEXT        CHECK (char_length(cancellation_reason) <= 500),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. CUSTOMER ORDER ITEMS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.customer_order_items (
  id                UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          UUID              NOT NULL
                      REFERENCES public.customer_orders(id) ON DELETE CASCADE,
  size              public.egg_size   NOT NULL,
  packaging         public.packaging_type NOT NULL,
  package_quantity  INTEGER           NOT NULL CHECK (package_quantity > 0 AND package_quantity <= 10000),
  -- Preview-only: pieces = package_quantity x packaging multiplier.
  -- Authoritative piece count is recalculated server-side at fulfillment.
  requested_pieces  INTEGER           NOT NULL CHECK (requested_pieces > 0),
  -- Price hint snapped from egg_price_catalog at order submission time.
  -- INFORMATIONAL ONLY. Authoritative unit_price is set by STAFF/ADMIN at fulfillment.
  quoted_unit_price NUMERIC(10,2)     NOT NULL CHECK (quoted_unit_price >= 0),
  -- No duplicate size+packaging within one order
  UNIQUE (order_id, size, packaging)
);

-- ============================================================
-- 4. PRODUCT PRICE CATALOG
-- ============================================================
-- Allows ADMIN to publish indicative reference prices visible to CUSTOMER.
-- These are display/hint prices ONLY. Fulfillment prices are set at invoice time.

CREATE TABLE IF NOT EXISTS public.egg_price_catalog (
  id              UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  size            public.egg_size   NOT NULL UNIQUE,
  -- Reference per-piece price; packaging price = price_per_piece * multiplier
  -- unless a specific packaging price is set below.
  price_per_piece NUMERIC(10,4)     NOT NULL CHECK (price_per_piece >= 0),
  -- Optional pre-set prices per packaging type (override per-piece calc if set)
  price_tray_30   NUMERIC(10,2),
  price_carton_12 NUMERIC(10,2),
  price_box_360   NUMERIC(10,2),
  is_available    BOOLEAN           NOT NULL DEFAULT false,
  display_order   INTEGER           NOT NULL DEFAULT 0,
  updated_by      TEXT              REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at      TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 5. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_customer_orders_customer_id
  ON public.customer_orders(customer_id);

CREATE INDEX IF NOT EXISTS idx_customer_orders_status
  ON public.customer_orders(status);

CREATE INDEX IF NOT EXISTS idx_customer_orders_created_at
  ON public.customer_orders(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_orders_sale_id
  ON public.customer_orders(sale_id)
  WHERE sale_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customer_order_items_order_id
  ON public.customer_order_items(order_id);

CREATE INDEX IF NOT EXISTS idx_egg_price_catalog_display_order
  ON public.egg_price_catalog(display_order, size);

-- ============================================================
-- 6. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.customer_orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.egg_price_catalog    ENABLE ROW LEVEL SECURITY;

-- ── customer_orders policies ────────────────────────────────

-- SELECT: STAFF/ADMIN see all rows; CUSTOMER sees only their own
CREATE POLICY customer_orders_select_scoped
  ON public.customer_orders FOR SELECT TO authenticated
  USING (
    public.is_staff_or_admin()
    OR customer_id = public.get_current_customer_id()
  );

-- INSERT: Approved CUSTOMER inserts their own order.
-- Application layer sets customer_id = get_current_customer_id() server-side.
-- RLS WITH CHECK enforces status = PENDING and no privileged fields.
CREATE POLICY customer_orders_insert_own
  ON public.customer_orders FOR INSERT TO authenticated
  WITH CHECK (
    customer_id = public.get_current_customer_id()
    AND status = 'PENDING'
    AND sale_id IS NULL
    AND admin_notes IS NULL
    AND cancellation_reason IS NULL
  );

-- UPDATE: Only STAFF/ADMIN can mutate orders (status transitions, link sale_id, etc.)
CREATE POLICY customer_orders_update_staff_admin
  ON public.customer_orders FOR UPDATE TO authenticated
  USING   (public.is_staff_or_admin())
  WITH CHECK (public.is_staff_or_admin());

-- DELETE: Hard delete reserved for ADMIN (prefer CANCELLED status)
CREATE POLICY customer_orders_delete_admin
  ON public.customer_orders FOR DELETE TO authenticated
  USING (public.is_admin());

-- ── customer_order_items policies ──────────────────────────

-- SELECT: mirrors customer_orders scoping
CREATE POLICY customer_order_items_select_scoped
  ON public.customer_order_items FOR SELECT TO authenticated
  USING (
    public.is_staff_or_admin()
    OR order_id IN (
      SELECT id FROM public.customer_orders
      WHERE customer_id = public.get_current_customer_id()
    )
  );

-- INSERT: Customer can insert items only for their own PENDING order
CREATE POLICY customer_order_items_insert_own_pending
  ON public.customer_order_items FOR INSERT TO authenticated
  WITH CHECK (
    order_id IN (
      SELECT id FROM public.customer_orders
      WHERE customer_id = public.get_current_customer_id()
        AND status = 'PENDING'
    )
  );

-- UPDATE/DELETE items: STAFF/ADMIN only
CREATE POLICY customer_order_items_update_staff_admin
  ON public.customer_order_items FOR UPDATE TO authenticated
  USING   (public.is_staff_or_admin())
  WITH CHECK (public.is_staff_or_admin());

CREATE POLICY customer_order_items_delete_staff_admin
  ON public.customer_order_items FOR DELETE TO authenticated
  USING (public.is_staff_or_admin());

-- ── egg_price_catalog policies ──────────────────────────────

-- SELECT: any active user (CUSTOMER, STAFF, ADMIN) can view the catalog
CREATE POLICY egg_price_catalog_select_active
  ON public.egg_price_catalog FOR SELECT TO authenticated
  USING (public.is_active_user());

-- INSERT / UPDATE / DELETE: ADMIN only
CREATE POLICY egg_price_catalog_insert_admin
  ON public.egg_price_catalog FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY egg_price_catalog_update_admin
  ON public.egg_price_catalog FOR UPDATE TO authenticated
  USING   (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY egg_price_catalog_delete_admin
  ON public.egg_price_catalog FOR DELETE TO authenticated
  USING (public.is_admin());

-- ============================================================
-- 7. TABLE GRANTS
-- ============================================================

-- Table privileges allow authenticated clients to execute queries, while
-- RLS policies above enforce granular role-based and row-level authorization.
GRANT SELECT, INSERT, UPDATE, DELETE     ON public.customer_orders      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE     ON public.customer_order_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE     ON public.egg_price_catalog    TO authenticated;

-- ============================================================
-- 8. UPDATED_AT TRIGGER
-- ============================================================

-- Re-use or create a shared updated_at trigger function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_customer_orders_updated_at ON public.customer_orders;
CREATE TRIGGER trg_customer_orders_updated_at
  BEFORE UPDATE ON public.customer_orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_egg_price_catalog_updated_at ON public.egg_price_catalog;
CREATE TRIGGER trg_egg_price_catalog_updated_at
  BEFORE UPDATE ON public.egg_price_catalog
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 9. DEFAULT PRICE CATALOG SEED
--    All sizes seeded with placeholder prices; is_available = false
--    by default. ADMIN must explicitly enable each size before customers
--    can see it in the catalog.
-- ============================================================

INSERT INTO public.egg_price_catalog (size, price_per_piece, is_available, display_order)
VALUES
  ('SMALL',       6.00,  false, 1),
  ('MEDIUM',      7.00,  false, 2),
  ('LARGE',       8.00,  false, 3),
  ('EXTRA_LARGE', 9.00,  false, 4),
  ('JUMBO',       10.00, false, 5),
  ('UNGRADED',    5.00,  false, 6)
ON CONFLICT (size) DO NOTHING;

COMMIT;
