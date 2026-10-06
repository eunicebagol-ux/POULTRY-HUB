-- Migration 008a: Expand User Role Enum
-- POULTRY HUB — Adds CUSTOMER and DELIVERY to user_role type

-- Note: ADD VALUE must run outside a transaction block.
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'CUSTOMER';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'DELIVERY';
