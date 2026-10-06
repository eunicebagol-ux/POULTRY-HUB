-- Migration 007: Clerk Auth Integration (Native Third-Party Auth)
-- POULTRY HUB — Convert User Identity from auth.users (UUID) to Clerk (TEXT)
--
-- PURPOSE:
--   Migrates authentication identity handling from Supabase Auth (GoTrue/auth.users)
--   to Clerk's native Third-Party Authentication integration.
--
-- CRITICAL RULES & INVARIANTS:
--   1. Migrations 001–006 remain completely untouched and intact.
--   2. Canonical identity expression inside PostgreSQL is (auth.jwt() ->> 'sub').
--   3. profiles.id and all audit/caller identity columns become TEXT.
--   4. profiles table remains the application's sole authorization/RBAC source.
--   5. Security helper functions, atomic RPC procedures, and RLS policies remain active.
--   6. STAFF users cannot self-promote to ADMIN or alter their active status.

BEGIN;

-- ============================================================
-- 1. DROP OBSOLETE AUTH.USERS TRIGGER & FUNCTION
-- ============================================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- ============================================================
-- 2. DROP FOREIGN KEYS REFERENCING PROFILES(ID) AND AUTH.USERS
-- ============================================================

ALTER TABLE public.flocks                       DROP CONSTRAINT IF EXISTS flocks_created_by_fkey;
ALTER TABLE public.flock_mortality              DROP CONSTRAINT IF EXISTS flock_mortality_created_by_fkey;
ALTER TABLE public.flock_culling                DROP CONSTRAINT IF EXISTS flock_culling_created_by_fkey;
ALTER TABLE public.egg_production               DROP CONSTRAINT IF EXISTS egg_production_created_by_fkey;
ALTER TABLE public.egg_inventory_transactions   DROP CONSTRAINT IF EXISTS egg_inventory_transactions_created_by_fkey;
ALTER TABLE public.feed_inventory_transactions  DROP CONSTRAINT IF EXISTS feed_inventory_transactions_created_by_fkey;
ALTER TABLE public.feed_consumption             DROP CONSTRAINT IF EXISTS feed_consumption_created_by_fkey;
ALTER TABLE public.egg_sales                    DROP CONSTRAINT IF EXISTS egg_sales_created_by_fkey;
ALTER TABLE public.expenses                     DROP CONSTRAINT IF EXISTS expenses_created_by_fkey;
ALTER TABLE public.activity_logs                DROP CONSTRAINT IF EXISTS activity_logs_actor_id_fkey;
ALTER TABLE public.system_settings              DROP CONSTRAINT IF EXISTS system_settings_updated_by_fkey;

-- Drop FK on profiles.id referencing auth.users(id)
ALTER TABLE public.profiles                     DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- ============================================================
-- 2b. DROP RLS POLICIES DEPENDING ON ALTERED COLUMNS
-- ============================================================
-- PostgreSQL prevents altering column types that are referenced
-- by active RLS policy expressions. We drop all policies here
-- before altering column types and recreate them in section 6.

DROP POLICY IF EXISTS profiles_select_own_or_admin ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own_or_admin ON public.profiles;
DROP POLICY IF EXISTS flocks_select_active_users ON public.flocks;
DROP POLICY IF EXISTS flocks_insert_active_users ON public.flocks;
DROP POLICY IF EXISTS flocks_update_active_users ON public.flocks;
DROP POLICY IF EXISTS flocks_delete_admin_only ON public.flocks;
DROP POLICY IF EXISTS flock_mortality_select_active_users ON public.flock_mortality;
DROP POLICY IF EXISTS flock_culling_select_active_users ON public.flock_culling;
DROP POLICY IF EXISTS egg_production_select_active_users ON public.egg_production;
DROP POLICY IF EXISTS egg_production_sizes_select_active_users ON public.egg_production_sizes;
DROP POLICY IF EXISTS egg_inventory_select_active_users ON public.egg_inventory;
DROP POLICY IF EXISTS egg_inventory_transactions_select_active_users ON public.egg_inventory_transactions;
DROP POLICY IF EXISTS feed_inventory_select_active_users ON public.feed_inventory;
DROP POLICY IF EXISTS feed_inventory_transactions_select_active_users ON public.feed_inventory_transactions;
DROP POLICY IF EXISTS feed_consumption_select_active_users ON public.feed_consumption;
DROP POLICY IF EXISTS customers_select_active_users ON public.customers;
DROP POLICY IF EXISTS customers_insert_active_users ON public.customers;
DROP POLICY IF EXISTS customers_update_active_users ON public.customers;
DROP POLICY IF EXISTS customers_delete_admin_only ON public.customers;
DROP POLICY IF EXISTS suppliers_select_active_users ON public.suppliers;
DROP POLICY IF EXISTS suppliers_insert_active_users ON public.suppliers;
DROP POLICY IF EXISTS suppliers_update_active_users ON public.suppliers;
DROP POLICY IF EXISTS suppliers_delete_admin_only ON public.suppliers;
DROP POLICY IF EXISTS egg_sales_select_active_users ON public.egg_sales;
DROP POLICY IF EXISTS egg_sale_items_select_active_users ON public.egg_sale_items;
DROP POLICY IF EXISTS expenses_select_active_users ON public.expenses;
DROP POLICY IF EXISTS expenses_insert_active_users ON public.expenses;
DROP POLICY IF EXISTS expenses_update_admin_only ON public.expenses;
DROP POLICY IF EXISTS expenses_delete_admin_only ON public.expenses;
DROP POLICY IF EXISTS activity_logs_select_admin_only ON public.activity_logs;
DROP POLICY IF EXISTS system_settings_select_active_users ON public.system_settings;
DROP POLICY IF EXISTS system_settings_insert_admin_only ON public.system_settings;
DROP POLICY IF EXISTS system_settings_update_admin_only ON public.system_settings;
DROP POLICY IF EXISTS system_settings_delete_admin_only ON public.system_settings;

-- ============================================================
-- 3. ALTER COLUMN TYPES FROM UUID TO TEXT
-- ============================================================

ALTER TABLE public.profiles                     ALTER COLUMN id TYPE TEXT USING id::TEXT;
ALTER TABLE public.flocks                       ALTER COLUMN created_by TYPE TEXT USING created_by::TEXT;
ALTER TABLE public.flock_mortality              ALTER COLUMN created_by TYPE TEXT USING created_by::TEXT;
ALTER TABLE public.flock_culling                ALTER COLUMN created_by TYPE TEXT USING created_by::TEXT;
ALTER TABLE public.egg_production               ALTER COLUMN created_by TYPE TEXT USING created_by::TEXT;
ALTER TABLE public.egg_inventory_transactions   ALTER COLUMN created_by TYPE TEXT USING created_by::TEXT;
ALTER TABLE public.feed_inventory_transactions  ALTER COLUMN created_by TYPE TEXT USING created_by::TEXT;
ALTER TABLE public.feed_consumption             ALTER COLUMN created_by TYPE TEXT USING created_by::TEXT;
ALTER TABLE public.egg_sales                    ALTER COLUMN created_by TYPE TEXT USING created_by::TEXT;
ALTER TABLE public.expenses                     ALTER COLUMN created_by TYPE TEXT USING created_by::TEXT;
ALTER TABLE public.activity_logs                ALTER COLUMN actor_id TYPE TEXT USING actor_id::TEXT;
ALTER TABLE public.system_settings              ALTER COLUMN updated_by TYPE TEXT USING updated_by::TEXT;

-- ============================================================
-- 4. RE-CREATE FOREIGN KEYS TO PUBLIC.PROFILES(ID)
-- ============================================================

ALTER TABLE public.flocks                       ADD CONSTRAINT flocks_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.flock_mortality              ADD CONSTRAINT flock_mortality_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.flock_culling                ADD CONSTRAINT flock_culling_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.egg_production               ADD CONSTRAINT egg_production_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.egg_inventory_transactions   ADD CONSTRAINT egg_inventory_transactions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.feed_inventory_transactions  ADD CONSTRAINT feed_inventory_transactions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.feed_consumption             ADD CONSTRAINT feed_consumption_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.egg_sales                    ADD CONSTRAINT egg_sales_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.expenses                     ADD CONSTRAINT expenses_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.activity_logs                ADD CONSTRAINT activity_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.system_settings              ADD CONSTRAINT system_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ============================================================
-- 5. UPDATE SECURITY HELPER FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   public.profiles
    WHERE  id        = (auth.jwt() ->> 'sub')
    AND    is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   public.profiles
    WHERE  id        = (auth.jwt() ->> 'sub')
    AND    is_active = true
    AND    role      = 'ADMIN'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_staff_or_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   public.profiles
    WHERE  id        = (auth.jwt() ->> 'sub')
    AND    is_active = true
    AND    role      IN ('STAFF', 'ADMIN')
  );
$$;

CREATE OR REPLACE FUNCTION public.require_active_user()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (auth.jwt() ->> 'sub') IS NULL THEN
    RAISE EXCEPTION 'Authentication required: no authenticated session found.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NOT public.is_active_user() THEN
    RAISE EXCEPTION 'Access denied: your account is inactive or does not exist.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.require_admin()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (auth.jwt() ->> 'sub') IS NULL THEN
    RAISE EXCEPTION 'Authentication required: no authenticated session found.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: this operation requires the ADMIN role.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.is_active_user()    FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin()           FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_staff_or_admin()  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.require_active_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.require_admin()      FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_active_user()    TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin()           TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff_or_admin()  TO authenticated;
GRANT EXECUTE ON FUNCTION public.require_active_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.require_admin()      TO authenticated;

-- ============================================================
-- 6. RE-CREATE ALL TABLE RLS POLICIES
-- ============================================================

-- Table 1: profiles
CREATE POLICY profiles_select_own_or_admin
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id = (auth.jwt() ->> 'sub')
    OR public.is_admin()
  );

CREATE POLICY profiles_update_own_or_admin
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    id = (auth.jwt() ->> 'sub')
    OR public.is_admin()
  )
  WITH CHECK (
    public.is_admin()
    OR (
      id = (auth.jwt() ->> 'sub')
      AND role = 'STAFF'
      AND is_active = true
    )
  );

-- Table 2: flocks
CREATE POLICY flocks_select_active_users ON public.flocks FOR SELECT TO authenticated USING (public.is_active_user());
CREATE POLICY flocks_insert_active_users ON public.flocks FOR INSERT TO authenticated WITH CHECK (public.is_active_user());
CREATE POLICY flocks_update_active_users ON public.flocks FOR UPDATE TO authenticated USING (public.is_active_user()) WITH CHECK (public.is_active_user());
CREATE POLICY flocks_delete_admin_only  ON public.flocks FOR DELETE TO authenticated USING (public.is_admin());

-- Table 3: flock_mortality
CREATE POLICY flock_mortality_select_active_users ON public.flock_mortality FOR SELECT TO authenticated USING (public.is_active_user());

-- Table 4: flock_culling
CREATE POLICY flock_culling_select_active_users ON public.flock_culling FOR SELECT TO authenticated USING (public.is_active_user());

-- Table 5: egg_production
CREATE POLICY egg_production_select_active_users ON public.egg_production FOR SELECT TO authenticated USING (public.is_active_user());

-- Table 6: egg_production_sizes
CREATE POLICY egg_production_sizes_select_active_users ON public.egg_production_sizes FOR SELECT TO authenticated USING (public.is_active_user());

-- Table 7: egg_inventory
CREATE POLICY egg_inventory_select_active_users ON public.egg_inventory FOR SELECT TO authenticated USING (public.is_active_user());

-- Table 8: egg_inventory_transactions
CREATE POLICY egg_inventory_transactions_select_active_users ON public.egg_inventory_transactions FOR SELECT TO authenticated USING (public.is_active_user());

-- Table 9: feed_inventory
CREATE POLICY feed_inventory_select_active_users ON public.feed_inventory FOR SELECT TO authenticated USING (public.is_active_user());

-- Table 10: feed_inventory_transactions
CREATE POLICY feed_inventory_transactions_select_active_users ON public.feed_inventory_transactions FOR SELECT TO authenticated USING (public.is_active_user());

-- Table 11: feed_consumption
CREATE POLICY feed_consumption_select_active_users ON public.feed_consumption FOR SELECT TO authenticated USING (public.is_active_user());

-- Table 12: customers
CREATE POLICY customers_select_active_users ON public.customers FOR SELECT TO authenticated USING (public.is_active_user());
CREATE POLICY customers_insert_active_users ON public.customers FOR INSERT TO authenticated WITH CHECK (public.is_active_user());
CREATE POLICY customers_update_active_users ON public.customers FOR UPDATE TO authenticated USING (public.is_active_user()) WITH CHECK (public.is_active_user());
CREATE POLICY customers_delete_admin_only  ON public.customers FOR DELETE TO authenticated USING (public.is_admin());

-- Table 13: suppliers
CREATE POLICY suppliers_select_active_users ON public.suppliers FOR SELECT TO authenticated USING (public.is_active_user());
CREATE POLICY suppliers_insert_active_users ON public.suppliers FOR INSERT TO authenticated WITH CHECK (public.is_active_user());
CREATE POLICY suppliers_update_active_users ON public.suppliers FOR UPDATE TO authenticated USING (public.is_active_user()) WITH CHECK (public.is_active_user());
CREATE POLICY suppliers_delete_admin_only  ON public.suppliers FOR DELETE TO authenticated USING (public.is_admin());

-- Table 14: egg_sales
CREATE POLICY egg_sales_select_active_users ON public.egg_sales FOR SELECT TO authenticated USING (public.is_active_user());

-- Table 15: egg_sale_items
CREATE POLICY egg_sale_items_select_active_users ON public.egg_sale_items FOR SELECT TO authenticated USING (public.is_active_user());

-- Table 16: expenses
CREATE POLICY expenses_select_active_users ON public.expenses FOR SELECT TO authenticated USING (public.is_active_user());
CREATE POLICY expenses_insert_active_users ON public.expenses FOR INSERT TO authenticated WITH CHECK (public.is_active_user());
CREATE POLICY expenses_update_admin_only  ON public.expenses FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY expenses_delete_admin_only  ON public.expenses FOR DELETE TO authenticated USING (public.is_admin());

-- Table 17: activity_logs
CREATE POLICY activity_logs_select_admin_only ON public.activity_logs FOR SELECT TO authenticated USING (public.is_admin());

-- Table 18: system_settings
CREATE POLICY system_settings_select_active_users ON public.system_settings FOR SELECT TO authenticated USING (public.is_active_user());
CREATE POLICY system_settings_insert_admin_only ON public.system_settings FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY system_settings_update_admin_only ON public.system_settings FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY system_settings_delete_admin_only ON public.system_settings FOR DELETE TO authenticated USING (public.is_admin());

-- ============================================================
-- 7. UPDATE ATOMIC BUSINESS RPCS (CALLER ID = TEXT)
-- ============================================================

DROP FUNCTION IF EXISTS public.record_egg_production CASCADE;
DROP FUNCTION IF EXISTS public.record_egg_sale CASCADE;
DROP FUNCTION IF EXISTS public.record_feed_consumption CASCADE;
DROP FUNCTION IF EXISTS public.record_feed_stock_intake CASCADE;
DROP FUNCTION IF EXISTS public.adjust_egg_inventory CASCADE;
DROP FUNCTION IF EXISTS public.record_flock_mortality CASCADE;
DROP FUNCTION IF EXISTS public.record_flock_culling CASCADE;

-- RPC 1 — record_egg_production
CREATE OR REPLACE FUNCTION public.record_egg_production(
  p_flock_id        UUID,
  p_production_date DATE,
  p_collection_shift TEXT,
  p_total_eggs      INTEGER,
  p_good_eggs       INTEGER,
  p_damaged_eggs    INTEGER,
  p_cracked_eggs    INTEGER,
  p_notes           TEXT,
  p_sizes           JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id       TEXT;
  v_production_id   UUID;
  v_size_total      INTEGER := 0;
  v_item            JSONB;
  v_size_val        egg_size;
  v_qty             INTEGER;
BEGIN
  PERFORM public.require_active_user();
  v_caller_id := (auth.jwt() ->> 'sub');

  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: missing user identity.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_flock_id IS NULL THEN
    RAISE EXCEPTION 'flock_id is required.' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_production_date IS NULL THEN
    RAISE EXCEPTION 'production_date is required.' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_total_eggs   < 0 THEN RAISE EXCEPTION 'total_eggs cannot be negative.'   USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF p_good_eggs    < 0 THEN RAISE EXCEPTION 'good_eggs cannot be negative.'    USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF p_damaged_eggs < 0 THEN RAISE EXCEPTION 'damaged_eggs cannot be negative.' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF p_cracked_eggs < 0 THEN RAISE EXCEPTION 'cracked_eggs cannot be negative.' USING ERRCODE = 'invalid_parameter_value'; END IF;

  IF p_total_eggs <> p_good_eggs + p_damaged_eggs + p_cracked_eggs THEN
    RAISE EXCEPTION 'total_eggs must equal good_eggs + damaged_eggs + cracked_eggs.'
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_sizes IS NULL OR jsonb_array_length(p_sizes) = 0 THEN
    RAISE EXCEPTION 'At least one egg size breakdown entry is required.'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  PERFORM id FROM public.flocks WHERE id = p_flock_id FOR UPDATE;

  IF NOT EXISTS (
    SELECT 1 FROM public.flocks WHERE id = p_flock_id AND status = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'Flock % does not exist or is not ACTIVE.', p_flock_id
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_sizes) LOOP
    v_size_val := (v_item->>'size')::egg_size;
    v_qty      := (v_item->>'quantity')::INTEGER;
    IF v_qty < 0 THEN
      RAISE EXCEPTION 'Egg quantity for size % cannot be negative.', v_size_val
        USING ERRCODE = 'invalid_parameter_value';
    END IF;
    v_size_total := v_size_total + v_qty;
  END LOOP;

  IF v_size_total <> p_good_eggs THEN
    RAISE EXCEPTION 'Sum of egg sizes (%) does not equal good_eggs (%).', v_size_total, p_good_eggs
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.egg_production (
    flock_id, production_date, collection_shift,
    total_eggs, good_eggs, damaged_eggs, cracked_eggs,
    notes, created_by
  ) VALUES (
    p_flock_id, p_production_date, p_collection_shift,
    p_total_eggs, p_good_eggs, p_damaged_eggs, p_cracked_eggs,
    p_notes, v_caller_id
  ) RETURNING id INTO v_production_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_sizes) LOOP
    v_size_val := (v_item->>'size')::egg_size;
    v_qty      := (v_item->>'quantity')::INTEGER;
    IF v_qty > 0 THEN
      INSERT INTO public.egg_production_sizes (production_id, size, quantity)
      VALUES (v_production_id, v_size_val, v_qty);

      PERFORM id FROM public.egg_inventory WHERE size = v_size_val FOR UPDATE;

      UPDATE public.egg_inventory
      SET stock_pieces = stock_pieces + v_qty, updated_at = NOW()
      WHERE size = v_size_val;

      INSERT INTO public.egg_inventory_transactions (
        size, quantity, transaction_type, reference_id, notes, created_by
      ) VALUES (
        v_size_val, v_qty, 'PRODUCTION', v_production_id,
        'Production collection entry', v_caller_id
      );
    END IF;
  END LOOP;

  INSERT INTO public.activity_logs (actor_id, action, entity_table, entity_id, metadata)
  VALUES (
    v_caller_id, 'RECORD_EGG_PRODUCTION', 'egg_production', v_production_id,
    jsonb_build_object(
      'flock_id', p_flock_id,
      'production_date', p_production_date,
      'total_eggs', p_total_eggs,
      'good_eggs', p_good_eggs
    )
  );

  RETURN v_production_id;
END;
$$;

-- RPC 2 — record_egg_sale
CREATE OR REPLACE FUNCTION public.record_egg_sale(
  p_customer_id    UUID,
  p_sale_date      DATE,
  p_invoice_number TEXT,
  p_discount       NUMERIC(12,2),
  p_notes          TEXT,
  p_items          JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id       TEXT;
  v_sale_id         UUID;
  v_subtotal        NUMERIC(12,2) := 0;
  v_total_amount    NUMERIC(12,2);
  v_discount_val    NUMERIC(12,2) := COALESCE(p_discount, 0);
  v_item            JSONB;
  v_size            egg_size;
  v_packaging       packaging_type;
  v_pkg_qty         INTEGER;
  v_unit_price      NUMERIC(10,2);
  v_pieces_per_pkg  INTEGER;
  v_line_pieces     INTEGER;
  v_line_total      NUMERIC(12,2);
  v_current_stock   INTEGER;
BEGIN
  PERFORM public.require_active_user();
  v_caller_id := (auth.jwt() ->> 'sub');

  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: missing user identity.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_customer_id IS NULL THEN RAISE EXCEPTION 'customer_id is required.' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF p_sale_date IS NULL THEN RAISE EXCEPTION 'sale_date is required.' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one sale item is required.' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_discount_val < 0 THEN RAISE EXCEPTION 'discount cannot be negative.' USING ERRCODE = 'invalid_parameter_value'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.customers WHERE id = p_customer_id AND is_active = true) THEN
    RAISE EXCEPTION 'Customer % does not exist or is not active.', p_customer_id USING ERRCODE = 'invalid_parameter_value';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_pkg_qty    := (v_item->>'package_quantity')::INTEGER;
    v_unit_price := (v_item->>'unit_price')::NUMERIC(10,2);
    IF v_pkg_qty <= 0 THEN RAISE EXCEPTION 'package_quantity must be > 0.' USING ERRCODE = 'invalid_parameter_value'; END IF;
    IF v_unit_price < 0 THEN RAISE EXCEPTION 'unit_price cannot be negative.' USING ERRCODE = 'invalid_parameter_value'; END IF;
    v_line_total := v_pkg_qty * v_unit_price;
    v_subtotal   := v_subtotal + v_line_total;
  END LOOP;

  IF v_discount_val > v_subtotal THEN
    RAISE EXCEPTION 'Discount (%) cannot exceed subtotal (%).', v_discount_val, v_subtotal USING ERRCODE = 'check_violation';
  END IF;
  v_total_amount := v_subtotal - v_discount_val;

  INSERT INTO public.egg_sales (
    customer_id, sale_date, invoice_number, subtotal, discount, total_amount, status, notes, created_by
  ) VALUES (
    p_customer_id, p_sale_date, p_invoice_number, v_subtotal, v_discount_val, v_total_amount, 'COMPLETED', p_notes, v_caller_id
  ) RETURNING id INTO v_sale_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_size       := (v_item->>'size')::egg_size;
    v_packaging  := (v_item->>'packaging')::packaging_type;
    v_pkg_qty    := (v_item->>'package_quantity')::INTEGER;
    v_unit_price := (v_item->>'unit_price')::NUMERIC(10,2);

    v_pieces_per_pkg := public._packaging_multiplier(v_packaging);
    v_line_pieces    := v_pkg_qty * v_pieces_per_pkg;
    v_line_total     := v_pkg_qty * v_unit_price;

    INSERT INTO public.egg_sale_items (
      sale_id, size, packaging, package_quantity, total_pieces, unit_price, line_total
    ) VALUES (
      v_sale_id, v_size, v_packaging, v_pkg_qty, v_line_pieces, v_unit_price, v_line_total
    );

    SELECT stock_pieces INTO v_current_stock FROM public.egg_inventory WHERE size = v_size FOR UPDATE;
    IF v_current_stock IS NULL OR v_current_stock < v_line_pieces THEN
      RAISE EXCEPTION 'Insufficient stock for size %. Available: %, Required: %.', v_size, COALESCE(v_current_stock, 0), v_line_pieces
        USING ERRCODE = 'check_violation';
    END IF;

    UPDATE public.egg_inventory SET stock_pieces = stock_pieces - v_line_pieces, updated_at = NOW() WHERE size = v_size;

    INSERT INTO public.egg_inventory_transactions (
      size, quantity, transaction_type, reference_id, notes, created_by
    ) VALUES (
      v_size, -v_line_pieces, 'SALE', v_sale_id, 'Egg sale line item', v_caller_id
    );
  END LOOP;

  INSERT INTO public.activity_logs (actor_id, action, entity_table, entity_id, metadata)
  VALUES (
    v_caller_id, 'RECORD_EGG_SALE', 'egg_sales', v_sale_id,
    jsonb_build_object('customer_id', p_customer_id, 'total_amount', v_total_amount)
  );

  RETURN v_sale_id;
END;
$$;

-- RPC 3 — record_feed_consumption
CREATE OR REPLACE FUNCTION public.record_feed_consumption(
  p_flock_id         UUID,
  p_feed_type        TEXT,
  p_quantity_kg      NUMERIC(10,2),
  p_consumption_date DATE,
  p_notes            TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id     TEXT;
  v_entry_id      UUID;
  v_current_stock NUMERIC(10,2);
BEGIN
  PERFORM public.require_active_user();
  v_caller_id := (auth.jwt() ->> 'sub');

  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: missing user identity.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_flock_id IS NULL THEN RAISE EXCEPTION 'flock_id is required.' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF p_feed_type IS NULL OR trim(p_feed_type) = '' THEN RAISE EXCEPTION 'feed_type is required.' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF p_quantity_kg IS NULL OR p_quantity_kg <= 0 THEN RAISE EXCEPTION 'quantity_kg must be > 0.' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF p_consumption_date IS NULL THEN RAISE EXCEPTION 'consumption_date is required.' USING ERRCODE = 'invalid_parameter_value'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.flocks WHERE id = p_flock_id AND status = 'ACTIVE') THEN
    RAISE EXCEPTION 'Flock % does not exist or is not ACTIVE.', p_flock_id USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT current_stock_kg INTO v_current_stock FROM public.feed_inventory WHERE feed_type = p_feed_type FOR UPDATE;
  IF v_current_stock IS NULL THEN
    RAISE EXCEPTION 'Feed type "%" does not exist in inventory.', p_feed_type USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_current_stock < p_quantity_kg THEN
    RAISE EXCEPTION 'Insufficient feed stock for %. Available: % kg, Required: % kg.', p_feed_type, v_current_stock, p_quantity_kg
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.feed_consumption (
    flock_id, feed_type, quantity_kg, consumption_date, notes, created_by
  ) VALUES (
    p_flock_id, p_feed_type, p_quantity_kg, p_consumption_date, p_notes, v_caller_id
  ) RETURNING id INTO v_entry_id;

  UPDATE public.feed_inventory SET current_stock_kg = current_stock_kg - p_quantity_kg, updated_at = NOW() WHERE feed_type = p_feed_type;

  INSERT INTO public.feed_inventory_transactions (
    feed_type, quantity_kg, transaction_type, reference_id, notes, created_by
  ) VALUES (
    p_feed_type, -p_quantity_kg, 'CONSUMPTION', v_entry_id, 'Flock feed consumption', v_caller_id
  );

  INSERT INTO public.activity_logs (actor_id, action, entity_table, entity_id, metadata)
  VALUES (
    v_caller_id, 'RECORD_FEED_CONSUMPTION', 'feed_consumption', v_entry_id,
    jsonb_build_object('flock_id', p_flock_id, 'feed_type', p_feed_type, 'quantity_kg', p_quantity_kg)
  );

  RETURN v_entry_id;
END;
$$;

-- RPC 4 — record_feed_stock_intake
CREATE OR REPLACE FUNCTION public.record_feed_stock_intake(
  p_feed_type        TEXT,
  p_quantity_kg      NUMERIC(10,2),
  p_cost_per_kg      NUMERIC(12,2),
  p_supplier_id      UUID,
  p_intake_date      DATE,
  p_notes            TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id   TEXT;
  v_tx_id       UUID;
  v_expense_id  UUID;
  v_total_cost  NUMERIC(12,2);
BEGIN
  PERFORM public.require_admin();
  v_caller_id := (auth.jwt() ->> 'sub');

  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: missing user identity.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_feed_type IS NULL OR trim(p_feed_type) = '' THEN RAISE EXCEPTION 'feed_type is required.' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF p_quantity_kg IS NULL OR p_quantity_kg <= 0 THEN RAISE EXCEPTION 'quantity_kg must be > 0.' USING ERRCODE = 'invalid_parameter_value'; END IF;

  INSERT INTO public.feed_inventory (feed_type, current_stock_kg, cost_per_kg)
  VALUES (p_feed_type, p_quantity_kg, COALESCE(p_cost_per_kg, 0))
  ON CONFLICT (feed_type) DO UPDATE
    SET current_stock_kg = feed_inventory.current_stock_kg + EXCLUDED.current_stock_kg,
        cost_per_kg      = CASE WHEN EXCLUDED.cost_per_kg > 0 THEN EXCLUDED.cost_per_kg ELSE feed_inventory.cost_per_kg END,
        updated_at       = NOW();

  INSERT INTO public.feed_inventory_transactions (
    feed_type, quantity_kg, transaction_type, reference_id, notes, created_by
  ) VALUES (
    p_feed_type, p_quantity_kg, 'STOCK_RECEIVED', NULL, COALESCE(p_notes, 'Feed stock intake'), v_caller_id
  ) RETURNING id INTO v_tx_id;

  IF p_cost_per_kg IS NOT NULL AND p_cost_per_kg > 0 THEN
    v_total_cost := p_quantity_kg * p_cost_per_kg;
    INSERT INTO public.expenses (
      expense_date, category, amount, description, supplier_id, created_by
    ) VALUES (
      COALESCE(p_intake_date, CURRENT_DATE), 'FEED_PURCHASE', v_total_cost,
      format('Feed intake: %s kg of %s @ %s/kg', p_quantity_kg, p_feed_type, p_cost_per_kg),
      p_supplier_id, v_caller_id
    ) RETURNING id INTO v_expense_id;

    UPDATE public.feed_inventory_transactions SET reference_id = v_expense_id WHERE id = v_tx_id;
  END IF;

  INSERT INTO public.activity_logs (actor_id, action, entity_table, entity_id, metadata)
  VALUES (
    v_caller_id, 'RECORD_FEED_STOCK_INTAKE', 'feed_inventory_transactions', v_tx_id,
    jsonb_build_object('feed_type', p_feed_type, 'quantity_kg', p_quantity_kg, 'cost_per_kg', p_cost_per_kg)
  );

  RETURN v_tx_id;
END;
$$;

-- RPC 5 — adjust_egg_inventory
CREATE OR REPLACE FUNCTION public.adjust_egg_inventory(
  p_size        egg_size,
  p_adjustment  INTEGER,
  p_reason      TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id      TEXT;
  v_tx_id          UUID;
  v_current_stock  INTEGER;
  v_new_stock      INTEGER;
BEGIN
  PERFORM public.require_admin();
  v_caller_id := (auth.jwt() ->> 'sub');

  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: missing user identity.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_size IS NULL THEN RAISE EXCEPTION 'size is required.' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF p_adjustment = 0 THEN RAISE EXCEPTION 'adjustment cannot be 0.' USING ERRCODE = 'invalid_parameter_value'; END IF;

  SELECT stock_pieces INTO v_current_stock FROM public.egg_inventory WHERE size = p_size FOR UPDATE;
  IF v_current_stock IS NULL THEN v_current_stock := 0; END IF;

  v_new_stock := v_current_stock + p_adjustment;
  IF v_new_stock < 0 THEN
    RAISE EXCEPTION 'Adjustment would result in negative stock (%) for size %.', v_new_stock, p_size
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.egg_inventory (size, stock_pieces) VALUES (p_size, v_new_stock)
  ON CONFLICT (size) DO UPDATE SET stock_pieces = EXCLUDED.stock_pieces, updated_at = NOW();

  INSERT INTO public.egg_inventory_transactions (
    size, quantity, transaction_type, notes, created_by
  ) VALUES (
    p_size, p_adjustment, 'ADJUSTMENT', COALESCE(p_reason, 'Manual stock adjustment'), v_caller_id
  ) RETURNING id INTO v_tx_id;

  INSERT INTO public.activity_logs (actor_id, action, entity_table, entity_id, metadata)
  VALUES (
    v_caller_id, 'ADJUST_EGG_INVENTORY', 'egg_inventory_transactions', v_tx_id,
    jsonb_build_object('size', p_size, 'adjustment', p_adjustment, 'reason', p_reason)
  );

  RETURN v_tx_id;
END;
$$;

-- RPC 6 — record_flock_mortality
CREATE OR REPLACE FUNCTION public.record_flock_mortality(
  p_flock_id   UUID,
  p_quantity   INTEGER,
  p_event_date DATE,
  p_reason     TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id          TEXT;
  v_record_id          UUID;
  v_current_bird_count INTEGER;
BEGIN
  PERFORM public.require_active_user();
  v_caller_id := (auth.jwt() ->> 'sub');

  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: missing user identity.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_flock_id IS NULL THEN RAISE EXCEPTION 'flock_id is required.' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 THEN RAISE EXCEPTION 'quantity must be > 0.' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF p_event_date IS NULL THEN RAISE EXCEPTION 'event_date is required.' USING ERRCODE = 'invalid_parameter_value'; END IF;

  SELECT current_bird_count INTO v_current_bird_count FROM public.flocks WHERE id = p_flock_id FOR UPDATE;
  IF v_current_bird_count IS NULL THEN RAISE EXCEPTION 'Flock % does not exist.', p_flock_id USING ERRCODE = 'invalid_parameter_value'; END IF;

  IF v_current_bird_count < p_quantity THEN
    RAISE EXCEPTION 'Mortality quantity (%) exceeds current bird count (%).', p_quantity, v_current_bird_count USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.flock_mortality (
    flock_id, quantity, event_date, reason, entry_record_type, created_by
  ) VALUES (
    p_flock_id, p_quantity, p_event_date, p_reason, 'STANDARD', v_caller_id
  ) RETURNING id INTO v_record_id;

  UPDATE public.flocks SET current_bird_count = current_bird_count - p_quantity, updated_at = NOW() WHERE id = p_flock_id;

  INSERT INTO public.activity_logs (actor_id, action, entity_table, entity_id, metadata)
  VALUES (
    v_caller_id, 'RECORD_FLOCK_MORTALITY', 'flock_mortality', v_record_id,
    jsonb_build_object('flock_id', p_flock_id, 'quantity', p_quantity, 'event_date', p_event_date)
  );

  RETURN v_record_id;
END;
$$;

-- RPC 7 — record_flock_culling
CREATE OR REPLACE FUNCTION public.record_flock_culling(
  p_flock_id   UUID,
  p_quantity   INTEGER,
  p_event_date DATE,
  p_reason     TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id          TEXT;
  v_record_id          UUID;
  v_current_bird_count INTEGER;
BEGIN
  PERFORM public.require_active_user();
  v_caller_id := (auth.jwt() ->> 'sub');

  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: missing user identity.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_flock_id IS NULL THEN RAISE EXCEPTION 'flock_id is required.' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 THEN RAISE EXCEPTION 'quantity must be > 0.' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF p_event_date IS NULL THEN RAISE EXCEPTION 'event_date is required.' USING ERRCODE = 'invalid_parameter_value'; END IF;

  SELECT current_bird_count INTO v_current_bird_count FROM public.flocks WHERE id = p_flock_id FOR UPDATE;
  IF v_current_bird_count IS NULL THEN RAISE EXCEPTION 'Flock % does not exist.', p_flock_id USING ERRCODE = 'invalid_parameter_value'; END IF;

  IF v_current_bird_count < p_quantity THEN
    RAISE EXCEPTION 'Culling quantity (%) exceeds current bird count (%).', p_quantity, v_current_bird_count USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.flock_culling (
    flock_id, quantity, event_date, reason, entry_record_type, created_by
  ) VALUES (
    p_flock_id, p_quantity, p_event_date, p_reason, 'STANDARD', v_caller_id
  ) RETURNING id INTO v_record_id;

  UPDATE public.flocks SET current_bird_count = current_bird_count - p_quantity, updated_at = NOW() WHERE id = p_flock_id;

  INSERT INTO public.activity_logs (actor_id, action, entity_table, entity_id, metadata)
  VALUES (
    v_caller_id, 'RECORD_FLOCK_CULLING', 'flock_culling', v_record_id,
    jsonb_build_object('flock_id', p_flock_id, 'quantity', p_quantity, 'event_date', p_event_date)
  );

  RETURN v_record_id;
END;
$$;

COMMIT;
