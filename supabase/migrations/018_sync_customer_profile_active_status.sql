-- ============================================================
-- Migration 018: Customer Entity Active Status Synchronization & RLS
-- POULTRY HUB — Customer Portal Profile-Customer Linkage
-- ============================================================
--
-- PURPOSE:
--   1. Ensure public.customers.is_active is immediately synchronized
--      with public.profiles.is_active for all linked customer records.
--   2. Install a PostgreSQL trigger on public.profiles to automatically
--      propagate active status updates to the linked customer record
--      whenever an administrator approves or updates a customer profile.
--   3. Update customers_select_scoped RLS policy to allow authenticated
--      customers to view their own customer record (by clerk_user_id)
--      even if the account status is pending approval, preventing
--      false "not linked" errors and circular RLS lookups.
-- ============================================================

BEGIN;

-- 1. Synchronize any existing drift between profiles and customers
UPDATE public.customers c
SET    is_active = p.is_active,
       updated_at = NOW()
FROM   public.profiles p
WHERE  c.clerk_user_id = p.id
  AND  c.is_active IS DISTINCT FROM p.is_active;

-- 2. Trigger function to keep customers.is_active synchronized with profiles.is_active
CREATE OR REPLACE FUNCTION public.sync_customer_profile_active_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    UPDATE public.customers
    SET    is_active = NEW.is_active,
           updated_at = NOW()
    WHERE  clerk_user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_customer_profile_active_status ON public.profiles;

CREATE TRIGGER trg_sync_customer_profile_active_status
  AFTER UPDATE OF is_active ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_customer_profile_active_status();

-- 3. Update customers_select_scoped policy
-- Allow staff/admin to view all customers, and customers to view their own record
DROP POLICY IF EXISTS customers_select_scoped ON public.customers;

CREATE POLICY customers_select_scoped ON public.customers
  FOR SELECT TO authenticated
  USING (
    public.is_staff_or_admin()
    OR id = public.get_current_customer_id()
    OR clerk_user_id = (auth.jwt() ->> 'sub')
  );

COMMIT;
