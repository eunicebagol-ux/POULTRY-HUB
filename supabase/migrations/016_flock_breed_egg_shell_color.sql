-- Migration 016: Add egg_shell_color and breed validation to flocks table
-- Project: POULTRY HUB
-- Reversible: Yes (see 016_flock_breed_egg_shell_color_rollback.sql)

-- 1. Add egg_shell_color column if it does not already exist with default 'Brown'
ALTER TABLE public.flocks
  ADD COLUMN IF NOT EXISTS egg_shell_color TEXT DEFAULT 'Brown';

-- 2. Backfill existing flocks with NULL egg_shell_color to 'Brown'
UPDATE public.flocks
  SET egg_shell_color = 'Brown'
  WHERE egg_shell_color IS NULL;

-- 3. Add constraint to validate permitted egg shell colors
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'flocks_egg_shell_color_check'
  ) THEN
    ALTER TABLE public.flocks
      ADD CONSTRAINT flocks_egg_shell_color_check
      CHECK (egg_shell_color IS NULL OR egg_shell_color IN ('Brown', 'White', 'Cream / Tinted', 'Other'));
  END IF;
END $$;

-- 4. Document column meanings in database schema
COMMENT ON COLUMN public.flocks.breed IS 'Chicken breed (e.g. Lohmann Brown, Hy-Line Brown, ISA Brown, White Leghorn)';
COMMENT ON COLUMN public.flocks.egg_shell_color IS 'Typical or actual egg shell color (Brown, White, Cream / Tinted, Other)';
