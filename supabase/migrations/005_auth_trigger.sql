-- Migration 005: Auth Signup Trigger
-- POULTRY HUB — Automatic Profile Creation on User Registration
--
-- PURPOSE:
--   When Supabase Auth creates a new row in auth.users, this trigger
--   automatically creates the corresponding public.profiles row.
--
-- CRITICAL SECURITY RULES:
--   1. The role is ALWAYS hardcoded to 'STAFF'. No exception.
--   2. The trigger IGNORES all user-supplied metadata including any
--      raw_user_meta_data or app_metadata role field.
--   3. Admin role assignment requires an explicit, authorized, server-side
--      administrative action performed by an existing ADMIN user after account
--      creation. It can never be set through the signup flow.
--   4. is_active defaults to true so the account is usable immediately.
--      Deactivation is an explicit admin action.
--   5. full_name is read from raw_user_meta_data for convenience only.
--      It carries no privilege implications.
--   6. The trigger function uses SECURITY DEFINER with a pinned search_path
--      and runs as the function owner (postgres superuser) so it can insert
--      into profiles even with RLS enabled on that table.

-- ============================================================
-- TRIGGER FUNCTION: handle_new_user
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    role,
    full_name,
    phone,
    avatar_url,
    is_active,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    'STAFF',                                                 -- ALWAYS STAFF. Never trust metadata.
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),      -- Convenience only, no privilege
    NULL,                                                    -- Phone set later via profile update
    NULL,                                                    -- Avatar set later via profile update
    true,
    NOW(),
    NOW()
  );

  RETURN NEW;
END;
$$;

-- Revoke broad execution — this function is invoked by the trigger mechanism
-- (as the trigger owner / postgres superuser), not by application roles directly.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;

-- ============================================================
-- TRIGGER: on_auth_user_created
-- ============================================================
-- Fires AFTER INSERT on auth.users — one row per new signup.
-- AFTER ensures auth.users row is committed before the profile insert.

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
