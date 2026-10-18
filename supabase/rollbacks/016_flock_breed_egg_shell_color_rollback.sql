-- Rollback for Migration 016
-- Project: POULTRY HUB

ALTER TABLE public.flocks
  DROP CONSTRAINT IF EXISTS flocks_egg_shell_color_check;

ALTER TABLE public.flocks
  DROP COLUMN IF EXISTS egg_shell_color;
