-- Migration 0119: Expand user_role enum to include CUSTOMER and DELIVERY
-- Must run in its own migration so the enum addition is committed before subsequent migrations use it.
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'CUSTOMER';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'DELIVERY';
