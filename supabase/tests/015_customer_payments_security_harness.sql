-- ============================================================
-- POULTRY HUB — Customer Payment Submissions Security Harness (Phase 3)
-- Testing Migration 015: customer_payment_submissions table and RLS
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

-- A. Profiles for test actors
INSERT INTO public.profiles (id, role, full_name, is_active)
VALUES 
  ('usr_harness_admin_p3',   'ADMIN',    'Admin P3',        true),
  ('usr_harness_staff_p3',   'STAFF',    'Staff P3',        true),
  ('usr_harness_cust_a_p3',  'CUSTOMER', 'Customer A P3',   true),
  ('usr_harness_cust_b_p3',  'CUSTOMER', 'Customer B P3',   true)
ON CONFLICT (id) DO UPDATE 
SET role = EXCLUDED.role, is_active = EXCLUDED.is_active;

-- B. Customer Entities
INSERT INTO public.customers (id, name, email, clerk_user_id, is_active)
VALUES
  ('c1111111-3333-3333-3333-111111111111', 'Cust A P3', 'cust_a_p3@test.ph', 'usr_harness_cust_a_p3', true),
  ('c2222222-3333-3333-3333-222222222222', 'Cust B P3', 'cust_b_p3@test.ph', 'usr_harness_cust_b_p3', true)
ON CONFLICT (id) DO UPDATE
SET clerk_user_id = EXCLUDED.clerk_user_id, is_active = EXCLUDED.is_active;

-- C. Customer Orders for test fixtures
INSERT INTO public.customer_orders (id, customer_id, status, estimated_total)
VALUES
  ('o1111111-3333-3333-3333-111111111111', 'c1111111-3333-3333-3333-111111111111', 'CONFIRMED', 500.00),
  ('o2222222-3333-3333-3333-222222222222', 'c2222222-3333-3333-3333-222222222222', 'CONFIRMED', 750.00)
ON CONFLICT (id) DO NOTHING;

-- D. Initial Payment Submission for Customer A
INSERT INTO public.customer_payment_submissions (
  id, order_id, customer_id, payment_method, status, reference_number, declared_amount
)
VALUES (
  'p1111111-3333-3333-3333-111111111111',
  'o1111111-3333-3333-3333-111111111111',
  'c1111111-3333-3333-3333-111111111111',
  'GCASH',
  'SUBMITTED',
  'GCASH-REF-001',
  500.00
)
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- 2. TEST CASE 1: ANON ACCESS MUST BE BLOCKED
-- ------------------------------------------------------------
SET LOCAL request.jwt.claims = '{}';
SET LOCAL ROLE anon;

DO $$
BEGIN
  IF (SELECT COUNT(*) FROM public.customer_payment_submissions) > 0 THEN
    RAISE EXCEPTION 'SECURITY FAILURE: Anon was able to read customer_payment_submissions';
  END IF;
END $$;

-- ------------------------------------------------------------
-- 3. TEST CASE 2: CUSTOMER ISOLATION (Customer B reading Customer A's payment)
-- ------------------------------------------------------------
SET LOCAL request.jwt.claims = '{"sub": "usr_harness_cust_b_p3"}';
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Customer B should NOT see Customer A's submission
  SELECT COUNT(*) INTO v_count
  FROM public.customer_payment_submissions
  WHERE id = 'p1111111-3333-3333-3333-111111111111';

  IF v_count > 0 THEN
    RAISE EXCEPTION 'SECURITY FAILURE: Customer B was able to view Customer A payment submission';
  END IF;
END $$;

-- ------------------------------------------------------------
-- 4. TEST CASE 3: CUSTOMER CANNOT SELF-VERIFY VIA INSERT
-- ------------------------------------------------------------
SET LOCAL request.jwt.claims = '{"sub": "usr_harness_cust_b_p3"}';
SET LOCAL ROLE authenticated;

DO $$
BEGIN
  -- Customer B trying to insert pre-verified payment must FAIL check constraint or RLS
  BEGIN
    INSERT INTO public.customer_payment_submissions (
      order_id, customer_id, payment_method, status, reference_number, verified_by
    )
    VALUES (
      'o2222222-3333-3333-3333-222222222222',
      'c2222222-3333-3333-3333-222222222222',
      'GCASH',
      'VERIFIED',
      'GCASH-HACK-001',
      'usr_harness_cust_b_p3'
    );
    RAISE EXCEPTION 'SECURITY FAILURE: Customer was able to insert pre-verified payment submission';
  EXCEPTION
    WHEN insufficient_privilege OR check_violation THEN
      NULL; -- Expected behavior
  END;
END $$;

-- ------------------------------------------------------------
-- 5. TEST CASE 4: CUSTOMER CANNOT UPDATE PAYMENT (Cannot change status to VERIFIED)
-- ------------------------------------------------------------
SET LOCAL request.jwt.claims = '{"sub": "usr_harness_cust_a_p3"}';
SET LOCAL ROLE authenticated;

DO $$
BEGIN
  -- Customer A trying to update status to VERIFIED must affect 0 rows or fail RLS
  UPDATE public.customer_payment_submissions
  SET status = 'VERIFIED'
  WHERE id = 'p1111111-3333-3333-3333-111111111111';

  IF (SELECT status FROM public.customer_payment_submissions WHERE id = 'p1111111-3333-3333-3333-111111111111') = 'VERIFIED' THEN
    RAISE EXCEPTION 'SECURITY FAILURE: Customer was able to self-verify payment submission via UPDATE';
  END IF;
END $$;

-- ------------------------------------------------------------
-- 6. TEST CASE 5: STAFF/ADMIN CAN READ ALL AND VERIFY
-- ------------------------------------------------------------
SET LOCAL request.jwt.claims = '{"sub": "usr_harness_staff_p3"}';
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Staff must see Customer A's submission
  SELECT COUNT(*) INTO v_count
  FROM public.customer_payment_submissions
  WHERE id = 'p1111111-3333-3333-3333-111111111111';

  IF v_count = 0 THEN
    RAISE EXCEPTION 'SECURITY FAILURE: Staff could not view customer payment submission';
  END IF;

  -- Staff must be able to verify
  UPDATE public.customer_payment_submissions
  SET status = 'VERIFIED',
      verified_by = 'usr_harness_staff_p3',
      verified_at = NOW(),
      verification_notes = 'Verified in test harness'
  WHERE id = 'p1111111-3333-3333-3333-111111111111';

  IF (SELECT status FROM public.customer_payment_submissions WHERE id = 'p1111111-3333-3333-3333-111111111111') <> 'VERIFIED' THEN
    RAISE EXCEPTION 'SECURITY FAILURE: Staff was unable to verify customer payment submission';
  END IF;
END $$;

-- Reset role and rollback test changes
RESET ROLE;
ROLLBACK;
