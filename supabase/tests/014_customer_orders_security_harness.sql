-- ============================================================
-- POULTRY HUB — Customer Egg Ordering Security Harness (Phase 2)
-- Testing Migration 014: customer_orders, customer_order_items, egg_price_catalog
-- ============================================================
--
-- EXECUTION SAFETY:
-- - Entirely enclosed within a BEGIN ... ROLLBACK transaction block.
-- - Automatically cleans up all test fixtures and resets session state.
-- - Designed for isolated test/staging database execution only.
-- - DO NOT run against production database.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. SETUP TEST FIXTURES
-- ------------------------------------------------------------

-- A. Profiles for all test actors
INSERT INTO public.profiles (id, role, full_name, is_active)
VALUES 
  ('usr_harness_admin',   'ADMIN',    'Test Harness Admin',    true),
  ('usr_harness_staff',   'STAFF',    'Test Harness Staff',    true),
  ('usr_harness_cust_a',  'CUSTOMER', 'Customer A Active',     true),
  ('usr_harness_cust_b',  'CUSTOMER', 'Customer B Active',     true),
  ('usr_harness_cust_p',  'CUSTOMER', 'Customer Pending Appr', false)
ON CONFLICT (id) DO UPDATE 
SET role = EXCLUDED.role, is_active = EXCLUDED.is_active;

-- B. Customer Entities
INSERT INTO public.customers (id, name, email, clerk_user_id, is_active)
VALUES
  ('c1111111-1111-1111-1111-111111111111', 'Customer Entity A', 'cust_a@test.ph', 'usr_harness_cust_a', true),
  ('c2222222-2222-2222-2222-222222222222', 'Customer Entity B', 'cust_b@test.ph', 'usr_harness_cust_b', true),
  ('c3333333-3333-3333-3333-333333333333', 'Customer Entity P', 'cust_p@test.ph', 'usr_harness_cust_p', false)
ON CONFLICT (id) DO UPDATE
SET clerk_user_id = EXCLUDED.clerk_user_id, is_active = EXCLUDED.is_active;

-- C. Seed Catalog Entry
INSERT INTO public.egg_price_catalog (size, price_per_piece, price_tray_30, price_carton_12, price_box_360, is_available, display_order)
VALUES
  ('MEDIUM', 7.50, 220.00, 92.00, 2600.00, true, 1),
  ('LARGE',  8.00, 235.00, 98.00, 2780.00, true, 2)
ON CONFLICT (size) DO UPDATE
SET is_available = true, price_per_piece = EXCLUDED.price_per_piece;

-- ------------------------------------------------------------
-- 2. TEST CASE 1: UNAUTHENTICATED (ANON) ACCESS
-- ------------------------------------------------------------
SET LOCAL request.jwt.claims = '{}';
SET LOCAL ROLE anon;

DO $$
BEGIN
  -- Anon must not read customer_orders
  IF (SELECT COUNT(*) FROM public.customer_orders) > 0 THEN
    RAISE EXCEPTION 'SECURITY FAILURE: Anon was able to read customer_orders';
  END IF;

  -- Anon must not read customer_order_items
  IF (SELECT COUNT(*) FROM public.customer_order_items) > 0 THEN
    RAISE EXCEPTION 'SECURITY FAILURE: Anon was able to read customer_order_items';
  END IF;

  -- Anon must not read egg_price_catalog
  IF (SELECT COUNT(*) FROM public.egg_price_catalog) > 0 THEN
    RAISE EXCEPTION 'SECURITY FAILURE: Anon was able to read egg_price_catalog';
  END IF;
END $$;

-- ------------------------------------------------------------
-- 3. TEST CASE 2: PENDING / UNAPPROVED CUSTOMER ACCESS
-- ------------------------------------------------------------
SET LOCAL request.jwt.claims = '{"sub": "usr_harness_cust_p"}';
SET LOCAL ROLE authenticated;

DO $$
BEGIN
  -- Pending customer get_current_customer_id() must be NULL
  IF public.get_current_customer_id() IS NOT NULL THEN
    RAISE EXCEPTION 'SECURITY FAILURE: get_current_customer_id() returned value for inactive customer';
  END IF;

  -- Pending customer must not be able to read price catalog
  IF (SELECT COUNT(*) FROM public.egg_price_catalog) > 0 THEN
    RAISE EXCEPTION 'SECURITY FAILURE: Inactive customer was able to view egg_price_catalog';
  END IF;

  -- Pending customer cannot insert an order
  BEGIN
    INSERT INTO public.customer_orders (id, customer_id, status)
    VALUES ('o3333333-3333-3333-3333-333333333333', 'c3333333-3333-3333-3333-333333333333', 'PENDING');
    RAISE EXCEPTION 'SECURITY FAILURE: Pending customer inserted an order!';
  EXCEPTION WHEN insufficient_privilege THEN
    -- Expected RLS rejection
    NULL;
  END;
END $$;

-- ------------------------------------------------------------
-- 4. TEST CASE 3: ACTIVE CUSTOMER A LEGITIMATE ACTIONS
-- ------------------------------------------------------------
SET LOCAL request.jwt.claims = '{"sub": "usr_harness_cust_a"}';
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_catalog_count INT;
BEGIN
  -- Customer A can read catalog
  SELECT COUNT(*) INTO v_catalog_count FROM public.egg_price_catalog;
  IF v_catalog_count = 0 THEN
    RAISE EXCEPTION 'FUNCTIONAL FAILURE: Customer A cannot read egg_price_catalog';
  END IF;

  -- Customer A can insert their own PENDING order
  INSERT INTO public.customer_orders (
    id, customer_id, status, requested_date, notes
  ) VALUES (
    'o1111111-1111-1111-1111-111111111111',
    'c1111111-1111-1111-1111-111111111111',
    'PENDING',
    CURRENT_DATE + 3,
    'Please pack carefully'
  );

  -- Customer A can insert order items into their own PENDING order
  INSERT INTO public.customer_order_items (
    order_id, size, packaging, package_quantity, requested_pieces, quoted_unit_price
  ) VALUES (
    'o1111111-1111-1111-1111-111111111111',
    'MEDIUM',
    'TRAY_30',
    2,
    60,
    220.00
  );

  -- Customer A sees their own order
  IF (SELECT COUNT(*) FROM public.customer_orders WHERE id = 'o1111111-1111-1111-1111-111111111111') != 1 THEN
    RAISE EXCEPTION 'FUNCTIONAL FAILURE: Customer A cannot view their newly created order';
  END IF;
END $$;

-- ------------------------------------------------------------
-- 5. TEST CASE 4: CUSTOMER A ILLEGITIMATE / PRIVILEGE ESCALATION ATTEMPTS
-- ------------------------------------------------------------
DO $$
BEGIN
  -- A. Customer A cannot insert order on behalf of Customer B
  BEGIN
    INSERT INTO public.customer_orders (
      id, customer_id, status
    ) VALUES (
      'o1111111-1111-1111-1111-111111111199',
      'c2222222-2222-2222-2222-222222222222', -- Customer B's ID
      'PENDING'
    );
    RAISE EXCEPTION 'SECURITY FAILURE: Customer A inserted order for Customer B!';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- Expected RLS check failure
  END;

  -- B. Customer A cannot insert order directly as CONFIRMED
  BEGIN
    INSERT INTO public.customer_orders (
      id, customer_id, status
    ) VALUES (
      'o1111111-1111-1111-1111-111111111198',
      'c1111111-1111-1111-1111-111111111111',
      'CONFIRMED'
    );
    RAISE EXCEPTION 'SECURITY FAILURE: Customer A inserted order with status CONFIRMED!';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- Expected RLS check failure
  END;

  -- C. Customer A cannot tamper with admin_notes on INSERT
  BEGIN
    INSERT INTO public.customer_orders (
      id, customer_id, status, admin_notes
    ) VALUES (
      'o1111111-1111-1111-1111-111111111197',
      'c1111111-1111-1111-1111-111111111111',
      'PENDING',
      'VIP Discount 50%'
    );
    RAISE EXCEPTION 'SECURITY FAILURE: Customer A populated admin_notes on INSERT!';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- Expected RLS check failure
  END;

  -- D. Customer A cannot UPDATE any order row directly
  BEGIN
    UPDATE public.customer_orders
    SET status = 'COMPLETED'
    WHERE id = 'o1111111-1111-1111-1111-111111111111';
    IF (SELECT status FROM public.customer_orders WHERE id = 'o1111111-1111-1111-1111-111111111111') = 'COMPLETED' THEN
      RAISE EXCEPTION 'SECURITY FAILURE: Customer A updated order status via SQL!';
    END IF;
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- Expected
  END;

  -- E. Customer A cannot DELETE any order
  BEGIN
    DELETE FROM public.customer_orders
    WHERE id = 'o1111111-1111-1111-1111-111111111111';
    IF (SELECT COUNT(*) FROM public.customer_orders WHERE id = 'o1111111-1111-1111-1111-111111111111') = 0 THEN
      RAISE EXCEPTION 'SECURITY FAILURE: Customer A deleted order row!';
    END IF;
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- Expected
  END;
END $$;

-- ------------------------------------------------------------
-- 6. TEST CASE 5: CROSS-TENANT ISOLATION (CUSTOMER B)
-- ------------------------------------------------------------
SET LOCAL request.jwt.claims = '{"sub": "usr_harness_cust_b"}';
SET LOCAL ROLE authenticated;

DO $$
BEGIN
  -- Customer B must NOT see Customer A's order
  IF (SELECT COUNT(*) FROM public.customer_orders WHERE id = 'o1111111-1111-1111-1111-111111111111') > 0 THEN
    RAISE EXCEPTION 'SECURITY FAILURE: Customer B was able to view Customer A order!';
  END IF;

  -- Customer B must NOT see Customer A's order items
  IF (SELECT COUNT(*) FROM public.customer_order_items WHERE order_id = 'o1111111-1111-1111-1111-111111111111') > 0 THEN
    RAISE EXCEPTION 'SECURITY FAILURE: Customer B was able to view Customer A order items!';
  END IF;
END $$;

-- ------------------------------------------------------------
-- 7. TEST CASE 6: STAFF ROLE PERMISSIONS
-- ------------------------------------------------------------
SET LOCAL request.jwt.claims = '{"sub": "usr_harness_staff"}';
SET LOCAL ROLE authenticated;

DO $$
BEGIN
  -- Staff can see Customer A's order
  IF (SELECT COUNT(*) FROM public.customer_orders WHERE id = 'o1111111-1111-1111-1111-111111111111') != 1 THEN
    RAISE EXCEPTION 'FUNCTIONAL FAILURE: Staff cannot see customer orders';
  END IF;

  -- Staff can update order status and admin_notes
  UPDATE public.customer_orders
  SET status = 'PREPARING', admin_notes = 'Packaged from House 2'
  WHERE id = 'o1111111-1111-1111-1111-111111111111';

  IF (SELECT status FROM public.customer_orders WHERE id = 'o1111111-1111-1111-1111-111111111111') != 'PREPARING' THEN
    RAISE EXCEPTION 'FUNCTIONAL FAILURE: Staff update to PREPARING did not take effect';
  END IF;

  -- Staff CANNOT delete orders (ADMIN only)
  BEGIN
    DELETE FROM public.customer_orders WHERE id = 'o1111111-1111-1111-1111-111111111111';
    IF (SELECT COUNT(*) FROM public.customer_orders WHERE id = 'o1111111-1111-1111-1111-111111111111') = 0 THEN
      RAISE EXCEPTION 'SECURITY FAILURE: Staff was able to delete a customer order!';
    END IF;
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- Expected
  END;
END $$;

-- ------------------------------------------------------------
-- 8. TEST CASE 7: ADMIN ROLE PERMISSIONS
-- ------------------------------------------------------------
SET LOCAL request.jwt.claims = '{"sub": "usr_harness_admin"}';
SET LOCAL ROLE authenticated;

DO $$
BEGIN
  -- Admin can delete orders
  DELETE FROM public.customer_orders WHERE id = 'o1111111-1111-1111-1111-111111111111';

  IF (SELECT COUNT(*) FROM public.customer_orders WHERE id = 'o1111111-1111-1111-1111-111111111111') != 0 THEN
    RAISE EXCEPTION 'FUNCTIONAL FAILURE: Admin was unable to delete customer order';
  END IF;

  -- Order items should cascade delete
  IF (SELECT COUNT(*) FROM public.customer_order_items WHERE order_id = 'o1111111-1111-1111-1111-111111111111') != 0 THEN
    RAISE EXCEPTION 'CASCADE FAILURE: customer_order_items were not cascade deleted with order';
  END IF;
END $$;

-- ------------------------------------------------------------
-- 9. CLEANUP / ROLLBACK
-- ------------------------------------------------------------
-- Reset session authorization and roll back all harness modifications
RESET ROLE;
RESET request.jwt.claims;

ROLLBACK;

-- Harness completed successfully with all security assertions verified.
