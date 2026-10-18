-- Migration 008c: RBAC Verification Tests
-- POULTRY HUB — Test Harness for CUSTOMER and DELIVERY Roles

BEGIN;

-- 1. Create temporary mock profiles for testing
INSERT INTO public.profiles (id, role, full_name, is_active)
VALUES 
  ('user_customer_test', 'CUSTOMER', 'Test Customer', true),
  ('user_delivery_test', 'DELIVERY', 'Test Delivery', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Simulate CUSTOMER JWT session
SET LOCAL request.jwt.claims = '{"sub": "user_customer_test", "role": "authenticated"}';

DO $$ 
BEGIN
  -- Assert that is_staff_or_admin() returns FALSE for a CUSTOMER
  IF public.is_staff_or_admin() THEN
    RAISE EXCEPTION 'Test Failed: is_staff_or_admin() returned true for CUSTOMER.';
  END IF;

  -- Attempt to query flocks (should return 0 rows)
  IF (SELECT COUNT(*) FROM public.flocks) > 0 THEN
    RAISE EXCEPTION 'Test Failed: CUSTOMER was able to read flocks data.';
  END IF;

  -- Attempt to run record_egg_production (should raise insufficient_privilege)
  BEGIN
    PERFORM public.record_egg_production(gen_random_uuid(), CURRENT_DATE, 'MORNING', 100, 100, 0, 0, '', '[]'::jsonb);
    RAISE EXCEPTION 'Test Failed: CUSTOMER was able to execute record_egg_production.';
  EXCEPTION
    WHEN insufficient_privilege THEN 
      -- Expected behavior
      NULL;
  END;
END $$;

-- 3. Simulate DELIVERY JWT session
SET LOCAL request.jwt.claims = '{"sub": "user_delivery_test", "role": "authenticated"}';

DO $$ 
BEGIN
  -- Assert that is_staff_or_admin() returns FALSE for a DELIVERY user
  IF public.is_staff_or_admin() THEN
    RAISE EXCEPTION 'Test Failed: is_staff_or_admin() returned true for DELIVERY.';
  END IF;

  -- Attempt to query feed inventory (should return 0 rows)
  IF (SELECT COUNT(*) FROM public.feed_inventory) > 0 THEN
    RAISE EXCEPTION 'Test Failed: DELIVERY was able to read feed inventory data.';
  END IF;

  -- Attempt to run record_egg_sale (should raise insufficient_privilege)
  BEGIN
    PERFORM public.record_egg_sale(gen_random_uuid(), CURRENT_DATE, 'INV-001', 0, '', '[]'::jsonb);
    RAISE EXCEPTION 'Test Failed: DELIVERY was able to execute record_egg_sale.';
  EXCEPTION
    WHEN insufficient_privilege THEN 
      -- Expected behavior
      NULL;
  END;
END $$;

-- 4. Rollback all mock data and test session state
ROLLBACK;
