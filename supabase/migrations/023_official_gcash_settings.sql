-- ============================================================
-- Migration 023: Official GCash Receiving Settings
-- POULTRY HUB — Farm Official GCash Account Name & Number Settings
-- ============================================================
--
-- PURPOSE:
--   Seeds gcash_account_name and gcash_account_number rows in
--   public.system_settings so Admin users can configure them.
--
-- SAFETY & BACKWARD-COMPATIBILITY:
--   - Non-destructive: uses ON CONFLICT (setting_key) DO NOTHING.
--   - Idempotent: safe to run multiple times.
-- ============================================================

INSERT INTO public.system_settings (setting_key, setting_value, description, updated_by)
VALUES
  (
    'gcash_account_name',
    '""'::jsonb,
    'Official GCash account name for receiving customer egg order payments.',
    NULL
  ),
  (
    'gcash_account_number',
    '""'::jsonb,
    'Official GCash mobile phone number for receiving customer egg order payments.',
    NULL
  )
ON CONFLICT (setting_key) DO NOTHING;
