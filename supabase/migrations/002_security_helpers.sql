-- Migration 002: Security Helper Functions
-- POULTRY HUB RBAC Authorization Helpers
--
-- These SECURITY DEFINER functions are the authoritative authorization primitives
-- used by all subsequent RLS policies and SECURITY DEFINER RPCs.
--
-- CRITICAL RULES:
--   - Every function derives the caller identity exclusively from auth.uid().
--   - No function accepts a user ID, role, or any privilege-related argument.
--   - search_path is pinned to public, pg_temp on every function to prevent
--     search_path injection attacks inside SECURITY DEFINER context.
--   - profiles is the sole RBAC source of truth; auth.users metadata is ignored.
--   - EXECUTE is revoked from PUBLIC and granted only to authenticated.

-- ============================================================
-- 1. is_active_user()
-- ============================================================
-- Returns TRUE when the caller has an active profile record.
-- Used as the base predicate for all non-admin operations.

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
    WHERE  id        = auth.uid()
    AND    is_active = true
  );
$$;

-- ============================================================
-- 2. is_admin()
-- ============================================================
-- Returns TRUE when the caller is an active ADMIN profile.
-- Used as the predicate for all admin-only operations.

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
    WHERE  id        = auth.uid()
    AND    is_active = true
    AND    role      = 'ADMIN'
  );
$$;

-- ============================================================
-- 3. is_staff_or_admin()
-- ============================================================
-- Returns TRUE when the caller is an active profile with any
-- application role (STAFF or ADMIN).
-- Functionally equivalent to is_active_user() given the current
-- two-role model, but provided as an explicit, readable helper
-- so that RLS policies and RPCs express intent unambiguously.

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
    WHERE  id        = auth.uid()
    AND    is_active = true
    AND    role      IN ('STAFF', 'ADMIN')
  );
$$;

-- ============================================================
-- 4. require_active_user()
-- ============================================================
-- Raises a PostgreSQL exception if the caller is not an active
-- authenticated application user.
-- Call at the top of every SECURITY DEFINER RPC before any
-- business logic to enforce authentication as a hard gate.

CREATE OR REPLACE FUNCTION public.require_active_user()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required: no authenticated session found.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NOT public.is_active_user() THEN
    RAISE EXCEPTION 'Access denied: your account is inactive or does not exist.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
END;
$$;

-- ============================================================
-- 5. require_admin()
-- ============================================================
-- Raises a PostgreSQL exception if the caller is not an active
-- ADMIN.  Call at the top of admin-only SECURITY DEFINER RPCs.

CREATE OR REPLACE FUNCTION public.require_admin()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required: no authenticated session found.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: this operation requires the ADMIN role.'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
END;
$$;

-- ============================================================
-- PRIVILEGE CONFIGURATION
-- ============================================================
-- Revoke broad public execution, then grant narrowly.
-- anon role is explicitly excluded — helpers are not needed by
-- unauthenticated callers and must not be callable by them.

REVOKE EXECUTE ON FUNCTION public.is_active_user()    FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_admin()           FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_staff_or_admin()  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.require_active_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.require_admin()      FROM PUBLIC;

-- Grant to authenticated so that:
--   a) RLS policies (which run under the row owner's context) can call them.
--   b) SECURITY DEFINER RPCs granted to authenticated can call them internally.
GRANT EXECUTE ON FUNCTION public.is_active_user()    TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin()           TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff_or_admin()  TO authenticated;
GRANT EXECUTE ON FUNCTION public.require_active_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.require_admin()      TO authenticated;
