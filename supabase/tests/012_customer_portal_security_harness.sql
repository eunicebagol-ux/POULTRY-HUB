-- ============================================================
-- POULTRY HUB — Phase 1 RBAC & Security Test Harness for Migration 012
-- ============================================================
--
-- EXECUTION SAFETY:
-- - Entirely wrapped inside BEGIN ... ROLLBACK transaction block.
-- - Automatically cleans up all test fixtures and resets session state.
-- - Designed for execution against an ISOLATED test/staging PostgreSQL instance.
-- - DO NOT run against production database.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. SETUP TEST FIXTURES
-- ------------------------------------------------------------

-- A. Create Mock Profiles across all user roles and activation states
INSERT INTO public.profiles (id, role, full_name, is_active)
VALUES 
  ('user_test_admin',    'ADMIN',    'Test Admin User',       true),
  ('user_test_staff',    'STAFF',    'Test Staff User',       true),
  ('user_cust_pending',  'CUSTOMER', 'Test Pending Customer', false),
  ('user_cust_active_a', 'CUSTOMER', 'Test Active Customer A',true),
  ('user_cust_active_b', 'CUSTOMER', 'Test Active Customer B',true)
ON CONFLICT (id) DO UPDATE 
SET role = EXCLUDED.role, is_active = EXCLUDED.is_active, full_name = EXCLUDED.full_name;

-- B. Create Customer Directory Entities
INSERT INTO public.customers (id, name, email, clerk_user_id, is_active)
VALUES
  ('c0000000-0000-0000-0000-000000000001', 'Customer A Entity', 'cust_a@test.com', 'user_cust_active_a', true),
  ('c0000000-0000-0000-0000-000000000002', 'Customer B Entity', 'cust_b@test.com', 'user_cust_active_b', true),
  ('c0000000-0000-0000-0000-000000000003', 'Customer Pending',  'pending@test.com', 'user_cust_pending',  false)
ON CONFLICT (id) DO UPDATE
SET clerk_user_id = EXCLUDED.clerk_user_id, is_active = EXCLUDED.is_active;

-- C. Create Mock Sales for Customer A and Customer B
INSERT INTO public.egg_sales (id, customer_id, sale_date, invoice_number, subtotal, discount, total_amount, status, payment_status, created_by)
VALUES
  ('s0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000001', CURRENT_DATE, 'INV-TEST-A1', 1000.00, 0, 1000.00, 'COMPLETED', 'PENDING', 'user_test_staff'),
  ('s0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000002', CURRENT_DATE, 'INV-TEST-B1', 2500.00, 0, 2500.00, 'COMPLETED', 'PENDING', 'user_test_staff')
ON CONFLICT (id) DO NOTHING;

-- D. Create Mock Payment for Customer A
INSERT INTO public.payments (id, sale_id, amount, payment_method, payment_date, reference_number, recorded_by)
VALUES
  ('p0000000-0000-0000-0000-000000000001', 's0000000-0000-0000-0000-000000000001', 500.00, 'CASH', CURRENT_DATE, 'REF-TEST-A1', 'user_test_staff')
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- 2. TEST CASE 1: UNAUTHENTICATED CALLER (ANON)
-- ------------------------------------------------------------
SET LOCAL request.jwt.claims = '{}';
SET LOCAL ROLE anon;

DO $$
BEGIN
  -- Assert anon cannot read any egg sales
  IF (SELECT COUNT(*) FROM public.egg_sales) > 0 THEN
    RAISE EXCEPTION 'Security Failure: Unauthenticated caller was able to read egg_sales.';
  END IF;

  -- Assert anon cannot read flocks
  IF (SELECT COUNT(*) FROM public.flocks) > 0 THEN
    RAISE EXCEPTION 'Security Failure: Unauthenticated caller was able to read flocks.';
  END IF;

  -- Assert anon cannot read payments
  IF (SELECT COUNT(*) FROM public.payments) > 0 THEN
    RAISE EXCEPTION 'Security Failure: Unauthenticated caller was able to read payments.';
  END IF;
END $$;

-- ------------------------------------------------------------
-- 3. TEST CASE 2: PENDING / INACTIVE CUSTOMER (user_cust_pending)
-- ------------------------------------------------------------
SET LOCAL request.jwt.claims = '{"sub": "user_cust_pending", "role": "authenticated"}';
SET LOCAL ROLE authenticated;

DO $$
BEGIN
  -- Helper get_current_customer_id() must return NULL for inactive/pending customer
  IF public.get_current_customer_id() IS NOT NULL THEN
    RAISE EXCEPTION 'Security Failure: get_current_customer_id() returned non-null for inactive customer.';
  END IF;

  -- Pending customer must not be able to read any customers records
  IF (SELECT COUNT(*) FROM public.customers) > 0 THEN
    RAISE EXCEPTION 'Security Failure: Pending customer was able to read customers records.';
  END IF;

  -- Pending customer must not be able to read any egg sales
  IF (SELECT COUNT(*) FROM public.egg_sales) > 0 THEN
    RAISE EXCEPTION 'Security Failure: Pending customer was able to read egg sales.';
  END IF;

  -- Pending customer cannot execute record_egg_sale RPC
  BEGIN
    PERFORM public.record_egg_sale(NULL, CURRENT_DATE, 'INV-FAIL', 0, '', '[]'::jsonb);
    RAISE EXCEPTION 'Security Failure: Pending customer was able to execute record_egg_sale.';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- Expected
  END;
END $$;

-- ------------------------------------------------------------
-- 4. TEST CASE 3: APPROVED CUSTOMER A (DATA ISOLATION)
-- ------------------------------------------------------------
SET LOCAL request.jwt.claims = '{"sub": "user_cust_active_a", "role": "authenticated"}';
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_sales_count INTEGER;
  v_pay_count   INTEGER;
  v_cust_count  INTEGER;
BEGIN
  -- Helper must resolve Customer A ID
  IF public.get_current_customer_id() <> 'c0000000-0000-0000-0000-000000000001'::uuid THEN
    RAISE EXCEPTION 'Security Failure: get_current_customer_id() did not resolve Customer A entity.';
  END IF;

  -- Can read only own customer entity (1 row), never Customer B's
  SELECT COUNT(*) INTO v_cust_count FROM public.customers;
  IF v_cust_count <> 1 THEN
    RAISE EXCEPTION 'Security Failure: Customer A saw % customers records (expected exactly 1).', v_cust_count;
  END IF;

  IF (SELECT name FROM public.customers LIMIT 1) <> 'Customer A Entity' THEN
    RAISE EXCEPTION 'Security Failure: Customer A saw another customer entity record.';
  END IF;

  -- Can read only own egg sales (Invoice A1), NEVER Customer B's sale
  SELECT COUNT(*) INTO v_sales_count FROM public.egg_sales;
  IF v_sales_count <> 1 THEN
    RAISE EXCEPTION 'Security Failure: Customer A saw % sales records (expected exactly 1).', v_sales_count;
  END IF;

  IF (SELECT invoice_number FROM public.egg_sales LIMIT 1) <> 'INV-TEST-A1' THEN
    RAISE EXCEPTION 'Security Failure: Customer A saw Customer B sale record.';
  END IF;

  -- Can read only own payment (p0000000-0000-0000-0000-000000000001)
  SELECT COUNT(*) INTO v_pay_count FROM public.payments;
  IF v_pay_count <> 1 THEN
    RAISE EXCEPTION 'Security Failure: Customer A saw % payment records (expected exactly 1).', v_pay_count;
  END IF;

  -- Attempt to read internal farm tables (must all return 0 rows)
  IF (SELECT COUNT(*) FROM public.flocks) > 0 THEN RAISE EXCEPTION 'Security Failure: Customer read flocks.'; END IF;
  IF (SELECT COUNT(*) FROM public.egg_production) > 0 THEN RAISE EXCEPTION 'Security Failure: Customer read egg_production.'; END IF;
  IF (SELECT COUNT(*) FROM public.egg_inventory) > 0 THEN RAISE EXCEPTION 'Security Failure: Customer read egg_inventory.'; END IF;
  IF (SELECT COUNT(*) FROM public.feed_inventory) > 0 THEN RAISE EXCEPTION 'Security Failure: Customer read feed_inventory.'; END IF;
  IF (SELECT COUNT(*) FROM public.expenses) > 0 THEN RAISE EXCEPTION 'Security Failure: Customer read expenses.'; END IF;
  IF (SELECT COUNT(*) FROM public.suppliers) > 0 THEN RAISE EXCEPTION 'Security Failure: Customer read suppliers.'; END IF;
  IF (SELECT COUNT(*) FROM public.activity_logs) > 0 THEN RAISE EXCEPTION 'Security Failure: Customer read activity_logs.'; END IF;
  IF (SELECT COUNT(*) FROM public.system_settings) > 0 THEN RAISE EXCEPTION 'Security Failure: Customer read system_settings.'; END IF;

  -- Attempt to invoke farm RPC procedures (must all throw insufficient_privilege)
  BEGIN
    PERFORM public.record_egg_sale(NULL, CURRENT_DATE, 'INV-X', 0, '', '[]'::jsonb);
    RAISE EXCEPTION 'Security Failure: Customer executed record_egg_sale.';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  BEGIN
    PERFORM public.record_egg_payment(gen_random_uuid(), 100, 'CASH', CURRENT_DATE);
    RAISE EXCEPTION 'Security Failure: Customer executed record_egg_payment.';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;

  -- Attempt privilege escalation via self profile update
  BEGIN
    UPDATE public.profiles SET role = 'ADMIN' WHERE id = 'user_cust_active_a';
    RAISE EXCEPTION 'Security Failure: Customer was able to alter own role to ADMIN.';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;

-- ------------------------------------------------------------
-- 5. TEST CASE 4: APPROVED CUSTOMER B (CROSS-TENANT ISOLATION)
-- ------------------------------------------------------------
SET LOCAL request.jwt.claims = '{"sub": "user_cust_active_b", "role": "authenticated"}';
SET LOCAL ROLE authenticated;

DO $$
BEGIN
  -- Customer B must see only Customer B's sale (INV-TEST-B1)
  IF (SELECT invoice_number FROM public.egg_sales LIMIT 1) <> 'INV-TEST-B1' THEN
    RAISE EXCEPTION 'Security Failure: Customer B saw incorrect sale record.';
  END IF;

  -- Customer B must see 0 payments (since Customer B has no payments)
  IF (SELECT COUNT(*) FROM public.payments) <> 0 THEN
    RAISE EXCEPTION 'Security Failure: Customer B was able to see Customer A payment.';
  END IF;
END $$;

-- ------------------------------------------------------------
-- 6. TEST CASE 5: STAFF PRIVILEGES & NON-PROMOTION GUARD
-- ------------------------------------------------------------
SET LOCAL request.jwt.claims = '{"sub": "user_test_staff", "role": "authenticated"}';
SET LOCAL ROLE authenticated;

DO $$
BEGIN
  -- Staff must see all sales (both A and B)
  IF (SELECT COUNT(*) FROM public.egg_sales) < 2 THEN
    RAISE EXCEPTION 'Staff Regression: Staff could not see all customer sales.';
  END IF;

  -- Staff must see all customers
  IF (SELECT COUNT(*) FROM public.customers) < 2 THEN
    RAISE EXCEPTION 'Staff Regression: Staff could not view customer directory.';
  END IF;

  -- Staff cannot elevate themselves to ADMIN
  BEGIN
    UPDATE public.profiles SET role = 'ADMIN' WHERE id = 'user_test_staff';
    RAISE EXCEPTION 'Security Failure: Staff was able to promote self to ADMIN.';
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;

-- ------------------------------------------------------------
-- 7. TEST CASE 6: ADMIN PRIVILEGES
-- ------------------------------------------------------------
SET LOCAL request.jwt.claims = '{"sub": "user_test_admin", "role": "authenticated"}';
SET LOCAL ROLE authenticated;

DO $$
BEGIN
  -- Admin can approve pending customer account
  UPDATE public.profiles SET is_active = true WHERE id = 'user_cust_pending';
  IF (SELECT is_active FROM public.profiles WHERE id = 'user_cust_pending') <> true THEN
    RAISE EXCEPTION 'Admin Regression: Admin could not activate pending customer account.';
  END IF;

  -- Admin can deactivate/suspend customer account
  UPDATE public.profiles SET is_active = false WHERE id = 'user_cust_pending';
  IF (SELECT is_active FROM public.profiles WHERE id = 'user_cust_pending') <> false THEN
    RAISE EXCEPTION 'Admin Regression: Admin could not deactivate customer account.';
  END IF;
END $$;

-- ------------------------------------------------------------
-- 8. CLEANUP: ROLLBACK EVERYTHING (NO STATE PERSISTED)
-- ------------------------------------------------------------
ROLLBACK;
