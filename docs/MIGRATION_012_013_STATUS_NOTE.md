# POULTRY HUB — Database Migration Notice: Migrations 012 & 013 Status

**Document Date:** October 11, 2026  
**Status:** Canonical Migration Guidance  

---

## 1. Authoritative Customer Portal Migration: `012_customer_portal_rbac.sql`

* **File:** `supabase/migrations/012_customer_portal_rbac.sql` (967 lines)
* **Designation:** **INTENDED & AUTHORITATIVE** Customer Portal RBAC Migration.
* **Scope & Hardening:**
  1. Expands `public.user_role` enum with `'CUSTOMER'` (Step 1, standalone auto-commit).
  2. Adds `customers.clerk_user_id TEXT` with `UNIQUE` constraint and `FOREIGN KEY REFERENCES public.profiles(id) ON DELETE RESTRICT`.
  3. Introduces authoritative security helper functions: `is_staff_or_admin()`, `require_staff_or_admin()`, and `get_current_customer_id()`.
  4. Enforces profile role and status immutability via `trg_enforce_profile_role_immutability` trigger and updated RLS on `public.profiles`.
  5. Implements multi-tenant data isolation on `customers`, `egg_sales`, `egg_sale_items`, and `payments`.
  6. Hardens all 13 internal farm operational tables (`flocks`, `feed`, `egg_production`, `expenses`, `suppliers`, etc.) restricting access strictly to active `STAFF` and `ADMIN`.
  7. Secures all 6 core business RPC procedures with `require_staff_or_admin()`.

---

## 2. Superseded Migration: `013_customer_self_registration_portal.sql`

* **File:** `supabase/migrations/013_customer_self_registration_portal.sql` (247 lines)
* **Designation:** **SUPERSEDED — DO NOT APPLY AFTER MIGRATION 012.**
* **Rationale:**
  * Migration 013 is an incomplete, earlier/divergent draft prepared during iterative feature development.
  * It duplicates schema definitions already provided in Migration 012 (`user_role` enum addition and `customers.clerk_user_id` linkage).
  * It defines divergent helper function names (`is_active_staff_or_admin()` vs. `is_staff_or_admin()`).
  * It creates conflicting RLS policies (`customers_update_policy` vs. `customers_update_staff_or_admin`), which would grant customers direct write access to the `customers` table and punch a hole through Migration 012's strict staff/admin management model.
  * It completely omits internal table hardening and RPC security protections.

> [!WARNING]
> **OPERATIONAL INSTRUCTION:**  
> Migration 013 must **NOT** be applied to any environment running Migration 012.  
> It is retained in the repository strictly to maintain local file continuity and Git version history. Any future self-registration enhancements must be designed as a new forward-facing migration that builds upon the security foundation established by Migration 012.

---

## 3. Rollback Procedure Reference

* **Rollback Script:** `supabase/migrations/012_rollback.sql`
* If Migration 012 must be rolled back, `012_rollback.sql` restores the baseline security policies (`is_active_user()`), drops the profile role immutability trigger, and reverts all 6 core RPC procedures to call `require_active_user()`.
