-- ============================================================
-- Migration 025: Bank Transfer Receiving Accounts
-- POULTRY HUB — Admin-Managed Bank Transfer Payment Settings
-- ============================================================
--
-- PURPOSE:
--   Creates a bank_transfer_accounts table so administrators can configure
--   the farm's official bank receiving accounts that customers will use when
--   selecting Bank Transfer at checkout.
--
--   Design decisions:
--     * Separate dedicated table (not system_settings key-value) so multiple
--       accounts can be managed independently, with active/inactive toggle,
--       created/updated timestamps, and optional per-account instructions.
--     * bank_name uses TEXT (not an enum) so new banks can be added without
--       a schema migration. The application layer enforces valid values.
--     * account_number is stored as TEXT (can include hyphens/spaces from
--       different banks). Display/copy handled client-side.
--     * Deactivating an account does NOT delete it; existing payment
--       submissions referencing it remain valid historically.
--     * RLS: SELECT (active accounts) open to authenticated users so the
--       customer checkout can read them. INSERT/UPDATE/DELETE restricted to
--       ADMIN only.
--
-- DEPENDENCIES:
--   * Migration 001 (profiles table)
--   * Migration 002 (is_admin() helper)
--   * Migration 015 (customer_payment_submissions table)
--
-- SAFETY:
--   Does NOT touch egg_inventory, egg_sales, or the payments ledger.
--   Non-destructive to existing migrations.
-- ============================================================

BEGIN;

-- ============================================================
-- 1. BANK TRANSFER ACCOUNTS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS public.bank_transfer_accounts (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_name           TEXT        NOT NULL
                        CHECK (char_length(bank_name) BETWEEN 1 AND 100),
  account_holder_name TEXT        NOT NULL
                        CHECK (char_length(account_holder_name) BETWEEN 1 AND 150),
  account_number      TEXT        NOT NULL
                        CHECK (
                          char_length(trim(account_number)) BETWEEN 5 AND 30
                        ),
  instructions        TEXT        NULL
                        CHECK (char_length(instructions) <= 500),
  is_active           BOOLEAN     NOT NULL DEFAULT TRUE,
  display_order       INTEGER     NOT NULL DEFAULT 0,
  created_by          TEXT        REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by          TEXT        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Soft-uniqueness: one account number per bank (case-insensitive, whitespace-trimmed)
  CONSTRAINT bta_unique_account_per_bank UNIQUE (bank_name, account_number)
);

-- ============================================================
-- 2. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_bta_is_active
  ON public.bank_transfer_accounts(is_active);

CREATE INDEX IF NOT EXISTS idx_bta_display_order
  ON public.bank_transfer_accounts(display_order, created_at);

-- Foreign key reference: store which bank account a customer_payment_submission used.
-- We add a nullable FK column to customer_payment_submissions to track the
-- specific receiving account that was selected by the customer.
ALTER TABLE public.customer_payment_submissions
  ADD COLUMN IF NOT EXISTS bank_transfer_account_id UUID
    REFERENCES public.bank_transfer_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cps_bank_transfer_account_id
  ON public.customer_payment_submissions(bank_transfer_account_id)
  WHERE bank_transfer_account_id IS NOT NULL;

-- ============================================================
-- 3. UPDATED_AT TRIGGER
-- ============================================================

DROP TRIGGER IF EXISTS trg_bta_updated_at ON public.bank_transfer_accounts;
CREATE TRIGGER trg_bta_updated_at
  BEFORE UPDATE ON public.bank_transfer_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- 4. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.bank_transfer_accounts ENABLE ROW LEVEL SECURITY;

-- SELECT: All authenticated users can read bank accounts (required at checkout)
-- Inactive accounts are visible to ADMIN for management; customers should
-- filter is_active=TRUE in their queries.
CREATE POLICY bta_select_authenticated
  ON public.bank_transfer_accounts FOR SELECT TO authenticated
  USING (TRUE);

-- INSERT: ADMIN only
CREATE POLICY bta_insert_admin
  ON public.bank_transfer_accounts FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

-- UPDATE: ADMIN only
CREATE POLICY bta_update_admin
  ON public.bank_transfer_accounts FOR UPDATE TO authenticated
  USING   (public.is_admin())
  WITH CHECK (public.is_admin());

-- DELETE: ADMIN only, but should only happen when no payment submissions reference
-- the account. Application layer enforces this check before calling DELETE.
CREATE POLICY bta_delete_admin
  ON public.bank_transfer_accounts FOR DELETE TO authenticated
  USING (public.is_admin());

-- ============================================================
-- 5. TABLE GRANTS
-- ============================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_transfer_accounts TO authenticated;

-- ============================================================
-- 6. COMMENTS
-- ============================================================

COMMENT ON TABLE public.bank_transfer_accounts IS
  'Admin-configured bank receiving accounts displayed to customers at checkout '
  'when Bank Transfer payment method is selected. '
  'Multiple accounts can be active simultaneously. '
  'Deactivating an account hides it from new checkout flows but preserves '
  'historical payment submission records that reference it.';

COMMENT ON COLUMN public.bank_transfer_accounts.bank_name IS
  'Bank name as displayed to the customer. '
  'Supported values: BDO, BPI, LandBank, Metrobank, UnionBank, PNB, '
  'Security Bank, RCBC, Chinabank, Other (free text). '
  'Stored as TEXT to allow future additions without schema migration.';

COMMENT ON COLUMN public.bank_transfer_accounts.account_number IS
  'Official receiving account number. Never auto-generated or invented. '
  'Must be entered by an authorized administrator.';

COMMENT ON COLUMN public.bank_transfer_accounts.is_active IS
  'When FALSE, this account is hidden from customer checkout. '
  'Existing payment submissions that referenced this account remain valid.';

COMMENT ON COLUMN public.customer_payment_submissions.bank_transfer_account_id IS
  'References the specific bank_transfer_accounts row selected by the customer '
  'during checkout. NULL for non-bank-transfer payments or legacy submissions.';

COMMIT;
