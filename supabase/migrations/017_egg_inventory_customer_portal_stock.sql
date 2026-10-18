-- ============================================================
-- Migration 017: Egg Inventory Customer Portal Stock Visibility
-- POULTRY HUB — Customer Portal Live Inventory Access
-- ============================================================
--
-- PROBLEM:
--   Migration 012 replaced egg_inventory_select_active_users with
--   egg_inventory_select_staff_or_admin:
--     CREATE POLICY egg_inventory_select_staff_or_admin
--       ON public.egg_inventory FOR SELECT TO authenticated
--       USING (public.is_staff_or_admin());
--
--   Because approved CUSTOMER accounts have role = 'CUSTOMER',
--   public.is_staff_or_admin() evaluates to false. Supabase RLS
--   silently returns 0 rows for egg_inventory to customers.
--   Consequently, the Customer Portal displays all egg products as
--   "Out of Stock" (stock_pieces = 0) even when physical egg_inventory
--   contains 967 eggs.
--
-- SOLUTION:
--   1. Drop egg_inventory_select_staff_or_admin.
--   2. Re-create egg_inventory_select_active_users with:
--        USING (public.is_active_user())
--      This allows all active authenticated users (ADMIN, STAFF, and
--      approved CUSTOMER) to read current stock_pieces by size.
--   3. Maintain strict isolation:
--      - egg_inventory remains read-only for clients (all mutations go
--        through SECURITY DEFINER RPCs like adjust_egg_inventory,
--        record_egg_production, and record_egg_sale).
--      - egg_inventory_transactions remains strictly restricted to
--        is_staff_or_admin() so customers cannot view ledger history.
-- ============================================================

BEGIN;

DROP POLICY IF EXISTS egg_inventory_select_staff_or_admin ON public.egg_inventory;
DROP POLICY IF EXISTS egg_inventory_select_active_users ON public.egg_inventory;

CREATE POLICY egg_inventory_select_active_users
  ON public.egg_inventory
  FOR SELECT
  TO authenticated
  USING (public.is_active_user());

COMMIT;
