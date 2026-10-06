-- Migration 008b: RBAC Hardening for CUSTOMER and DELIVERY Roles
-- POULTRY HUB — Comprehensive Database Security & Row-Level Authorization

BEGIN;

-- ============================================================
-- 1. ALTER CUSTOMERS TABLE
-- ============================================================

ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS clerk_user_id TEXT UNIQUE;

-- ============================================================
-- 2. SECURITY HELPER FUNCTIONS (CLERK AUTH PATTERN)
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

CREATE OR REPLACE FUNCTION public.is_customer()
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
    AND    role      = 'CUSTOMER'
  );
$$;

CREATE OR REPLACE FUNCTION public.require_staff_or_admin()
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

  IF NOT public.is_staff_or_admin() THEN
    RAISE EXCEPTION 'Access denied: operation requires STAFF or ADMIN role.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.is_customer()            FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.require_staff_or_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_customer()            TO authenticated;
GRANT EXECUTE ON FUNCTION public.require_staff_or_admin() TO authenticated;

-- ============================================================
-- 3. PROFILE SELF-PROMOTION IMMUTABILITY TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION public.enforce_profile_role_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- We allow the service role (where auth.jwt() is null or absent) to bypass this check.
  -- This lets backend webhooks or server actions provision profiles without restriction.
  IF (auth.jwt() ->> 'sub') IS NULL THEN
    RETURN NEW;
  END IF;

  -- If caller is not an ADMIN, block any alteration to role or is_active
  IF NOT public.is_admin() THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'Access denied: non-admin users cannot modify account role.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      RAISE EXCEPTION 'Access denied: non-admin users cannot modify active status.'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_profile_role_immutability ON public.profiles;
CREATE TRIGGER trg_enforce_profile_role_immutability
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_profile_role_immutability();

-- ============================================================
-- 4. DROP OLD POLICIES
-- ============================================================

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
-- 5. RECREATE STRICT HARDENED RLS POLICIES
-- ============================================================

-- Table 1: profiles
CREATE POLICY profiles_select_own_or_admin ON public.profiles FOR SELECT TO authenticated
  USING (id = (auth.jwt() ->> 'sub') OR public.is_admin());
CREATE POLICY profiles_update_own_or_admin ON public.profiles FOR UPDATE TO authenticated
  USING (id = (auth.jwt() ->> 'sub') OR public.is_admin())
  WITH CHECK (id = (auth.jwt() ->> 'sub') OR public.is_admin());

-- Table 2: flocks (STAFF/ADMIN only)
CREATE POLICY flocks_select_staff_or_admin ON public.flocks FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY flocks_insert_staff_or_admin ON public.flocks FOR INSERT TO authenticated WITH CHECK (public.is_staff_or_admin());
CREATE POLICY flocks_update_staff_or_admin ON public.flocks FOR UPDATE TO authenticated USING (public.is_staff_or_admin()) WITH CHECK (public.is_staff_or_admin());
CREATE POLICY flocks_delete_admin_only ON public.flocks FOR DELETE TO authenticated USING (public.is_admin());

-- Table 3: flock_mortality (STAFF/ADMIN only)
CREATE POLICY flock_mortality_select_staff_or_admin ON public.flock_mortality FOR SELECT TO authenticated USING (public.is_staff_or_admin());

-- Table 4: flock_culling (STAFF/ADMIN only)
CREATE POLICY flock_culling_select_staff_or_admin ON public.flock_culling FOR SELECT TO authenticated USING (public.is_staff_or_admin());

-- Table 5: egg_production (STAFF/ADMIN only)
CREATE POLICY egg_production_select_staff_or_admin ON public.egg_production FOR SELECT TO authenticated USING (public.is_staff_or_admin());

-- Table 6: egg_production_sizes (STAFF/ADMIN only)
CREATE POLICY egg_production_sizes_select_staff_or_admin ON public.egg_production_sizes FOR SELECT TO authenticated USING (public.is_staff_or_admin());

-- Table 7: egg_inventory (STAFF/ADMIN only)
CREATE POLICY egg_inventory_select_staff_or_admin ON public.egg_inventory FOR SELECT TO authenticated USING (public.is_staff_or_admin());

-- Table 8: egg_inventory_transactions (STAFF/ADMIN only)
CREATE POLICY egg_inventory_transactions_select_staff_or_admin ON public.egg_inventory_transactions FOR SELECT TO authenticated USING (public.is_staff_or_admin());

-- Table 9: feed_inventory (STAFF/ADMIN only)
CREATE POLICY feed_inventory_select_staff_or_admin ON public.feed_inventory FOR SELECT TO authenticated USING (public.is_staff_or_admin());

-- Table 10: feed_inventory_transactions (STAFF/ADMIN only)
CREATE POLICY feed_inventory_transactions_select_staff_or_admin ON public.feed_inventory_transactions FOR SELECT TO authenticated USING (public.is_staff_or_admin());

-- Table 11: feed_consumption (STAFF/ADMIN only)
CREATE POLICY feed_consumption_select_staff_or_admin ON public.feed_consumption FOR SELECT TO authenticated USING (public.is_staff_or_admin());

-- Table 12: customers (STAFF/ADMIN see all; CUSTOMER sees own record)
CREATE POLICY customers_select_staff_admin_or_own ON public.customers FOR SELECT TO authenticated
  USING (
    public.is_staff_or_admin()
    OR (clerk_user_id IS NOT NULL AND clerk_user_id = (auth.jwt() ->> 'sub'))
  );
CREATE POLICY customers_insert_staff_or_admin ON public.customers FOR INSERT TO authenticated WITH CHECK (public.is_staff_or_admin());
CREATE POLICY customers_update_staff_or_admin ON public.customers FOR UPDATE TO authenticated USING (public.is_staff_or_admin()) WITH CHECK (public.is_staff_or_admin());
CREATE POLICY customers_delete_admin_only ON public.customers FOR DELETE TO authenticated USING (public.is_admin());

-- Table 13: suppliers (STAFF/ADMIN only)
CREATE POLICY suppliers_select_staff_or_admin ON public.suppliers FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY suppliers_insert_staff_or_admin ON public.suppliers FOR INSERT TO authenticated WITH CHECK (public.is_staff_or_admin());
CREATE POLICY suppliers_update_staff_or_admin ON public.suppliers FOR UPDATE TO authenticated USING (public.is_staff_or_admin()) WITH CHECK (public.is_staff_or_admin());
CREATE POLICY suppliers_delete_admin_only ON public.suppliers FOR DELETE TO authenticated USING (public.is_admin());

-- Table 14: egg_sales (STAFF/ADMIN see all; CUSTOMER sees own sales)
CREATE POLICY egg_sales_select_staff_admin_or_own ON public.egg_sales FOR SELECT TO authenticated
  USING (
    public.is_staff_or_admin()
    OR (
      customer_id IN (
        SELECT id FROM public.customers WHERE clerk_user_id = (auth.jwt() ->> 'sub')
      )
    )
  );

-- Table 15: egg_sale_items (STAFF/ADMIN see all; CUSTOMER sees own sale items)
CREATE POLICY egg_sale_items_select_staff_admin_or_own ON public.egg_sale_items FOR SELECT TO authenticated
  USING (
    public.is_staff_or_admin()
    OR (
      sale_id IN (
        SELECT id FROM public.egg_sales WHERE customer_id IN (
          SELECT id FROM public.customers WHERE clerk_user_id = (auth.jwt() ->> 'sub')
        )
      )
    )
  );

-- Table 16: expenses (STAFF/ADMIN only)
CREATE POLICY expenses_select_staff_or_admin ON public.expenses FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY expenses_insert_staff_or_admin ON public.expenses FOR INSERT TO authenticated WITH CHECK (public.is_staff_or_admin());
CREATE POLICY expenses_update_admin_only ON public.expenses FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY expenses_delete_admin_only ON public.expenses FOR DELETE TO authenticated USING (public.is_admin());

-- Table 17: activity_logs (ADMIN only)
CREATE POLICY activity_logs_select_admin_only ON public.activity_logs FOR SELECT TO authenticated USING (public.is_admin());

-- Table 18: system_settings (STAFF/ADMIN only)
CREATE POLICY system_settings_select_staff_or_admin ON public.system_settings FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY system_settings_insert_admin_only ON public.system_settings FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY system_settings_update_admin_only ON public.system_settings FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY system_settings_delete_admin_only ON public.system_settings FOR DELETE TO authenticated USING (public.is_admin());


-- ============================================================
-- 6. REWRITE FIVE ATOMIC BUSINESS RPCS TO ENFORCE STAFF/ADMIN ROLE
-- ============================================================

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
  PERFORM public.require_staff_or_admin();
  v_caller_id := (auth.jwt() ->> 'sub');

  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: missing user identity.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_flock_id IS NULL THEN RAISE EXCEPTION 'flock_id is required.' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF p_production_date IS NULL THEN RAISE EXCEPTION 'production_date is required.' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF p_total_eggs   < 0 THEN RAISE EXCEPTION 'total_eggs cannot be negative.'   USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF p_good_eggs    < 0 THEN RAISE EXCEPTION 'good_eggs cannot be negative.'    USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF p_damaged_eggs < 0 THEN RAISE EXCEPTION 'damaged_eggs cannot be negative.' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF p_cracked_eggs < 0 THEN RAISE EXCEPTION 'cracked_eggs cannot be negative.' USING ERRCODE = 'invalid_parameter_value'; END IF;

  IF p_total_eggs <> p_good_eggs + p_damaged_eggs + p_cracked_eggs THEN
    RAISE EXCEPTION 'total_eggs must equal good_eggs + damaged_eggs + cracked_eggs.' USING ERRCODE = 'check_violation';
  END IF;

  IF p_sizes IS NULL OR jsonb_array_length(p_sizes) = 0 THEN
    RAISE EXCEPTION 'At least one egg size breakdown entry is required.' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  PERFORM id FROM public.flocks WHERE id = p_flock_id FOR UPDATE;

  IF NOT EXISTS (SELECT 1 FROM public.flocks WHERE id = p_flock_id AND status = 'ACTIVE') THEN
    RAISE EXCEPTION 'Flock % does not exist or is not ACTIVE.', p_flock_id USING ERRCODE = 'invalid_parameter_value';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_sizes) LOOP
    v_size_val := (v_item->>'size')::egg_size;
    v_qty      := (v_item->>'quantity')::INTEGER;
    IF v_qty < 0 THEN RAISE EXCEPTION 'Egg quantity for size % cannot be negative.', v_size_val USING ERRCODE = 'invalid_parameter_value'; END IF;
    v_size_total := v_size_total + v_qty;
  END LOOP;

  IF v_size_total <> p_good_eggs THEN
    RAISE EXCEPTION 'Sum of egg sizes (%) does not equal good_eggs (%).', v_size_total, p_good_eggs USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.egg_production (
    flock_id, production_date, collection_shift, total_eggs, good_eggs, damaged_eggs, cracked_eggs, notes, created_by
  ) VALUES (
    p_flock_id, p_production_date, p_collection_shift, p_total_eggs, p_good_eggs, p_damaged_eggs, p_cracked_eggs, p_notes, v_caller_id
  ) RETURNING id INTO v_production_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_sizes) LOOP
    v_size_val := (v_item->>'size')::egg_size;
    v_qty      := (v_item->>'quantity')::INTEGER;
    IF v_qty > 0 THEN
      INSERT INTO public.egg_production_sizes (production_id, size, quantity) VALUES (v_production_id, v_size_val, v_qty);
      PERFORM id FROM public.egg_inventory WHERE size = v_size_val FOR UPDATE;
      UPDATE public.egg_inventory SET stock_pieces = stock_pieces + v_qty, updated_at = NOW() WHERE size = v_size_val;
      INSERT INTO public.egg_inventory_transactions (
        size, quantity, transaction_type, reference_id, notes, created_by
      ) VALUES (
        v_size_val, v_qty, 'PRODUCTION', v_production_id, 'Production collection entry', v_caller_id
      );
    END IF;
  END LOOP;

  INSERT INTO public.activity_logs (actor_id, action, entity_table, entity_id, metadata)
  VALUES (
    v_caller_id, 'RECORD_EGG_PRODUCTION', 'egg_production', v_production_id,
    jsonb_build_object('flock_id', p_flock_id, 'production_date', p_production_date, 'total_eggs', p_total_eggs, 'good_eggs', p_good_eggs)
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
  PERFORM public.require_staff_or_admin();
  v_caller_id := (auth.jwt() ->> 'sub');

  IF v_caller_id IS NULL THEN RAISE EXCEPTION 'Authentication required: missing user identity.' USING ERRCODE = 'insufficient_privilege'; END IF;
  IF p_customer_id IS NULL THEN RAISE EXCEPTION 'customer_id is required.' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF p_sale_date IS NULL THEN RAISE EXCEPTION 'sale_date is required.' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'At least one sale item is required.' USING ERRCODE = 'invalid_parameter_value'; END IF;
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

  IF v_discount_val > v_subtotal THEN RAISE EXCEPTION 'Discount (%) cannot exceed subtotal (%).', v_discount_val, v_subtotal USING ERRCODE = 'check_violation'; END IF;
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

    INSERT INTO public.egg_sale_items (sale_id, size, packaging, package_quantity, total_pieces, unit_price, line_total)
    VALUES (v_sale_id, v_size, v_packaging, v_pkg_qty, v_line_pieces, v_unit_price, v_line_total);

    SELECT stock_pieces INTO v_current_stock FROM public.egg_inventory WHERE size = v_size FOR UPDATE;
    IF v_current_stock IS NULL OR v_current_stock < v_line_pieces THEN
      RAISE EXCEPTION 'Insufficient stock for size %. Available: %, Required: %.', v_size, COALESCE(v_current_stock, 0), v_line_pieces USING ERRCODE = 'check_violation';
    END IF;

    UPDATE public.egg_inventory SET stock_pieces = stock_pieces - v_line_pieces, updated_at = NOW() WHERE size = v_size;
    INSERT INTO public.egg_inventory_transactions (size, quantity, transaction_type, reference_id, notes, created_by)
    VALUES (v_size, -v_line_pieces, 'SALE', v_sale_id, 'Egg sale line item', v_caller_id);
  END LOOP;

  INSERT INTO public.activity_logs (actor_id, action, entity_table, entity_id, metadata)
  VALUES (v_caller_id, 'RECORD_EGG_SALE', 'egg_sales', v_sale_id, jsonb_build_object('customer_id', p_customer_id, 'total_amount', v_total_amount));

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
  PERFORM public.require_staff_or_admin();
  v_caller_id := (auth.jwt() ->> 'sub');

  IF v_caller_id IS NULL THEN RAISE EXCEPTION 'Authentication required: missing user identity.' USING ERRCODE = 'insufficient_privilege'; END IF;
  IF p_flock_id IS NULL THEN RAISE EXCEPTION 'flock_id is required.' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF p_feed_type IS NULL OR trim(p_feed_type) = '' THEN RAISE EXCEPTION 'feed_type is required.' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF p_quantity_kg IS NULL OR p_quantity_kg <= 0 THEN RAISE EXCEPTION 'quantity_kg must be > 0.' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF p_consumption_date IS NULL THEN RAISE EXCEPTION 'consumption_date is required.' USING ERRCODE = 'invalid_parameter_value'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.flocks WHERE id = p_flock_id AND status = 'ACTIVE') THEN
    RAISE EXCEPTION 'Flock % does not exist or is not ACTIVE.', p_flock_id USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT current_stock_kg INTO v_current_stock FROM public.feed_inventory WHERE feed_type = p_feed_type FOR UPDATE;
  IF v_current_stock IS NULL THEN RAISE EXCEPTION 'Feed type "%" does not exist in inventory.', p_feed_type USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF v_current_stock < p_quantity_kg THEN
    RAISE EXCEPTION 'Insufficient feed stock for %. Available: % kg, Required: % kg.', p_feed_type, v_current_stock, p_quantity_kg USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.feed_consumption (flock_id, feed_type, quantity_kg, consumption_date, notes, created_by)
  VALUES (p_flock_id, p_feed_type, p_quantity_kg, p_consumption_date, p_notes, v_caller_id)
  RETURNING id INTO v_entry_id;

  UPDATE public.feed_inventory SET current_stock_kg = current_stock_kg - p_quantity_kg, updated_at = NOW() WHERE feed_type = p_feed_type;
  INSERT INTO public.feed_inventory_transactions (feed_type, quantity_kg, transaction_type, reference_id, notes, created_by)
  VALUES (p_feed_type, -p_quantity_kg, 'CONSUMPTION', v_entry_id, 'Flock feed consumption', v_caller_id);

  INSERT INTO public.activity_logs (actor_id, action, entity_table, entity_id, metadata)
  VALUES (v_caller_id, 'RECORD_FEED_CONSUMPTION', 'feed_consumption', v_entry_id, jsonb_build_object('flock_id', p_flock_id, 'feed_type', p_feed_type, 'quantity_kg', p_quantity_kg));

  RETURN v_entry_id;
END;
$$;

-- RPC 4 — record_flock_mortality
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
  PERFORM public.require_staff_or_admin();
  v_caller_id := (auth.jwt() ->> 'sub');

  IF v_caller_id IS NULL THEN RAISE EXCEPTION 'Authentication required: missing user identity.' USING ERRCODE = 'insufficient_privilege'; END IF;
  IF p_flock_id IS NULL THEN RAISE EXCEPTION 'flock_id is required.' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 THEN RAISE EXCEPTION 'quantity must be > 0.' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF p_event_date IS NULL THEN RAISE EXCEPTION 'event_date is required.' USING ERRCODE = 'invalid_parameter_value'; END IF;

  SELECT current_bird_count INTO v_current_bird_count FROM public.flocks WHERE id = p_flock_id FOR UPDATE;
  IF v_current_bird_count IS NULL THEN RAISE EXCEPTION 'Flock % does not exist.', p_flock_id USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF v_current_bird_count < p_quantity THEN
    RAISE EXCEPTION 'Mortality quantity (%) exceeds current bird count (%).', p_quantity, v_current_bird_count USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.flock_mortality (flock_id, quantity, event_date, reason, entry_record_type, created_by)
  VALUES (p_flock_id, p_quantity, p_event_date, p_reason, 'STANDARD', v_caller_id)
  RETURNING id INTO v_record_id;

  UPDATE public.flocks SET current_bird_count = current_bird_count - p_quantity, updated_at = NOW() WHERE id = p_flock_id;
  INSERT INTO public.activity_logs (actor_id, action, entity_table, entity_id, metadata)
  VALUES (v_caller_id, 'RECORD_FLOCK_MORTALITY', 'flock_mortality', v_record_id, jsonb_build_object('flock_id', p_flock_id, 'quantity', p_quantity, 'event_date', p_event_date));

  RETURN v_record_id;
END;
$$;

-- RPC 5 — record_flock_culling
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
  PERFORM public.require_staff_or_admin();
  v_caller_id := (auth.jwt() ->> 'sub');

  IF v_caller_id IS NULL THEN RAISE EXCEPTION 'Authentication required: missing user identity.' USING ERRCODE = 'insufficient_privilege'; END IF;
  IF p_flock_id IS NULL THEN RAISE EXCEPTION 'flock_id is required.' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 THEN RAISE EXCEPTION 'quantity must be > 0.' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF p_event_date IS NULL THEN RAISE EXCEPTION 'event_date is required.' USING ERRCODE = 'invalid_parameter_value'; END IF;

  SELECT current_bird_count INTO v_current_bird_count FROM public.flocks WHERE id = p_flock_id FOR UPDATE;
  IF v_current_bird_count IS NULL THEN RAISE EXCEPTION 'Flock % does not exist.', p_flock_id USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF v_current_bird_count < p_quantity THEN
    RAISE EXCEPTION 'Culling quantity (%) exceeds current bird count (%).', p_quantity, v_current_bird_count USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.flock_culling (flock_id, quantity, event_date, reason, entry_record_type, created_by)
  VALUES (p_flock_id, p_quantity, p_event_date, p_reason, 'STANDARD', v_caller_id)
  RETURNING id INTO v_record_id;

  UPDATE public.flocks SET current_bird_count = current_bird_count - p_quantity, updated_at = NOW() WHERE id = p_flock_id;
  INSERT INTO public.activity_logs (actor_id, action, entity_table, entity_id, metadata)
  VALUES (v_caller_id, 'RECORD_FLOCK_CULLING', 'flock_culling', v_record_id, jsonb_build_object('flock_id', p_flock_id, 'quantity', p_quantity, 'event_date', p_event_date));

  RETURN v_record_id;
END;
$$;

COMMIT;
