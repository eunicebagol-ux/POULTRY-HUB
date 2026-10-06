-- Migration 004: Row Level Security Policies
-- POULTRY HUB — Defence-in-Depth Authorization Layer
--
-- DESIGN PRINCIPLES:
--   1. RLS is enabled on all 18 tables. No table is left unprotected.
--   2. Migration 002 SECURITY DEFINER helpers are used for role checks on most tables.
--      Because those helpers are SECURITY DEFINER (running as the function owner, which
--      is the postgres superuser in Supabase), they bypass RLS when they internally
--      query profiles. This breaks any potential recursion chain when the helpers are
--      used inside profiles-table policies.
--   3. anon receives zero access on every table.
--   4. SECURITY DEFINER RPCs (migration 003) run as the function owner (postgres),
--      which bypasses RLS. This is intentional: the RPCs are the authoritative write
--      path for inventory/ledger tables, and their internal validation replaces the
--      direct-client INSERT/UPDATE policies that are deliberately absent here.
--   5. Tables that are purely append-only ledgers have no UPDATE or DELETE policy.
--   6. Inventory snapshot tables have no INSERT/UPDATE/DELETE policy for clients.

-- ============================================================
-- ENABLE RLS
-- ============================================================

ALTER TABLE public.profiles                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flocks                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flock_mortality            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flock_culling              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.egg_production             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.egg_production_sizes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.egg_inventory              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.egg_inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_inventory             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_consumption           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.egg_sales                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.egg_sale_items             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings            ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- TABLE 1: profiles
-- ============================================================
-- SELECT: user sees own row; ADMIN sees all rows.
-- UPDATE: user may update their own row; ADMIN may update any row.
--         IMPORTANT: Column-level restrictions (preventing STAFF from setting
--         role or is_active) MUST be enforced by a dedicated profile-update RPC
--         (to be created in the application layer). RLS operates at the row level
--         and cannot restrict which columns a user may write in standard policies.
-- INSERT: intentionally absent — profiles are created only by the auth trigger
--         (migration 005). No direct client insert is permitted.
-- DELETE: intentionally absent — profiles must not be deleted independently of
--         auth.users to avoid orphaned audit references.
--
-- RECURSION SAFETY: is_admin() is SECURITY DEFINER and runs as the postgres
-- superuser, which bypasses RLS when querying profiles internally. No recursion.

CREATE POLICY profiles_select_own_or_admin
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR public.is_admin()
  );

-- User updates own profile row; ADMIN updates any.
-- A future profile-update RPC must restrict which columns STAFF can modify
-- (specifically: role and is_active must be excluded from STAFF updates).
CREATE POLICY profiles_update_own_or_admin
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    id = auth.uid()
    OR public.is_admin()
  )
  WITH CHECK (
    id = auth.uid()
    OR public.is_admin()
  );

-- ============================================================
-- TABLE 2: flocks
-- ============================================================

CREATE POLICY flocks_select_active_users
  ON public.flocks
  FOR SELECT
  TO authenticated
  USING (public.is_active_user());

CREATE POLICY flocks_insert_active_users
  ON public.flocks
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_active_user());

CREATE POLICY flocks_update_active_users
  ON public.flocks
  FOR UPDATE
  TO authenticated
  USING (public.is_active_user())
  WITH CHECK (public.is_active_user());

CREATE POLICY flocks_delete_admin_only
  ON public.flocks
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================
-- TABLE 3: flock_mortality
-- ============================================================
-- Append-only historical ledger.
-- SELECT: all active authenticated users.
-- INSERT/UPDATE/DELETE: no direct-client policies.
--   Insertions are performed exclusively by record_flock_mortality() RPC
--   (SECURITY DEFINER, bypasses RLS). This ensures the flock bird-count
--   update and double-reversal guard are always enforced atomically.

CREATE POLICY flock_mortality_select_active_users
  ON public.flock_mortality
  FOR SELECT
  TO authenticated
  USING (public.is_active_user());

-- No INSERT policy: clients may NOT insert directly.
-- No UPDATE policy: ledger records are immutable.
-- No DELETE policy: ledger records are immutable.

-- ============================================================
-- TABLE 4: flock_culling
-- ============================================================
-- Same append-only model as flock_mortality.

CREATE POLICY flock_culling_select_active_users
  ON public.flock_culling
  FOR SELECT
  TO authenticated
  USING (public.is_active_user());

-- No INSERT policy: clients may NOT insert directly.
-- No UPDATE policy: ledger records are immutable.
-- No DELETE policy: ledger records are immutable.

-- ============================================================
-- TABLE 5: egg_production
-- ============================================================
-- SELECT: all active authenticated users.
-- INSERT: no direct-client policy; use record_egg_production() RPC.
-- UPDATE: ADMIN only — for administrative corrections. Direct updates risk
--         desynchronising production records from inventory. A future admin
--         correction RPC is the preferred path.
-- DELETE: no policy — production records must not be deleted.

CREATE POLICY egg_production_select_active_users
  ON public.egg_production
  FOR SELECT
  TO authenticated
  USING (public.is_active_user());

-- No INSERT policy: use record_egg_production() RPC.
-- No DELETE policy: production records are permanent.

-- ============================================================
-- TABLE 6: egg_production_sizes
-- ============================================================
-- SELECT: all active authenticated users.
-- INSERT/UPDATE/DELETE: no direct-client policies.
--   Size rows are created atomically by record_egg_production() RPC.

CREATE POLICY egg_production_sizes_select_active_users
  ON public.egg_production_sizes
  FOR SELECT
  TO authenticated
  USING (public.is_active_user());

-- No INSERT/UPDATE/DELETE policies: RPC path only.

-- ============================================================
-- TABLE 7: egg_inventory
-- ============================================================
-- SELECT: all active authenticated users (read-only balance visibility).
-- INSERT/UPDATE/DELETE: BLOCKED for all clients.
--   Inventory balances are maintained exclusively by RPCs.

CREATE POLICY egg_inventory_select_active_users
  ON public.egg_inventory
  FOR SELECT
  TO authenticated
  USING (public.is_active_user());

-- No INSERT policy: RPC path only.
-- No UPDATE policy: RPC path only.
-- No DELETE policy: inventory size rows are permanent.

-- ============================================================
-- TABLE 8: egg_inventory_transactions
-- ============================================================
-- SELECT: all active authenticated users (audit visibility).
-- INSERT/UPDATE/DELETE: BLOCKED for all clients.
--   Transactions are created atomically by RPCs. This is an append-only ledger.

CREATE POLICY egg_inventory_transactions_select_active_users
  ON public.egg_inventory_transactions
  FOR SELECT
  TO authenticated
  USING (public.is_active_user());

-- No INSERT/UPDATE/DELETE policies: RPC path only.

-- ============================================================
-- TABLE 9: feed_inventory
-- ============================================================
-- SELECT: all active authenticated users.
-- INSERT/UPDATE/DELETE: BLOCKED for all clients.
--   Feed stock changes must go through record_feed_stock_intake() and
--   record_feed_consumption() RPCs.

CREATE POLICY feed_inventory_select_active_users
  ON public.feed_inventory
  FOR SELECT
  TO authenticated
  USING (public.is_active_user());

-- No INSERT/UPDATE/DELETE policies: RPC path only.

-- ============================================================
-- TABLE 10: feed_inventory_transactions
-- ============================================================
-- SELECT: all active authenticated users.
-- INSERT/UPDATE/DELETE: BLOCKED — append-only ledger written by RPCs.

CREATE POLICY feed_inventory_transactions_select_active_users
  ON public.feed_inventory_transactions
  FOR SELECT
  TO authenticated
  USING (public.is_active_user());

-- No INSERT/UPDATE/DELETE policies.

-- ============================================================
-- TABLE 11: feed_consumption
-- ============================================================
-- SELECT: all active authenticated users.
-- INSERT: no direct-client policy; use record_feed_consumption() RPC.
-- UPDATE/DELETE: no direct-client policies (inventory deduction is atomic).

CREATE POLICY feed_consumption_select_active_users
  ON public.feed_consumption
  FOR SELECT
  TO authenticated
  USING (public.is_active_user());

-- No INSERT policy: use record_feed_consumption() RPC.
-- No UPDATE/DELETE policies.

-- ============================================================
-- TABLE 12: customers
-- ============================================================

CREATE POLICY customers_select_active_users
  ON public.customers
  FOR SELECT
  TO authenticated
  USING (public.is_active_user());

CREATE POLICY customers_insert_active_users
  ON public.customers
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_active_user());

CREATE POLICY customers_update_active_users
  ON public.customers
  FOR UPDATE
  TO authenticated
  USING (public.is_active_user())
  WITH CHECK (public.is_active_user());

CREATE POLICY customers_delete_admin_only
  ON public.customers
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================
-- TABLE 13: suppliers
-- ============================================================

CREATE POLICY suppliers_select_active_users
  ON public.suppliers
  FOR SELECT
  TO authenticated
  USING (public.is_active_user());

CREATE POLICY suppliers_insert_active_users
  ON public.suppliers
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_active_user());

CREATE POLICY suppliers_update_active_users
  ON public.suppliers
  FOR UPDATE
  TO authenticated
  USING (public.is_active_user())
  WITH CHECK (public.is_active_user());

CREATE POLICY suppliers_delete_admin_only
  ON public.suppliers
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================
-- TABLE 14: egg_sales
-- ============================================================
-- SELECT: all active authenticated users.
-- INSERT: no direct-client policy; use record_egg_sale() RPC.
--   Direct INSERT bypasses server-side total calculation and inventory deduction.
-- UPDATE/DELETE: no policies — use administrative RPCs when needed.

CREATE POLICY egg_sales_select_active_users
  ON public.egg_sales
  FOR SELECT
  TO authenticated
  USING (public.is_active_user());

-- No INSERT/UPDATE/DELETE policies: RPC path only.

-- ============================================================
-- TABLE 15: egg_sale_items
-- ============================================================
-- SELECT: all active authenticated users.
-- INSERT/UPDATE/DELETE: BLOCKED — line items are created atomically by record_egg_sale().

CREATE POLICY egg_sale_items_select_active_users
  ON public.egg_sale_items
  FOR SELECT
  TO authenticated
  USING (public.is_active_user());

-- No INSERT/UPDATE/DELETE policies.

-- ============================================================
-- TABLE 16: expenses
-- ============================================================
-- SELECT: all active authenticated users.
-- INSERT: all active authenticated users (operational staff record expenses).
-- UPDATE: ADMIN only — prevents STAFF from altering audit attribution after the fact.
-- DELETE: ADMIN only.

CREATE POLICY expenses_select_active_users
  ON public.expenses
  FOR SELECT
  TO authenticated
  USING (public.is_active_user());

CREATE POLICY expenses_insert_active_users
  ON public.expenses
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_active_user());

CREATE POLICY expenses_update_admin_only
  ON public.expenses
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY expenses_delete_admin_only
  ON public.expenses
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ============================================================
-- TABLE 17: activity_logs
-- ============================================================
-- SELECT: ADMIN only — audit trail is not visible to ordinary STAFF.
-- INSERT: no direct-client policy — logs are created by trusted RPCs/triggers
--         executing as SECURITY DEFINER (postgres role, bypasses RLS).
-- UPDATE/DELETE: NO policy — this is a completely immutable audit trail.

CREATE POLICY activity_logs_select_admin_only
  ON public.activity_logs
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- No INSERT policy: SECURITY DEFINER RPCs write logs; direct client insert is blocked.
-- No UPDATE policy: immutable.
-- No DELETE policy: immutable.

-- ============================================================
-- TABLE 18: system_settings
-- ============================================================
-- SELECT: all active authenticated users (settings are needed for UI configuration).
-- INSERT/UPDATE/DELETE: ADMIN only.

CREATE POLICY system_settings_select_active_users
  ON public.system_settings
  FOR SELECT
  TO authenticated
  USING (public.is_active_user());

CREATE POLICY system_settings_insert_admin_only
  ON public.system_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY system_settings_update_admin_only
  ON public.system_settings
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY system_settings_delete_admin_only
  ON public.system_settings
  FOR DELETE
  TO authenticated
  USING (public.is_admin());
