-- Migration 20261010150500: Guarantee Minimum Active Administrator
-- POULTRY HUB — Concurrency-Safe Active Administrator Protection
--
-- PURPOSE:
--   Guarantees that POULTRY HUB always retains at least one active ADMIN account
--   in public.profiles. Prevents accidental or concurrent demotion, deactivation,
--   or deletion of the final active administrator.
--
-- CONCURRENCY & SERIALIZATION DESIGN:
--   1. Transaction Advisory Lock:
--      Uses pg_advisory_xact_lock(hashtext('poultry_hub_admin_account_lock')) to
--      serialize all concurrent transactions attempting to demote, deactivate,
--      or delete active administrators. Transactions modifying non-admins or
--      updating ordinary profile fields (name, phone, avatar) do NOT acquire
--      this lock and run concurrently without contention.
--
--   2. Two-Tier Defense-in-Depth:
--      a) BEFORE ROW Trigger:
--         - Detects changes away from active ADMIN status.
--         - Acquires the transaction advisory lock.
--         - Marks transaction context via set_config('poultry_hub.admin_modified', 'true', true).
--         - Performs immediate single-row validation (ensures other active admins exist).
--      b) AFTER STATEMENT Trigger:
--         - Executes after all rows in the statement have updated.
--         - Catches multi-row updates (e.g. UPDATE profiles SET role = 'STAFF' WHERE role = 'ADMIN')
--           which cannot be fully evaluated in isolation at the row level.
--         - Ensures remaining active_admin_count >= 1.
--
--   3. Initial Setup & Migration Safety:
--      Triggers execute only when an existing row with (role = 'ADMIN' AND is_active = true)
--      is being altered away from active admin status. Does not block initial schema setup,
--      seed migrations, or staff profile creation before an admin is provisioned.
--
-- NOTE:
--   DO NOT EXECUTE AUTOMATICALLY. This file is prepared for manual review and approval.

BEGIN;

-- ============================================================
-- 1. ROW-LEVEL PROTECTION & LOCK ACQUISITION TRIGGER FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_minimum_active_admins_row()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Only trigger when an active ADMIN is being demoted, deactivated, or deleted
  IF OLD.role = 'ADMIN' AND OLD.is_active = true AND (
    TG_OP = 'DELETE' OR
    NEW.role IS DISTINCT FROM 'ADMIN' OR
    NEW.is_active = false
  ) THEN
    -- 1. Acquire transaction-level advisory lock.
    --    Serializes concurrent transactions attempting to modify active administrators.
    --    Automatically released on COMMIT or ROLLBACK.
    PERFORM pg_advisory_xact_lock(hashtext('poultry_hub_admin_account_lock'));

    -- 2. Mark transaction setting so the statement trigger verifies final table state
    PERFORM set_config('poultry_hub.admin_modified', 'true', true);

    -- 3. Immediate check for single-row modifications:
    --    Ensure at least one OTHER active admin exists excluding this row
    IF (
      SELECT COUNT(*)
      FROM public.profiles
      WHERE role = 'ADMIN'
        AND is_active = true
        AND id != OLD.id
    ) < 1 THEN
      RAISE EXCEPTION 'Operation rejected: Cannot demote or deactivate the only active administrator in the system.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- ============================================================
-- 2. STATEMENT-LEVEL MULTI-ROW VERIFICATION TRIGGER FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION public.verify_minimum_active_admins_stmt()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_remaining_admins INTEGER;
BEGIN
  -- Only evaluate if an active admin was modified in this transaction
  IF current_setting('poultry_hub.admin_modified', true) = 'true' THEN
    -- Reset the transaction setting
    PERFORM set_config('poultry_hub.admin_modified', 'false', true);

    -- Full table verification: guarantees that after all rows in the statement
    -- have been updated/deleted, at least one active administrator remains.
    SELECT COUNT(*)
    INTO v_remaining_admins
    FROM public.profiles
    WHERE role = 'ADMIN' AND is_active = true;

    IF v_remaining_admins < 1 THEN
      RAISE EXCEPTION 'Operation rejected: POULTRY HUB requires at least one active administrator account at all times.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

-- ============================================================
-- 3. ATTACH TRIGGERS TO PUBLIC.PROFILES
-- ============================================================

-- Row-level trigger: locks and validates row changes
DROP TRIGGER IF EXISTS trg_protect_last_admin_row ON public.profiles;
CREATE TRIGGER trg_protect_last_admin_row
  BEFORE UPDATE OR DELETE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_minimum_active_admins_row();

-- Statement-level trigger: guards against multi-row bulk updates
DROP TRIGGER IF EXISTS trg_protect_last_admin_stmt ON public.profiles;
CREATE TRIGGER trg_protect_last_admin_stmt
  AFTER UPDATE OR DELETE ON public.profiles
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.verify_minimum_active_admins_stmt();

-- ============================================================
-- 4. FUNCTION PERMISSIONS
-- ============================================================

REVOKE ALL ON FUNCTION public.check_minimum_active_admins_row() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_minimum_active_admins_stmt() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.check_minimum_active_admins_row() TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_minimum_active_admins_row() TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_minimum_active_admins_stmt() TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_minimum_active_admins_stmt() TO service_role;

COMMIT;
