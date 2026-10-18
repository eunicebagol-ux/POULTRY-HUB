-- ============================================================
-- Proposed Corrected Rollback Script for Migration 012 (Customer Portal RBAC)
-- POULTRY HUB — Secure Rollback Baseline Restoring Staff/Admin Isolation
-- ============================================================
--
-- SECURITY AUDIT FINDING & RATIONALE:
-- The original 012_rollback.sql reverted policies and RPCs to `is_active_user()`
-- and `require_active_user()`. Because `is_active_user()` does not filter by role,
-- executing that rollback would grant active CUSTOMER users unrestricted read/write
-- access across all internal farm operational tables, sales, payments, and RPCs.
--
-- This corrected rollback script restores the true pre-012 RBAC baseline
-- (from Migrations 008b/010/011), locking all internal tables and procedures
-- strictly to `is_staff_or_admin()` and `require_staff_or_admin()`.
--
-- NON-REVERSIBLE ELEMENTS:
-- 1. In PostgreSQL, ALTER TYPE ... DROP VALUE is not supported.
--    The 'CUSTOMER' value added to public.user_role remains in the enum.
-- 2. customers.clerk_user_id column is NOT dropped to prevent destructive
--    loss of customer identity linkages.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. DROP IMMUTABILITY TRIGGER & HELPER FUNCTIONS
-- ------------------------------------------------------------

DROP TRIGGER IF EXISTS trg_enforce_profile_role_immutability ON public.profiles;
DROP FUNCTION IF EXISTS public.enforce_profile_role_immutability();
DROP FUNCTION IF EXISTS public.get_current_customer_id();

-- ------------------------------------------------------------
-- 2. RESTORE PROFILES UPDATE POLICY
-- ------------------------------------------------------------

DROP POLICY IF EXISTS profiles_update_own_or_admin ON public.profiles;

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

-- ------------------------------------------------------------
-- 3. RESTORE CUSTOMER & SALES POLICIES (STAFF/ADMIN ONLY BASELINE)
-- ------------------------------------------------------------

-- A. Table: public.customers
DROP POLICY IF EXISTS customers_select_scoped ON public.customers;
DROP POLICY IF EXISTS customers_select_staff_admin_or_own ON public.customers;
DROP POLICY IF EXISTS customers_select_active_users ON public.customers;
DROP POLICY IF EXISTS customers_select_staff_or_admin ON public.customers;
DROP POLICY IF EXISTS customers_insert_staff_or_admin ON public.customers;
DROP POLICY IF EXISTS customers_insert_active_users ON public.customers;
DROP POLICY IF EXISTS customers_update_staff_or_admin ON public.customers;
DROP POLICY IF EXISTS customers_update_active_users ON public.customers;

CREATE POLICY customers_select_staff_or_admin ON public.customers FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY customers_insert_staff_or_admin ON public.customers FOR INSERT TO authenticated WITH CHECK (public.is_staff_or_admin());
CREATE POLICY customers_update_staff_or_admin ON public.customers FOR UPDATE TO authenticated USING (public.is_staff_or_admin()) WITH CHECK (public.is_staff_or_admin());

-- B. Table: public.egg_sales
DROP POLICY IF EXISTS egg_sales_select_scoped ON public.egg_sales;
DROP POLICY IF EXISTS egg_sales_select_staff_admin_or_own ON public.egg_sales;
DROP POLICY IF EXISTS egg_sales_select_active_users ON public.egg_sales;
DROP POLICY IF EXISTS egg_sales_select_staff_or_admin ON public.egg_sales;

CREATE POLICY egg_sales_select_staff_or_admin ON public.egg_sales FOR SELECT TO authenticated USING (public.is_staff_or_admin());

-- C. Table: public.egg_sale_items
DROP POLICY IF EXISTS egg_sale_items_select_scoped ON public.egg_sale_items;
DROP POLICY IF EXISTS egg_sale_items_select_staff_admin_or_own ON public.egg_sale_items;
DROP POLICY IF EXISTS egg_sale_items_select_active_users ON public.egg_sale_items;
DROP POLICY IF EXISTS egg_sale_items_select_staff_or_admin ON public.egg_sale_items;

CREATE POLICY egg_sale_items_select_staff_or_admin ON public.egg_sale_items FOR SELECT TO authenticated USING (public.is_staff_or_admin());

-- D. Table: public.payments
DROP POLICY IF EXISTS payments_select_scoped ON public.payments;
DROP POLICY IF EXISTS payments_select_active_users ON public.payments;
DROP POLICY IF EXISTS payments_select_staff_or_admin ON public.payments;

CREATE POLICY payments_select_staff_or_admin ON public.payments FOR SELECT TO authenticated USING (public.is_staff_or_admin());

-- ------------------------------------------------------------
-- 4. RESTORE INTERNAL MODULE POLICIES (STAFF/ADMIN ONLY BASELINE)
-- ------------------------------------------------------------

-- Flocks
DROP POLICY IF EXISTS flocks_select_staff_or_admin ON public.flocks;
DROP POLICY IF EXISTS flocks_select_active_users ON public.flocks;
DROP POLICY IF EXISTS flocks_insert_staff_or_admin ON public.flocks;
DROP POLICY IF EXISTS flocks_insert_active_users ON public.flocks;
DROP POLICY IF EXISTS flocks_update_staff_or_admin ON public.flocks;
DROP POLICY IF EXISTS flocks_update_active_users ON public.flocks;

CREATE POLICY flocks_select_staff_or_admin ON public.flocks FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY flocks_insert_staff_or_admin ON public.flocks FOR INSERT TO authenticated WITH CHECK (public.is_staff_or_admin());
CREATE POLICY flocks_update_staff_or_admin ON public.flocks FOR UPDATE TO authenticated USING (public.is_staff_or_admin()) WITH CHECK (public.is_staff_or_admin());

-- Flock Mortality & Culling
DROP POLICY IF EXISTS flock_mortality_select_staff_or_admin ON public.flock_mortality;
DROP POLICY IF EXISTS flock_mortality_select_active_users ON public.flock_mortality;
DROP POLICY IF EXISTS flock_culling_select_staff_or_admin ON public.flock_culling;
DROP POLICY IF EXISTS flock_culling_select_active_users ON public.flock_culling;

CREATE POLICY flock_mortality_select_staff_or_admin ON public.flock_mortality FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY flock_culling_select_staff_or_admin ON public.flock_culling FOR SELECT TO authenticated USING (public.is_staff_or_admin());

-- Egg Production & Inventory
DROP POLICY IF EXISTS egg_production_select_staff_or_admin ON public.egg_production;
DROP POLICY IF EXISTS egg_production_select_active_users ON public.egg_production;
DROP POLICY IF EXISTS egg_production_sizes_select_staff_or_admin ON public.egg_production_sizes;
DROP POLICY IF EXISTS egg_production_sizes_select_active_users ON public.egg_production_sizes;
DROP POLICY IF EXISTS egg_inventory_select_staff_or_admin ON public.egg_inventory;
DROP POLICY IF EXISTS egg_inventory_select_active_users ON public.egg_inventory;
DROP POLICY IF EXISTS egg_inventory_transactions_select_staff_or_admin ON public.egg_inventory_transactions;
DROP POLICY IF EXISTS egg_inventory_transactions_select_active_users ON public.egg_inventory_transactions;

CREATE POLICY egg_production_select_staff_or_admin ON public.egg_production FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY egg_production_sizes_select_staff_or_admin ON public.egg_production_sizes FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY egg_inventory_select_staff_or_admin ON public.egg_inventory FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY egg_inventory_transactions_select_staff_or_admin ON public.egg_inventory_transactions FOR SELECT TO authenticated USING (public.is_staff_or_admin());

-- Feed Inventory & Consumption
DROP POLICY IF EXISTS feed_inventory_select_staff_or_admin ON public.feed_inventory;
DROP POLICY IF EXISTS feed_inventory_select_active_users ON public.feed_inventory;
DROP POLICY IF EXISTS feed_inventory_transactions_select_staff_or_admin ON public.feed_inventory_transactions;
DROP POLICY IF EXISTS feed_inventory_transactions_select_active_users ON public.feed_inventory_transactions;
DROP POLICY IF EXISTS feed_consumption_select_staff_or_admin ON public.feed_consumption;
DROP POLICY IF EXISTS feed_consumption_select_active_users ON public.feed_consumption;

CREATE POLICY feed_inventory_select_staff_or_admin ON public.feed_inventory FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY feed_inventory_transactions_select_staff_or_admin ON public.feed_inventory_transactions FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY feed_consumption_select_staff_or_admin ON public.feed_consumption FOR SELECT TO authenticated USING (public.is_staff_or_admin());

-- Suppliers & Expenses
DROP POLICY IF EXISTS suppliers_select_staff_or_admin ON public.suppliers;
DROP POLICY IF EXISTS suppliers_select_active_users ON public.suppliers;
DROP POLICY IF EXISTS suppliers_insert_staff_or_admin ON public.suppliers;
DROP POLICY IF EXISTS suppliers_insert_active_users ON public.suppliers;
DROP POLICY IF EXISTS suppliers_update_staff_or_admin ON public.suppliers;
DROP POLICY IF EXISTS suppliers_update_active_users ON public.suppliers;

CREATE POLICY suppliers_select_staff_or_admin ON public.suppliers FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY suppliers_insert_staff_or_admin ON public.suppliers FOR INSERT TO authenticated WITH CHECK (public.is_staff_or_admin());
CREATE POLICY suppliers_update_staff_or_admin ON public.suppliers FOR UPDATE TO authenticated USING (public.is_staff_or_admin()) WITH CHECK (public.is_staff_or_admin());

DROP POLICY IF EXISTS expenses_select_staff_or_admin ON public.expenses;
DROP POLICY IF EXISTS expenses_select_active_users ON public.expenses;
DROP POLICY IF EXISTS expenses_insert_staff_or_admin ON public.expenses;
DROP POLICY IF EXISTS expenses_insert_active_users ON public.expenses;

CREATE POLICY expenses_select_staff_or_admin ON public.expenses FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY expenses_insert_staff_or_admin ON public.expenses FOR INSERT TO authenticated WITH CHECK (public.is_staff_or_admin());

-- System Settings
DROP POLICY IF EXISTS system_settings_select_staff_or_admin ON public.system_settings;
DROP POLICY IF EXISTS system_settings_select_active_users ON public.system_settings;

CREATE POLICY system_settings_select_staff_or_admin ON public.system_settings FOR SELECT TO authenticated USING (public.is_staff_or_admin());

-- ------------------------------------------------------------
-- 5. RESTORE ATOMIC RPCS WITH STRICT REQUIRE_STAFF_OR_ADMIN()
-- ------------------------------------------------------------

-- RPC 1: record_egg_payment
CREATE OR REPLACE FUNCTION public.record_egg_payment(
  p_sale_id          UUID,
  p_amount           NUMERIC(12,2),
  p_payment_method   TEXT,
  p_payment_date     DATE,
  p_reference_number TEXT DEFAULT NULL,
  p_notes            TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id        TEXT;
  v_payment_id       UUID;
  v_sale_record      RECORD;
  v_total_paid_prior NUMERIC(12,2) := 0;
  v_total_paid_new   NUMERIC(12,2) := 0;
  v_remaining_bal    NUMERIC(12,2) := 0;
  v_new_status       TEXT;
  v_method_enum      public.payment_method;
BEGIN
  PERFORM public.require_staff_or_admin();
  v_caller_id := (auth.jwt() ->> 'sub');

  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: missing user identity.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_sale_id IS NULL THEN RAISE EXCEPTION 'sale_id is required.' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Payment amount must be greater than zero.' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF p_payment_date IS NULL THEN RAISE EXCEPTION 'payment_date is required.' USING ERRCODE = 'invalid_parameter_value'; END IF;

  BEGIN
    v_method_enum := p_payment_method::public.payment_method;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Invalid payment method: %. Must be CASH, BANK_TRANSFER, CHECK, or E_WALLET.', p_payment_method
      USING ERRCODE = 'invalid_parameter_value';
  END;

  SELECT id, total_amount, payment_status, customer_id, invoice_number
  INTO v_sale_record
  FROM public.egg_sales
  WHERE id = p_sale_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Egg sale with ID % does not exist.', p_sale_id USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF v_sale_record.payment_status = 'CANCELLED' THEN RAISE EXCEPTION 'Cannot record payment for a cancelled sale.' USING ERRCODE = 'check_violation'; END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_total_paid_prior FROM public.payments WHERE sale_id = p_sale_id;
  v_remaining_bal := v_sale_record.total_amount - v_total_paid_prior;

  IF v_remaining_bal <= 0 THEN RAISE EXCEPTION 'Sale is already fully paid. No balance remaining.' USING ERRCODE = 'check_violation'; END IF;
  IF p_amount > v_remaining_bal THEN
    RAISE EXCEPTION 'Payment amount (%) exceeds remaining balance (%). Overpayment is not permitted.', p_amount, v_remaining_bal
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.payments (sale_id, amount, payment_method, payment_date, reference_number, notes, recorded_by)
  VALUES (p_sale_id, p_amount, v_method_enum, p_payment_date, NULLIF(TRIM(p_reference_number), ''), NULLIF(TRIM(p_notes), ''), v_caller_id)
  RETURNING id INTO v_payment_id;

  v_total_paid_new := v_total_paid_prior + p_amount;
  IF v_total_paid_new >= v_sale_record.total_amount THEN v_new_status := 'PAID';
  ELSIF v_total_paid_new > 0 THEN v_new_status := 'PARTIAL';
  ELSE v_new_status := 'PENDING';
  END IF;

  UPDATE public.egg_sales SET payment_status = v_new_status, updated_at = NOW() WHERE id = p_sale_id;

  INSERT INTO public.activity_logs (actor_id, action, entity_table, entity_id, metadata)
  VALUES (
    v_caller_id, 'RECORD_PAYMENT', 'payments', v_payment_id,
    jsonb_build_object('sale_id', p_sale_id, 'amount', p_amount, 'payment_method', p_payment_method, 'payment_date', p_payment_date, 'previous_paid', v_total_paid_prior, 'total_paid', v_total_paid_new, 'remaining_balance', (v_sale_record.total_amount - v_total_paid_new), 'payment_status', v_new_status)
  );

  RETURN v_payment_id;
END;
$$;

-- RPC 2: record_egg_sale
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
  v_caller_id     TEXT;
  v_sale_id       UUID;
  v_item          JSONB;
  v_size          egg_size;
  v_packaging     packaging_type;
  v_pkg_qty       INTEGER;
  v_unit_price    NUMERIC(10,2);
  v_pieces_per    INTEGER;
  v_total_pieces  INTEGER;
  v_line_total    NUMERIC(12,2);
  v_subtotal      NUMERIC(12,2) := 0;
  v_total_amount  NUMERIC(12,2);
  v_curr_stock    INTEGER;
  v_cust_active   BOOLEAN;
  v_cust_exists   BOOLEAN;
BEGIN
  PERFORM public.require_staff_or_admin();
  v_caller_id := (auth.jwt() ->> 'sub');

  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: missing user identity.' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_customer_id IS NOT NULL THEN
    SELECT true, is_active INTO v_cust_exists, v_cust_active FROM public.customers WHERE id = p_customer_id;
    IF v_cust_exists IS NULL THEN RAISE EXCEPTION 'Customer with ID % does not exist.', p_customer_id USING ERRCODE = 'invalid_parameter_value'; END IF;
    IF NOT v_cust_active THEN RAISE EXCEPTION 'Customer % is inactive.', p_customer_id USING ERRCODE = 'check_violation'; END IF;
  END IF;

  IF p_sale_date IS NULL THEN RAISE EXCEPTION 'sale_date is required.' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF p_discount < 0 THEN RAISE EXCEPTION 'Discount cannot be negative.' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one sale line item is required.' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_size       := (v_item->>'size')::egg_size;
    v_packaging  := (v_item->>'packaging')::packaging_type;
    v_pkg_qty    := (v_item->>'package_quantity')::INTEGER;
    v_unit_price := (v_item->>'unit_price')::NUMERIC(10,2);

    IF v_pkg_qty <= 0 THEN RAISE EXCEPTION 'Package quantity must be greater than zero.' USING ERRCODE = 'invalid_parameter_value'; END IF;
    IF v_unit_price < 0 THEN RAISE EXCEPTION 'Unit price cannot be negative.' USING ERRCODE = 'invalid_parameter_value'; END IF;

    CASE v_packaging
      WHEN 'PIECE' THEN v_pieces_per := 1;
      WHEN 'TRAY'  THEN v_pieces_per := 30;
      WHEN 'CASE'  THEN v_pieces_per := 360;
      ELSE RAISE EXCEPTION 'Invalid packaging type: %.', v_packaging USING ERRCODE = 'invalid_parameter_value';
    END CASE;

    v_total_pieces := v_pkg_qty * v_pieces_per;
    SELECT stock_pieces INTO v_curr_stock FROM public.egg_inventory WHERE size = v_size FOR UPDATE;
    IF v_curr_stock IS NULL OR v_curr_stock < v_total_pieces THEN
      RAISE EXCEPTION 'Insufficient stock for size %. Requested: %, Available: %.', v_size, v_total_pieces, COALESCE(v_curr_stock, 0)
        USING ERRCODE = 'check_violation';
    END IF;

    v_line_total := v_pkg_qty * v_unit_price;
    v_subtotal   := v_subtotal + v_line_total;
  END LOOP;

  IF p_discount > v_subtotal THEN
    RAISE EXCEPTION 'Discount (%) cannot exceed subtotal (%).', p_discount, v_subtotal USING ERRCODE = 'check_violation';
  END IF;

  v_total_amount := v_subtotal - p_discount;

  INSERT INTO public.egg_sales (
    customer_id, sale_date, invoice_number, subtotal, discount, total_amount, status, payment_status, notes, created_by
  ) VALUES (
    p_customer_id, p_sale_date, NULLIF(TRIM(p_invoice_number), ''), v_subtotal, p_discount, v_total_amount, 'COMPLETED', 'PENDING', p_notes, v_caller_id
  ) RETURNING id INTO v_sale_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_size       := (v_item->>'size')::egg_size;
    v_packaging  := (v_item->>'packaging')::packaging_type;
    v_pkg_qty    := (v_item->>'package_quantity')::INTEGER;
    v_unit_price := (v_item->>'unit_price')::NUMERIC(10,2);
    CASE v_packaging WHEN 'PIECE' THEN v_pieces_per := 1; WHEN 'TRAY' THEN v_pieces_per := 30; WHEN 'CASE' THEN v_pieces_per := 360; END CASE;
    v_total_pieces := v_pkg_qty * v_pieces_per;
    v_line_total   := v_pkg_qty * v_unit_price;

    INSERT INTO public.egg_sale_items (sale_id, size, packaging, package_quantity, total_pieces, unit_price, line_total)
    VALUES (v_sale_id, v_size, v_packaging, v_pkg_qty, v_total_pieces, v_unit_price, v_line_total);

    UPDATE public.egg_inventory SET stock_pieces = stock_pieces - v_total_pieces, updated_at = NOW() WHERE size = v_size;

    INSERT INTO public.egg_inventory_transactions (size, quantity, transaction_type, reference_id, notes, created_by)
    VALUES (v_size, -v_total_pieces, 'SALE', v_sale_id, 'Egg sale invoice ' || COALESCE(p_invoice_number, v_sale_id::TEXT), v_caller_id);
  END LOOP;

  INSERT INTO public.activity_logs (actor_id, action, entity_table, entity_id, metadata)
  VALUES (
    v_caller_id, 'RECORD_EGG_SALE', 'egg_sales', v_sale_id,
    jsonb_build_object('customer_id', p_customer_id, 'sale_date', p_sale_date, 'invoice_number', p_invoice_number, 'total_amount', v_total_amount)
  );

  RETURN v_sale_id;
END;
$$;

-- RPC 3: record_egg_production
CREATE OR REPLACE FUNCTION public.record_egg_production(
  p_flock_id         UUID,
  p_production_date  DATE,
  p_collection_shift TEXT,
  p_total_eggs       INTEGER,
  p_good_eggs        INTEGER,
  p_damaged_eggs     INTEGER,
  p_cracked_eggs     INTEGER,
  p_notes            TEXT,
  p_sizes            JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id      TEXT;
  v_production_id  UUID;
  v_size_total     INTEGER := 0;
  v_item           JSONB;
  v_size_val       egg_size;
  v_qty            INTEGER;
  v_flock_status   flock_status;
  v_flock_acq_date DATE;
BEGIN
  PERFORM public.require_staff_or_admin();
  v_caller_id := (auth.jwt() ->> 'sub');

  IF v_caller_id IS NULL THEN RAISE EXCEPTION 'Authentication required.' USING ERRCODE = 'insufficient_privilege'; END IF;
  IF p_flock_id IS NULL THEN RAISE EXCEPTION 'flock_id is required.' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF p_production_date IS NULL THEN RAISE EXCEPTION 'production_date is required.' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF p_total_eggs <> p_good_eggs + p_damaged_eggs + p_cracked_eggs THEN
    RAISE EXCEPTION 'total_eggs must equal good_eggs + damaged_eggs + cracked_eggs.' USING ERRCODE = 'check_violation';
  END IF;

  SELECT status, acquisition_date INTO v_flock_status, v_flock_acq_date FROM public.flocks WHERE id = p_flock_id FOR UPDATE;
  IF v_flock_status IS NULL OR v_flock_status <> 'ACTIVE' THEN RAISE EXCEPTION 'Flock does not exist or is not ACTIVE.' USING ERRCODE = 'invalid_parameter_value'; END IF;
  IF p_production_date < v_flock_acq_date THEN RAISE EXCEPTION 'Production date cannot be before acquisition date.' USING ERRCODE = 'check_violation'; END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_sizes) LOOP
    v_qty := (v_item->>'quantity')::INTEGER;
    v_size_total := v_size_total + v_qty;
  END LOOP;
  IF v_size_total <> p_good_eggs THEN RAISE EXCEPTION 'Sum of egg sizes must equal good_eggs.' USING ERRCODE = 'check_violation'; END IF;

  INSERT INTO public.egg_production (flock_id, production_date, collection_shift, total_eggs, good_eggs, damaged_eggs, cracked_eggs, notes, created_by)
  VALUES (p_flock_id, p_production_date, p_collection_shift, p_total_eggs, p_good_eggs, p_damaged_eggs, p_cracked_eggs, p_notes, v_caller_id)
  RETURNING id INTO v_production_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_sizes) LOOP
    v_size_val := (v_item->>'size')::egg_size;
    v_qty      := (v_item->>'quantity')::INTEGER;
    IF v_qty > 0 THEN
      INSERT INTO public.egg_production_sizes (production_id, size, quantity) VALUES (v_production_id, v_size_val, v_qty);
      UPDATE public.egg_inventory SET stock_pieces = stock_pieces + v_qty, updated_at = NOW() WHERE size = v_size_val;
      INSERT INTO public.egg_inventory_transactions (size, quantity, transaction_type, reference_id, notes, created_by)
      VALUES (v_size_val, v_qty, 'PRODUCTION', v_production_id, 'Production entry', v_caller_id);
    END IF;
  END LOOP;

  INSERT INTO public.activity_logs (actor_id, action, entity_table, entity_id, metadata)
  VALUES (v_caller_id, 'RECORD_EGG_PRODUCTION', 'egg_production', v_production_id, jsonb_build_object('flock_id', p_flock_id, 'total_eggs', p_total_eggs));

  RETURN v_production_id;
END;
$$;

-- RPC 4: record_feed_consumption
CREATE OR REPLACE FUNCTION public.record_feed_consumption(
  p_flock_id     UUID,
  p_feed_type    TEXT,
  p_quantity_kg  NUMERIC(10,2),
  p_date         DATE,
  p_notes        TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id      TEXT;
  v_consumption_id UUID;
  v_feed_type_enum feed_type;
  v_curr_stock     NUMERIC(10,2);
BEGIN
  PERFORM public.require_staff_or_admin();
  v_caller_id := (auth.jwt() ->> 'sub');
  IF v_caller_id IS NULL THEN RAISE EXCEPTION 'Authentication required.' USING ERRCODE = 'insufficient_privilege'; END IF;
  IF p_quantity_kg <= 0 THEN RAISE EXCEPTION 'quantity_kg must be greater than zero.' USING ERRCODE = 'invalid_parameter_value'; END IF;
  v_feed_type_enum := p_feed_type::feed_type;

  SELECT current_stock_kg INTO v_curr_stock FROM public.feed_inventory WHERE feed_type = v_feed_type_enum FOR UPDATE;
  IF v_curr_stock IS NULL OR v_curr_stock < p_quantity_kg THEN RAISE EXCEPTION 'Insufficient feed stock.' USING ERRCODE = 'check_violation'; END IF;

  INSERT INTO public.feed_consumption (flock_id, feed_type, quantity_kg, consumption_date, notes, created_by)
  VALUES (p_flock_id, v_feed_type_enum, p_quantity_kg, p_date, p_notes, v_caller_id)
  RETURNING id INTO v_consumption_id;

  UPDATE public.feed_inventory SET current_stock_kg = current_stock_kg - p_quantity_kg, updated_at = NOW() WHERE feed_type = v_feed_type_enum;
  INSERT INTO public.feed_inventory_transactions (feed_type, quantity_kg, transaction_type, reference_id, notes, created_by)
  VALUES (v_feed_type_enum, -p_quantity_kg, 'CONSUMPTION', v_consumption_id, 'Feed consumption entry', v_caller_id);

  INSERT INTO public.activity_logs (actor_id, action, entity_table, entity_id, metadata)
  VALUES (v_caller_id, 'RECORD_FEED_CONSUMPTION', 'feed_consumption', v_consumption_id, jsonb_build_object('flock_id', p_flock_id, 'quantity_kg', p_quantity_kg));

  RETURN v_consumption_id;
END;
$$;

-- RPC 5: record_flock_mortality
CREATE OR REPLACE FUNCTION public.record_flock_mortality(
  p_flock_id UUID,
  p_quantity INTEGER,
  p_date     DATE,
  p_notes    TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id     TEXT;
  v_mortality_id  UUID;
  v_curr_count    INTEGER;
BEGIN
  PERFORM public.require_staff_or_admin();
  v_caller_id := (auth.jwt() ->> 'sub');
  IF v_caller_id IS NULL THEN RAISE EXCEPTION 'Authentication required.' USING ERRCODE = 'insufficient_privilege'; END IF;
  IF p_quantity <= 0 THEN RAISE EXCEPTION 'Quantity must be greater than zero.' USING ERRCODE = 'invalid_parameter_value'; END IF;

  SELECT current_count INTO v_curr_count FROM public.flocks WHERE id = p_flock_id FOR UPDATE;
  IF v_curr_count IS NULL OR v_curr_count < p_quantity THEN RAISE EXCEPTION 'Mortality exceeds current flock count.' USING ERRCODE = 'check_violation'; END IF;

  INSERT INTO public.flock_mortality (flock_id, quantity, mortality_date, notes, created_by)
  VALUES (p_flock_id, p_quantity, p_date, p_notes, v_caller_id)
  RETURNING id INTO v_mortality_id;

  UPDATE public.flocks SET current_count = current_count - p_quantity, updated_at = NOW() WHERE id = p_flock_id;

  INSERT INTO public.activity_logs (actor_id, action, entity_table, entity_id, metadata)
  VALUES (v_caller_id, 'RECORD_MORTALITY', 'flock_mortality', v_mortality_id, jsonb_build_object('flock_id', p_flock_id, 'quantity', p_quantity));

  RETURN v_mortality_id;
END;
$$;

-- RPC 6: record_flock_culling
CREATE OR REPLACE FUNCTION public.record_flock_culling(
  p_flock_id UUID,
  p_quantity INTEGER,
  p_date     DATE,
  p_notes    TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id   TEXT;
  v_culling_id  UUID;
  v_curr_count  INTEGER;
BEGIN
  PERFORM public.require_staff_or_admin();
  v_caller_id := (auth.jwt() ->> 'sub');
  IF v_caller_id IS NULL THEN RAISE EXCEPTION 'Authentication required.' USING ERRCODE = 'insufficient_privilege'; END IF;
  IF p_quantity <= 0 THEN RAISE EXCEPTION 'Quantity must be greater than zero.' USING ERRCODE = 'invalid_parameter_value'; END IF;

  SELECT current_count INTO v_curr_count FROM public.flocks WHERE id = p_flock_id FOR UPDATE;
  IF v_curr_count IS NULL OR v_curr_count < p_quantity THEN RAISE EXCEPTION 'Culling exceeds current flock count.' USING ERRCODE = 'check_violation'; END IF;

  INSERT INTO public.flock_culling (flock_id, quantity, culling_date, notes, created_by)
  VALUES (p_flock_id, p_quantity, p_date, p_notes, v_caller_id)
  RETURNING id INTO v_culling_id;

  UPDATE public.flocks SET current_count = current_count - p_quantity, updated_at = NOW() WHERE id = p_flock_id;

  INSERT INTO public.activity_logs (actor_id, action, entity_table, entity_id, metadata)
  VALUES (v_caller_id, 'RECORD_CULLING', 'flock_culling', v_culling_id, jsonb_build_object('flock_id', p_flock_id, 'quantity', p_quantity));

  RETURN v_culling_id;
END;
$$;

-- Grants
REVOKE EXECUTE ON FUNCTION public.record_egg_payment(UUID, NUMERIC, TEXT, DATE, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_egg_sale(UUID, DATE, TEXT, NUMERIC, TEXT, JSONB)    FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_egg_production(UUID, DATE, TEXT, INTEGER, INTEGER, INTEGER, INTEGER, TEXT, JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_feed_consumption(UUID, TEXT, NUMERIC(10,2), DATE, TEXT)  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_flock_mortality(UUID, INTEGER, DATE, TEXT)         FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_flock_culling(UUID, INTEGER, DATE, TEXT)           FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.record_egg_payment(UUID, NUMERIC, TEXT, DATE, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_egg_sale(UUID, DATE, TEXT, NUMERIC, TEXT, JSONB)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_egg_production(UUID, DATE, TEXT, INTEGER, INTEGER, INTEGER, INTEGER, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_feed_consumption(UUID, TEXT, NUMERIC(10,2), DATE, TEXT)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_flock_mortality(UUID, INTEGER, DATE, TEXT)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_flock_culling(UUID, INTEGER, DATE, TEXT)           TO authenticated;

COMMIT;
