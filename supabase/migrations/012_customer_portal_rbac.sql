-- ============================================================
-- Migration 012: Customer Portal RBAC & Multi-Tenant Isolation
-- POULTRY HUB — Introduce CUSTOMER Role, Linkage, Granular RLS & Complete RPCs
-- ============================================================
--
-- DEPLOYMENT ARCHITECTURE & TRANSACTION ORDER:
--
-- Step 1 (Auto-committed):
--   ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'CUSTOMER';
--   Must run in its own execution step outside any multi-statement
--   transaction block (PostgreSQL constraint: 25001).
--
-- Step 2 (Atomic Transaction):
--   BEGIN ... COMMIT block wrapping all schema alterations, helper functions,
--   triggers, strict RLS policies, and authoritative RPC definitions.
--
-- FAILURE BEHAVIOR:
-- - If Step 1 fails: No changes applied.
-- - If Step 2 fails: Full automatic rollback to pre-Step 2 state. The enum
--   value 'CUSTOMER' remains in public.user_role if Step 1 succeeded, which
--   is completely inert and harmless as existing code only checks 'STAFF' or 'ADMIN'.
-- ============================================================

-- ------------------------------------------------------------
-- STEP 1: USER ROLE ENUM (Applied in Migration 0119)
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- STEP 2: ATOMIC TRANSACTIONAL SCHEMA, RLS & RPC DEFINITIONS
-- ------------------------------------------------------------
BEGIN;

-- ------------------------------------------------------------
-- 2. ADD CUSTOMER ACCOUNT 1-TO-1 LINKAGE COLUMN
-- ------------------------------------------------------------

-- Add clerk_user_id column if not exists
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS clerk_user_id TEXT;

-- Enforce UNIQUE constraint safely
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'customers_clerk_user_id_key'
      AND conrelid = 'public.customers'::regclass
  ) THEN
    ALTER TABLE public.customers
      ADD CONSTRAINT customers_clerk_user_id_key UNIQUE (clerk_user_id);
  END IF;
END $$;

-- Enforce Foreign Key with ON DELETE RESTRICT (F-03: prevent silent unlinking)
-- Inspects existing constraint by table, name, and confdeltype ('r' = RESTRICT, 'a' = NO ACTION).
-- If existing constraint is SET NULL ('n') or CASCADE ('c'), drops and re-adds with RESTRICT safely.
DO $$
DECLARE
  v_del_type "char";
BEGIN
  SELECT confdeltype INTO v_del_type
  FROM pg_constraint
  WHERE conname = 'customers_clerk_user_id_fkey'
    AND conrelid = 'public.customers'::regclass;

  IF v_del_type IS NOT NULL AND v_del_type <> 'r' AND v_del_type <> 'a' THEN
    ALTER TABLE public.customers DROP CONSTRAINT customers_clerk_user_id_fkey;
    v_del_type := NULL;
  END IF;

  IF v_del_type IS NULL THEN
    ALTER TABLE public.customers
      ADD CONSTRAINT customers_clerk_user_id_fkey
      FOREIGN KEY (clerk_user_id) REFERENCES public.profiles(id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_customers_clerk_user_id
  ON public.customers(clerk_user_id);

-- ------------------------------------------------------------
-- 3. RBAC SECURITY HELPER FUNCTIONS
-- ------------------------------------------------------------

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

CREATE OR REPLACE FUNCTION public.require_staff_or_admin()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.require_active_user();

  IF NOT public.is_staff_or_admin() THEN
    RAISE EXCEPTION 'Access denied: this operation requires STAFF or ADMIN role.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
END;
$$;

-- F-14: Enforce profiles.is_active = true alongside customers.is_active = true
CREATE OR REPLACE FUNCTION public.get_current_customer_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT c.id
  FROM   public.customers c
  JOIN   public.profiles p ON p.id = c.clerk_user_id
  WHERE  c.clerk_user_id = (auth.jwt() ->> 'sub')
    AND  c.is_active      = true
    AND  p.is_active      = true
  LIMIT  1;
$$;

REVOKE EXECUTE ON FUNCTION public.is_staff_or_admin()        FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.require_staff_or_admin()   FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_current_customer_id()  FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_staff_or_admin()        TO authenticated;
GRANT EXECUTE ON FUNCTION public.require_staff_or_admin()   TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_customer_id()  TO authenticated;

-- ------------------------------------------------------------
-- 4. PROFILE ROLE & STATUS IMMUTABILITY TRIGGER & RLS
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.enforce_profile_role_immutability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_jwt_role TEXT;
  v_jwt_sub  TEXT;
BEGIN
  v_jwt_role := COALESCE(auth.jwt() ->> 'role', '');
  v_jwt_sub  := auth.jwt() ->> 'sub';

  -- Allow legitimate backend service-role operations (Clerk webhook, server-side admin client).
  -- Note: Inside a SECURITY DEFINER function, current_user evaluates to the function owner (postgres),
  -- so we inspect session_user and the JWT role claim for the PostgREST service_role context.
  IF v_jwt_role = 'service_role' OR session_user = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- A missing or null JWT subject is NOT an automatic bypass for unauthenticated callers
  IF v_jwt_sub IS NULL THEN
    RAISE EXCEPTION 'Access denied: unauthenticated caller cannot modify user profiles.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Non-admin users cannot alter role or active status
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

-- F-04: Tightened profiles update policy preserving self-service profile updates
-- while preventing non-admin role/status alteration or tampering.
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
      AND role = (SELECT p.role FROM public.profiles p WHERE p.id = (auth.jwt() ->> 'sub'))
      AND is_active = true
    )
  );

-- ------------------------------------------------------------
-- 5. CUSTOMER DATA ISOLATION RLS POLICIES
-- ------------------------------------------------------------

-- A. Table: public.customers
DROP POLICY IF EXISTS customers_select_active_users ON public.customers;
DROP POLICY IF EXISTS customers_select_staff_admin_or_own ON public.customers;
DROP POLICY IF EXISTS customers_select_scoped ON public.customers;
DROP POLICY IF EXISTS customers_insert_active_users ON public.customers;
DROP POLICY IF EXISTS customers_insert_staff_or_admin ON public.customers;
DROP POLICY IF EXISTS customers_update_active_users ON public.customers;
DROP POLICY IF EXISTS customers_update_staff_or_admin ON public.customers;

CREATE POLICY customers_select_scoped ON public.customers
  FOR SELECT TO authenticated
  USING (
    public.is_staff_or_admin()
    OR id = public.get_current_customer_id()
  );

CREATE POLICY customers_insert_staff_or_admin ON public.customers
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff_or_admin());

CREATE POLICY customers_update_staff_or_admin ON public.customers
  FOR UPDATE TO authenticated
  USING (public.is_staff_or_admin())
  WITH CHECK (public.is_staff_or_admin());

-- Note on customers DELETE: customers_delete_admin_only from migration 007 is preserved.

-- B. Table: public.egg_sales
DROP POLICY IF EXISTS egg_sales_select_active_users ON public.egg_sales;
DROP POLICY IF EXISTS egg_sales_select_staff_admin_or_own ON public.egg_sales;
DROP POLICY IF EXISTS egg_sales_select_scoped ON public.egg_sales;

CREATE POLICY egg_sales_select_scoped ON public.egg_sales
  FOR SELECT TO authenticated
  USING (
    public.is_staff_or_admin()
    OR customer_id = public.get_current_customer_id()
  );

-- Note on egg_sales INSERT/UPDATE/DELETE: No direct mutation policies exist;
-- all sales are managed via SECURITY DEFINER procedure record_egg_sale().

-- C. Table: public.egg_sale_items
DROP POLICY IF EXISTS egg_sale_items_select_active_users ON public.egg_sale_items;
DROP POLICY IF EXISTS egg_sale_items_select_staff_admin_or_own ON public.egg_sale_items;
DROP POLICY IF EXISTS egg_sale_items_select_scoped ON public.egg_sale_items;

CREATE POLICY egg_sale_items_select_scoped ON public.egg_sale_items
  FOR SELECT TO authenticated
  USING (
    public.is_staff_or_admin()
    OR sale_id IN (
      SELECT id FROM public.egg_sales
      WHERE customer_id = public.get_current_customer_id()
    )
  );

-- D. Table: public.payments
DROP POLICY IF EXISTS payments_select_active_users ON public.payments;
DROP POLICY IF EXISTS payments_select_scoped ON public.payments;

CREATE POLICY payments_select_scoped ON public.payments
  FOR SELECT TO authenticated
  USING (
    public.is_staff_or_admin()
    OR sale_id IN (
      SELECT id FROM public.egg_sales
      WHERE customer_id = public.get_current_customer_id()
    )
  );

-- ------------------------------------------------------------
-- 6. INTERNAL MODULE HARDENING (ISOLATE FROM CUSTOMER ROLE)
-- ------------------------------------------------------------

-- Flocks
DROP POLICY IF EXISTS flocks_select_active_users ON public.flocks;
DROP POLICY IF EXISTS flocks_select_staff_or_admin ON public.flocks;
DROP POLICY IF EXISTS flocks_insert_active_users ON public.flocks;
DROP POLICY IF EXISTS flocks_insert_staff_or_admin ON public.flocks;
DROP POLICY IF EXISTS flocks_update_active_users ON public.flocks;
DROP POLICY IF EXISTS flocks_update_staff_or_admin ON public.flocks;
CREATE POLICY flocks_select_staff_or_admin ON public.flocks FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY flocks_insert_staff_or_admin ON public.flocks FOR INSERT TO authenticated WITH CHECK (public.is_staff_or_admin());
CREATE POLICY flocks_update_staff_or_admin ON public.flocks FOR UPDATE TO authenticated USING (public.is_staff_or_admin()) WITH CHECK (public.is_staff_or_admin());

-- Flock Mortality & Culling
DROP POLICY IF EXISTS flock_mortality_select_active_users ON public.flock_mortality;
DROP POLICY IF EXISTS flock_mortality_select_staff_or_admin ON public.flock_mortality;
DROP POLICY IF EXISTS flock_culling_select_active_users ON public.flock_culling;
DROP POLICY IF EXISTS flock_culling_select_staff_or_admin ON public.flock_culling;
CREATE POLICY flock_mortality_select_staff_or_admin ON public.flock_mortality FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY flock_culling_select_staff_or_admin ON public.flock_culling FOR SELECT TO authenticated USING (public.is_staff_or_admin());

-- Egg Production & Inventory
DROP POLICY IF EXISTS egg_production_select_active_users ON public.egg_production;
DROP POLICY IF EXISTS egg_production_select_staff_or_admin ON public.egg_production;
DROP POLICY IF EXISTS egg_production_sizes_select_active_users ON public.egg_production_sizes;
DROP POLICY IF EXISTS egg_production_sizes_select_staff_or_admin ON public.egg_production_sizes;
DROP POLICY IF EXISTS egg_inventory_select_active_users ON public.egg_inventory;
DROP POLICY IF EXISTS egg_inventory_select_staff_or_admin ON public.egg_inventory;
DROP POLICY IF EXISTS egg_inventory_transactions_select_active_users ON public.egg_inventory_transactions;
DROP POLICY IF EXISTS egg_inventory_transactions_select_staff_or_admin ON public.egg_inventory_transactions;
CREATE POLICY egg_production_select_staff_or_admin ON public.egg_production FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY egg_production_sizes_select_staff_or_admin ON public.egg_production_sizes FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY egg_inventory_select_staff_or_admin ON public.egg_inventory FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY egg_inventory_transactions_select_staff_or_admin ON public.egg_inventory_transactions FOR SELECT TO authenticated USING (public.is_staff_or_admin());

-- Feed Inventory & Consumption
DROP POLICY IF EXISTS feed_inventory_select_active_users ON public.feed_inventory;
DROP POLICY IF EXISTS feed_inventory_select_staff_or_admin ON public.feed_inventory;
DROP POLICY IF EXISTS feed_inventory_transactions_select_active_users ON public.feed_inventory_transactions;
DROP POLICY IF EXISTS feed_inventory_transactions_select_staff_or_admin ON public.feed_inventory_transactions;
DROP POLICY IF EXISTS feed_consumption_select_active_users ON public.feed_consumption;
DROP POLICY IF EXISTS feed_consumption_select_staff_or_admin ON public.feed_consumption;
CREATE POLICY feed_inventory_select_staff_or_admin ON public.feed_inventory FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY feed_inventory_transactions_select_staff_or_admin ON public.feed_inventory_transactions FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY feed_consumption_select_staff_or_admin ON public.feed_consumption FOR SELECT TO authenticated USING (public.is_staff_or_admin());

-- Suppliers & Expenses
DROP POLICY IF EXISTS suppliers_select_active_users ON public.suppliers;
DROP POLICY IF EXISTS suppliers_select_staff_or_admin ON public.suppliers;
DROP POLICY IF EXISTS suppliers_insert_active_users ON public.suppliers;
DROP POLICY IF EXISTS suppliers_insert_staff_or_admin ON public.suppliers;
DROP POLICY IF EXISTS suppliers_update_active_users ON public.suppliers;
DROP POLICY IF EXISTS suppliers_update_staff_or_admin ON public.suppliers;
CREATE POLICY suppliers_select_staff_or_admin ON public.suppliers FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY suppliers_insert_staff_or_admin ON public.suppliers FOR INSERT TO authenticated WITH CHECK (public.is_staff_or_admin());
CREATE POLICY suppliers_update_staff_or_admin ON public.suppliers FOR UPDATE TO authenticated USING (public.is_staff_or_admin()) WITH CHECK (public.is_staff_or_admin());

DROP POLICY IF EXISTS expenses_select_active_users ON public.expenses;
DROP POLICY IF EXISTS expenses_select_staff_or_admin ON public.expenses;
DROP POLICY IF EXISTS expenses_insert_active_users ON public.expenses;
DROP POLICY IF EXISTS expenses_insert_staff_or_admin ON public.expenses;
CREATE POLICY expenses_select_staff_or_admin ON public.expenses FOR SELECT TO authenticated USING (public.is_staff_or_admin());
CREATE POLICY expenses_insert_staff_or_admin ON public.expenses FOR INSERT TO authenticated WITH CHECK (public.is_staff_or_admin());

-- System Settings
DROP POLICY IF EXISTS system_settings_select_active_users ON public.system_settings;
DROP POLICY IF EXISTS system_settings_select_staff_or_admin ON public.system_settings;
CREATE POLICY system_settings_select_staff_or_admin ON public.system_settings FOR SELECT TO authenticated USING (public.is_staff_or_admin());

-- ------------------------------------------------------------
-- 7. COMPLETE RPC RE-DEFINITIONS (REQUIRE STAFF OR ADMIN)
-- ------------------------------------------------------------

-- RPC 1: record_egg_payment
-- Fully preserves Migration 010 safeguards, status calculation, row locking, and audit logging
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
  -- 1. Authorization: Require active profile with STAFF or ADMIN role
  PERFORM public.require_staff_or_admin();
  v_caller_id := (auth.jwt() ->> 'sub');

  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required: missing user identity.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- 2. Validate input parameters
  IF p_sale_id IS NULL THEN
    RAISE EXCEPTION 'sale_id is required.'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than zero.'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF p_payment_date IS NULL THEN
    RAISE EXCEPTION 'payment_date is required.'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Validate payment method cast
  BEGIN
    v_method_enum := p_payment_method::public.payment_method;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'Invalid payment method: %. Must be CASH, BANK_TRANSFER, CHECK, or E_WALLET.', p_payment_method
      USING ERRCODE = 'invalid_parameter_value';
  END;

  -- 3. Lock target egg_sales row using FOR UPDATE to prevent race conditions
  SELECT id, total_amount, payment_status, customer_id, invoice_number
  INTO v_sale_record
  FROM public.egg_sales
  WHERE id = p_sale_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Egg sale with ID % does not exist.', p_sale_id
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- 4. Reject payment on cancelled sales (F-08)
  IF v_sale_record.payment_status = 'CANCELLED' THEN
    RAISE EXCEPTION 'Cannot record payment for a cancelled sale.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- 5. Calculate existing payments server-side from authoritative ledger
  SELECT COALESCE(SUM(amount), 0)
  INTO v_total_paid_prior
  FROM public.payments
  WHERE sale_id = p_sale_id;

  -- 6. Calculate remaining balance server-side and guard against fully paid sales (F-08)
  v_remaining_bal := v_sale_record.total_amount - v_total_paid_prior;

  IF v_remaining_bal <= 0 THEN
    RAISE EXCEPTION 'Sale is already fully paid. No balance remaining.'
      USING ERRCODE = 'check_violation';
  END IF;

  -- 7. Reject overpayment
  IF p_amount > v_remaining_bal THEN
    RAISE EXCEPTION 'Payment amount (%) exceeds remaining balance (%). Overpayment is not permitted.',
      p_amount, v_remaining_bal
      USING ERRCODE = 'check_violation';
  END IF;

  -- 8. Append payment record with NULLIF sanitation (F-09)
  INSERT INTO public.payments (
    sale_id,
    amount,
    payment_method,
    payment_date,
    reference_number,
    notes,
    recorded_by
  )
  VALUES (
    p_sale_id,
    p_amount,
    v_method_enum,
    p_payment_date,
    NULLIF(TRIM(p_reference_number), ''),
    NULLIF(TRIM(p_notes), ''),
    v_caller_id
  )
  RETURNING id INTO v_payment_id;

  -- 9. Recalculate status based on new authoritative total (F-07: Use 'PARTIAL', not 'PARTIALLY_PAID')
  v_total_paid_new := v_total_paid_prior + p_amount;

  IF v_total_paid_new >= v_sale_record.total_amount THEN
    v_new_status := 'PAID';
  ELSIF v_total_paid_new > 0 THEN
    v_new_status := 'PARTIAL';
  ELSE
    v_new_status := 'PENDING';
  END IF;

  -- 10. Update egg_sales status atomically
  UPDATE public.egg_sales
  SET payment_status = v_new_status,
      updated_at = NOW()
  WHERE id = p_sale_id;

  -- 11. Record immutable audit log entry in the SAME transaction (F-10: Complete metadata)
  INSERT INTO public.activity_logs (
    actor_id,
    action,
    entity_table,
    entity_id,
    metadata
  )
  VALUES (
    v_caller_id,
    'RECORD_PAYMENT',
    'payments',
    v_payment_id,
    jsonb_build_object(
      'sale_id', p_sale_id,
      'amount', p_amount,
      'payment_method', p_payment_method,
      'payment_date', p_payment_date,
      'reference_number', NULLIF(TRIM(p_reference_number), ''),
      'previous_paid', v_total_paid_prior,
      'total_paid', v_total_paid_new,
      'remaining_balance', (v_sale_record.total_amount - v_total_paid_new),
      'payment_status', v_new_status,
      'customer_id', v_sale_record.customer_id,
      'invoice_number', v_sale_record.invoice_number
    )
  );

  RETURN v_payment_id;
END;
$$;

-- RPC 2: record_egg_sale
-- Enforces server-side piece calculation via public._packaging_multiplier (F-06)
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
    v_size        := (v_item->>'size')::egg_size;
    v_packaging   := (v_item->>'packaging')::packaging_type;
    v_pkg_qty     := (v_item->>'package_quantity')::INTEGER;
    v_unit_price  := (v_item->>'unit_price')::NUMERIC(10,2);

    -- Calculate total pieces server-side via authoritative packaging multiplier (F-06)
    v_pieces_per_pkg := public._packaging_multiplier(v_packaging);
    v_line_pieces    := v_pkg_qty * v_pieces_per_pkg;
    v_line_total     := v_pkg_qty * v_unit_price;

    INSERT INTO public.egg_sale_items (
      sale_id, size, packaging, package_quantity, total_pieces, unit_price, line_total
    ) VALUES (
      v_sale_id, v_size, v_packaging, v_pkg_qty, v_line_pieces, v_unit_price, v_line_total
    );

    SELECT stock_pieces INTO v_current_stock
    FROM public.egg_inventory
    WHERE size = v_size
    FOR UPDATE;

    IF v_current_stock IS NULL OR v_current_stock < v_line_pieces THEN
      RAISE EXCEPTION 'Insufficient stock for size %. Available: %, Required: %.',
        v_size, COALESCE(v_current_stock, 0), v_line_pieces
        USING ERRCODE = 'check_violation';
    END IF;

    UPDATE public.egg_inventory
    SET stock_pieces = stock_pieces - v_line_pieces, updated_at = NOW()
    WHERE size = v_size;

    INSERT INTO public.egg_inventory_transactions (
      size, quantity, transaction_type, reference_id, notes, created_by
    ) VALUES (
      v_size, -v_line_pieces, 'SALE', v_sale_id,
      format('Sale invoice: %s', p_invoice_number), v_caller_id
    );
  END LOOP;

  INSERT INTO public.activity_logs (
    actor_id, action, entity_table, entity_id, metadata
  ) VALUES (
    v_caller_id, 'RECORD_EGG_SALE', 'egg_sales', v_sale_id,
    jsonb_build_object(
      'customer_id',    p_customer_id,
      'sale_date',      p_sale_date,
      'invoice_number', p_invoice_number,
      'total_amount',   v_total_amount
    )
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
  v_caller_id       TEXT;
  v_production_id   UUID;
  v_size_total      INTEGER := 0;
  v_item            JSONB;
  v_size_val        egg_size;
  v_qty             INTEGER;
  v_flock_status    flock_status;
  v_flock_acq_date  DATE;
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

  SELECT status, acquisition_date INTO v_flock_status, v_flock_acq_date
  FROM public.flocks WHERE id = p_flock_id FOR UPDATE;

  IF v_flock_status IS NULL OR v_flock_status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'Flock % does not exist or is not ACTIVE.', p_flock_id USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF p_production_date < v_flock_acq_date THEN
    RAISE EXCEPTION 'Production date cannot be before flock acquisition date.' USING ERRCODE = 'check_violation';
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

-- RPC 4: record_feed_consumption
CREATE OR REPLACE FUNCTION public.record_feed_consumption(
  p_flock_id          UUID,
  p_feed_type         TEXT,
  p_quantity_kg       NUMERIC(10,2),
  p_consumption_date  DATE,
  p_notes             TEXT
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

-- RPC 5: record_flock_mortality
CREATE OR REPLACE FUNCTION public.record_flock_mortality(
  p_flock_id    UUID,
  p_quantity    INTEGER,
  p_event_date  DATE,
  p_reason      TEXT
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

-- RPC 6: record_flock_culling
CREATE OR REPLACE FUNCTION public.record_flock_culling(
  p_flock_id    UUID,
  p_quantity    INTEGER,
  p_event_date  DATE,
  p_reason      TEXT
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

-- ------------------------------------------------------------
-- 8. PERMISSIONS & FUNCTION GRANTS
-- ------------------------------------------------------------

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
