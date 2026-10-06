-- Migration 006: Baseline Seed
-- POULTRY HUB — Minimum Structural Bootstrap Data
--
-- PURPOSE:
--   This seed installs the minimum rows required for the application to
--   function correctly from the very first user session. It is NOT sample
--   data, demo data, or test data. Every row here is structural.
--
-- WHAT THIS SEEDS:
--   1. egg_inventory  — One zero-balance row per canonical egg size.
--      Required so that SELECT queries on egg_inventory always return all
--      six sizes (even before any production is recorded), and so that
--      the ON CONFLICT upsert path in record_egg_production() has a stable
--      target row without relying on the first production event to create it.
--
--   2. system_settings — Farm configuration defaults.
--      The application reads system_settings at startup for currency,
--      locale, tray capacity, and farm identity. At least one valid row
--      per setting key must exist before the UI can render correctly.
--
-- WHAT THIS DOES NOT SEED:
--   - No user accounts.
--   - No flocks, production, sales, inventory transactions, or expenses.
--   - No fake or demonstration business records of any kind.
--
-- IDEMPOTENCY:
--   All inserts use ON CONFLICT DO NOTHING so the migration is safe to
--   re-run without creating duplicates.

-- ============================================================
-- 1. EGG INVENTORY — Zero-balance rows for all six canonical sizes
-- ============================================================
-- These rows must exist before any production RPC runs.
-- stock_pieces is intentionally 0 — no eggs have been produced yet.
-- updated_at is set to the migration run time as a baseline timestamp.

INSERT INTO public.egg_inventory (size, stock_pieces, updated_at)
VALUES
  ('SMALL',       0, NOW()),
  ('MEDIUM',      0, NOW()),
  ('LARGE',       0, NOW()),
  ('EXTRA_LARGE', 0, NOW()),
  ('JUMBO',       0, NOW()),
  ('UNGRADED',    0, NOW())
ON CONFLICT (size) DO NOTHING;

-- ============================================================
-- 2. SYSTEM SETTINGS — Default farm configuration
-- ============================================================
-- updated_by is NULL because no profiles exist at migration time.
-- The first ADMIN user should review and update these via the settings UI.

INSERT INTO public.system_settings (setting_key, setting_value, description, updated_by)
VALUES
  (
    'farm_name',
    '"POULTRY HUB Farm"'::jsonb,
    'Display name of the farm shown in reports and UI headers.',
    NULL
  ),
  (
    'currency_code',
    '"PHP"'::jsonb,
    'ISO 4217 currency code used throughout the application.',
    NULL
  ),
  (
    'currency_symbol',
    '"₱"'::jsonb,
    'Currency symbol displayed in financial figures.',
    NULL
  ),
  (
    'default_tray_capacity',
    '30'::jsonb,
    'Number of eggs per standard tray. Used for tray-equivalent display calculations.',
    NULL
  ),
  (
    'timezone',
    '"Asia/Manila"'::jsonb,
    'IANA timezone identifier for the farm. Used for date display and report generation.',
    NULL
  ),
  (
    'date_format',
    '"YYYY-MM-DD"'::jsonb,
    'Preferred date display format for the UI.',
    NULL
  ),
  (
    'low_feed_threshold_kg',
    '50'::jsonb,
    'Feed stock level (in kg) below which a low-stock alert is triggered.',
    NULL
  ),
  (
    'low_egg_inventory_threshold_pieces',
    '300'::jsonb,
    'Egg inventory level (in pieces per size) below which a low-stock alert is triggered.',
    NULL
  )
ON CONFLICT (setting_key) DO NOTHING;
