-- ============================================================
-- Migration 013: Customer Self-Registration & Portal RBAC Isolation
-- POULTRY HUB — Support CUSTOMER Role, Secure 1-to-1 Account Linking & Data Isolation
-- ============================================================
--
-- IMPORTANT SAFETY NOTICE:
-- DO NOT EXECUTE AUTOMATICALLY. Prepared for review and manual approval.
--
-- ARCHITECTURE & MIGRATION ORDER:
-- Step 1 (Run standalone if enum value does not exist):
--   ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'CUSTOMER';
--
-- Step 2 (Atomic Transaction):
--   Wraps schema updates, helper functions, and RLS policies in a single transaction.
-- ============================================================

-- Step 1: Expand user_role enum
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'CUSTOMER';

-- Step 2: Atomic Schema & Security Policies
BEGIN;

-- ------------------------------------------------------------
-- 1. ADD CLERK IDENTITY LINKAGE COLUMN TO CUSTOMERS
-- ------------------------------------------------------------

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

-- Enforce Foreign Key to public.profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'customers_clerk_user_id_fkey'
      AND conrelid = 'public.customers'::regclass
  ) THEN
    ALTER TABLE public.customers
      ADD CONSTRAINT customers_clerk_user_id_fkey
      FOREIGN KEY (clerk_user_id) REFERENCES public.profiles(id)
      ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_customers_clerk_user_id
  ON public.customers(clerk_user_id);

-- ------------------------------------------------------------
-- 2. SECURITY HELPER FUNCTIONS
-- ------------------------------------------------------------

-- Check if authenticated caller is active Staff or Admin
CREATE OR REPLACE FUNCTION public.is_active_staff_or_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = (auth.jwt() ->> 'sub')
      AND is_active = true
      AND role IN ('ADMIN', 'STAFF')
  );
$$;

-- Check if authenticated caller is active Customer
CREATE OR REPLACE FUNCTION public.is_active_customer()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = (auth.jwt() ->> 'sub')
      AND is_active = true
      AND role = 'CUSTOMER'
  );
$$;

-- ------------------------------------------------------------
-- 3. PROFILE ROLE IMMUTABILITY TRIGGER
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

  -- Allow backend service-role operations (Clerk webhook, server-side admin client)
  IF v_jwt_role = 'service_role' OR session_user = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Block unauthenticated callers
  IF v_jwt_sub IS NULL THEN
    RAISE EXCEPTION 'Access denied: unauthenticated caller cannot modify user profiles.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- Non-admin users (STAFF or CUSTOMER) cannot alter role or is_active
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

-- ------------------------------------------------------------
-- 4. ROW LEVEL SECURITY (RLS) POLICIES FOR CUSTOMER ISOLATION
-- ------------------------------------------------------------

-- A. Table: public.customers
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customers_select_policy ON public.customers;
CREATE POLICY customers_select_policy
  ON public.customers
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR public.is_active_staff_or_admin()
    OR clerk_user_id = (auth.jwt() ->> 'sub')
  );

DROP POLICY IF EXISTS customers_update_policy ON public.customers;
CREATE POLICY customers_update_policy
  ON public.customers
  FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
    OR public.is_active_staff_or_admin()
    OR clerk_user_id = (auth.jwt() ->> 'sub')
  )
  WITH CHECK (
    public.is_admin()
    OR public.is_active_staff_or_admin()
    OR (
      clerk_user_id = (auth.jwt() ->> 'sub')
      AND is_active = true
    )
  );

-- B. Table: public.egg_sales
ALTER TABLE public.egg_sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS egg_sales_customer_isolation_select ON public.egg_sales;
CREATE POLICY egg_sales_customer_isolation_select
  ON public.egg_sales
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR public.is_active_staff_or_admin()
    OR customer_id IN (
      SELECT c.id FROM public.customers c
      WHERE c.clerk_user_id = (auth.jwt() ->> 'sub')
    )
  );

-- C. Table: public.egg_sale_items
ALTER TABLE public.egg_sale_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS egg_sale_items_customer_isolation_select ON public.egg_sale_items;
CREATE POLICY egg_sale_items_customer_isolation_select
  ON public.egg_sale_items
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR public.is_active_staff_or_admin()
    OR sale_id IN (
      SELECT s.id FROM public.egg_sales s
      JOIN public.customers c ON c.id = s.customer_id
      WHERE c.clerk_user_id = (auth.jwt() ->> 'sub')
    )
  );

-- D. Table: public.payments (if exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments') THEN
    ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

    DROP POLICY IF EXISTS payments_customer_isolation_select ON public.payments;
    EXECUTE $pol$
      CREATE POLICY payments_customer_isolation_select
        ON public.payments
        FOR SELECT
        TO authenticated
        USING (
          public.is_admin()
          OR public.is_active_staff_or_admin()
          OR sale_id IN (
            SELECT s.id FROM public.egg_sales s
            JOIN public.customers c ON c.id = s.customer_id
            WHERE c.clerk_user_id = (auth.jwt() ->> 'sub')
          )
        );
    $pol$;
  END IF;
END $$;

COMMIT;
