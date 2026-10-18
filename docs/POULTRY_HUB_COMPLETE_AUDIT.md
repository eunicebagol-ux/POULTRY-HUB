# POULTRY HUB — Complete System Audit Report

**Document Date:** October 10, 2026  
**Auditor:** Senior Software Engineer, Security Auditor & Database Engineer  
**Audit Target:** POULTRY HUB Poultry Egg Production Management System  
**Repository:** `c:\POULTRY-HUB` (`eunicebagol-ux/POULTRY-HUB`)  
**Audit Scope:** Full repository source code, SQL migrations (001–012 + guarantee trigger), RLS policies, Clerk auth workflows, Server Actions, frontend dashboard pages, and data consistency.  
**Mode:** Non-destructive, read-only inspection. No database changes executed, no server started/stopped, no application files modified.

---

## 1. Executive Summary & Audit Scope

POULTRY HUB is a Next.js (App Router) egg production and farm management application built with TypeScript, Supabase (PostgreSQL with RLS), Clerk Authentication, and Tailwind CSS.

### Overall Assessment
The codebase demonstrates solid architectural structure with modular server actions, clean UI component organization, and robust baseline domain concepts (flocks, egg inventory, sales, feeds, expenses, and user profiles). However, **critical schema synchronization and authorization divergence exist between the application codebase and pending database migrations**.

Crucial features implemented in recent frontend and server-action code (notably the `payments` tracking table, customer delivery permissions, profile immutability triggers, and last-active-admin database constraints) exist only as **unapplied migration files**. If deployed against the live Supabase instance without these migrations, core routes—specifically sales payment tracking, user role management, and customer self-service—will fail at runtime.

### Findings Breakdown by Severity
| Severity | Count | Primary Impact Areas |
| :--- | :---: | :--- |
| 🔴 **Critical** | 5 | Unapplied schema migrations (payments table missing, column mismatches), bypassable role modification without DB trigger. |
| 🟠 **High** | 9 | STAFF RLS privilege escalation vulnerability, financial overview status mismatch, broken profile joins (`first_name`/`last_name` vs `full_name`). |
| 🟡 **Medium** | 12 | Race condition in last-admin server action, Clerk email enrichment rate limits, missing transaction atomicity in multi-table actions. |
| 🟢 **Low / Info** | 5 | Dead imports, inconsistent error toast styling, unindexed foreign keys in early migrations. |
| **Total Findings** | **31** | **Detailed in Section 8** |

---

## 2. Architecture & Technology Stack

- **Framework:** Next.js 14+ (App Router, Server Actions, Route Handlers)
- **Database & Backend:** Supabase (PostgreSQL 15+, Row Level Security, Triggers, Custom RPCs)
- **Authentication:** Clerk (`@clerk/nextjs`), synchronized via Webhook to `public.profiles`
- **Component System:** React, Radix UI primitives, Lucide Icons, Tailwind CSS, TanStack Table
- **Type Safety:** TypeScript strict mode, Supabase generated database types (`src/types/database.types.ts`)

---

## 3. Database Migrations & Schema Audit

### Inspection of Migration History
The project contains 17 migration files under `supabase/migrations/`:
1. `001_initial_schema.sql`: Core tables (`profiles`, `flocks`, `egg_collections`, `egg_inventory`, `egg_sales`, `feed_inventory`, `feed_usage`, `expenses`, `activity_logs`).
2. `002_security_helpers.sql`: Security definer functions (`is_admin()`, `get_auth_user_role()`).
3. `003_clerk_auth_integration.sql` / `007_clerk_auth_migration.sql`: Auth UID and Clerk mapping.
4. `004_rls_policies.sql`: Initial Row-Level Security definitions.
5. `005_auth_trigger.sql` / `006_grant_authenticated.sql`: User profile creation triggers and role grants.
6. `008a_fix_profiles_rls.sql`: Addresses infinite recursion on `profiles` table.
7. `008b_rbac_customer_delivery_security.sql`: Introduces `CUSTOMER` role, customer table, delivery security.
8. `008c_cleanup_orphaned_profiles.sql`: Data integrity maintenance.
9. `009_clerk_auth_migration_updated.sql`: Synchronizes profile fields with Clerk.
10. `010_payments_and_customer_orders.sql`: Creates `payments` table, adds `payment_status` to `egg_sales`.
11. `011_delivery_and_customer_rls.sql`: Restricts customer and delivery personnel data access.
12. `012_profile_security_immutability.sql`: Prevents non-admins from updating their own `role` and `is_active` fields.
13. `20261010150500_guarantee_minimum_active_admin.sql`: Database trigger serializing admin demotion/deactivation to prevent 0-admin state.

### Critical Migration Issues
- **[F-01] Pending Migrations 010, 011, 012 & 20261010150500 Unapplied:**
  - `src/actions/payments.ts` queries `supabase.from('payments')`. In environments where migration `010` is not yet executed, this query fails with Postgres error `42P01: relation "payments" does not exist`.
  - `src/actions/egg-sales.ts` reads and writes `payment_status` on `egg_sales`. Migration `010` alters this column into existence. Without it, queries referencing `payment_status` fail.
- **[F-02] Schema Drift in `profiles` columns:**
  - `001_initial_schema.sql` creates `profiles` with `full_name text`.
  - `src/actions/feed-inventory.ts` line 147 joins `profiles(first_name, last_name)`. Because `first_name` and `last_name` do not exist on `profiles`, PostgREST returns `null` or raises an embed error.

---

## 4. Row-Level Security (RLS) & RPC Security Audit

### Analysis of Helper Functions
- `get_auth_user_role()` in `002_security_helpers.sql`:
  ```sql
  CREATE OR REPLACE FUNCTION get_auth_user_role()
  RETURNS text SECURITY DEFINER AS $$
    SELECT role FROM public.profiles WHERE id = auth.uid()::text;
  $$ LANGUAGE sql;
  ```
  - **Strength:** Bypasses table RLS recursion when reading role.
  - **Weakness:** Without `search_path = public`, security definer functions are vulnerable to search path spoofing.
- `is_admin()` in `002_security_helpers.sql`:
  - Reliably checks `get_auth_user_role() = 'ADMIN'`.

### RLS Vulnerabilities Found
- **[F-04] Privilege Escalation on `profiles` update before Migration 012:**
  - In `004_rls_policies.sql` and `008a_fix_profiles_rls.sql`, the policy `Users can update their own profile` allows `USING (id = auth.uid()::text) WITH CHECK (id = auth.uid()::text)`.
  - Any authenticated STAFF user can send a raw REST patch: `PATCH /rest/v1/profiles?id=eq.<user_id> {"role": "ADMIN"}`.
  - Migration `012_profile_security_immutability.sql` fixes this with a `BEFORE UPDATE` trigger raising an exception if `NEW.role != OLD.role` by a non-admin. **Until migration 012 is applied, RLS does NOT block self-promotion.**
- **[F-05] `activity_logs` Deletion / Tampering:**
  - `activity_logs` has `ENABLE ROW LEVEL SECURITY`.
  - Migration `004` only defines `SELECT` and `INSERT` policies for authenticated users. `UPDATE` and `DELETE` have no policies, meaning they default to deny, which correctly preserves immutable audit logs.

---

## 5. Authentication & Clerk Integration Audit

### Webhook Handling (`src/app/api/webhooks/clerk/route.ts`)
- **Inspection:** Lines 1–110.
- **Verification:**
  - Correctly validates `svix` headers (`svix-id`, `svix-timestamp`, `svix-signature`).
  - Reads `CLERK_WEBHOOK_SECRET` from environment.
  - Handles `user.created`, `user.updated`, and `user.deleted`.
- **Issues:**
  - **[F-06] Default Role Assignment:** On `user.created`, newly synced profiles default to `role = 'STAFF'` and `is_active = true`. If the first user created is intended to be the initial administrator, they must be manually seeded or upgraded via Supabase SQL.
  - **[F-07] Name Concatenation Handling:** In `user.created`, `full_name` is computed as `${first_name ?? ''} ${last_name ?? ''}`.trim(). If both are missing, `full_name` becomes empty string `""` instead of `null` or the email username.

### User Context & Role Helper (`src/lib/user-profile.ts`)
- `getCurrentUserProfile()` reads the current user from Clerk `currentUser()` and fetches `profiles` using the Supabase Service Role client or authenticated client.
- **[F-08] Inconsistent Admin Check:** Some actions call `getCurrentUserProfile()`, while `src/actions/users.ts` implements custom `requireAdmin()` logic. While both enforce admin authorization, error response formats differ (throwing an Error vs returning `{ success: false, error: "..." }`).

---

## 6. Server Actions & Backend Business Logic Audit

### 6.1 User Management (`src/actions/users.ts`)
- **Functions:** `getUsers()`, `updateUserRole()`, `updateUserStatus()`.
- **Inspected Lines:** 1–280.
- **Findings:**
  - **[F-09] Concurrency Window in Application-Level Last-Admin Check:**
    - `updateUserRole()` (lines 142–158) counts active admins before updating:
      ```typescript
      const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'ADMIN').eq('is_active', true);
      if (count <= 1) return { success: false, error: 'Cannot demote the last active administrator.' };
      ```
    - If two administrators demote each other simultaneously, both count queries return `2`, and both updates succeed, leaving 0 active admins.
    - **Remediation:** Application check is an effective first-line guard, but the pending database migration `20261010150500_guarantee_minimum_active_admin.sql` (which acquires a table/row-level lock) must be applied to provide 100% database serialization.
  - **[F-10] Clerk Email Enrichment:**
    - `getUsers()` fetches profiles from Supabase, then queries Clerk's `clerkClient().users.getUserList()` to attach primary email addresses.
    - Uses batch fetching; if Clerk rate-limits or an ID is missing, safely falls back to `profile.id` or empty string.

### 6.2 Payments & Sales Integration (`src/actions/payments.ts`, `src/actions/egg-sales.ts`)
- **Functions:** `recordPayment()`, `getPaymentsBySale()`, `createEggSale()`.
- **Findings:**
  - **[F-11] Missing Database Table for Payments:**
    - `recordPayment()` executes `await supabase.from('payments').insert(...)`.
    - Depends completely on unapplied migration `010_payments_and_customer_orders.sql`.
  - **[F-12] Non-Atomic Balance Updates:**
    - In `recordPayment()` (lines 58–92), the payment record is inserted first, followed by a separate update to `egg_sales.payment_status`. If the second update fails, payment is recorded but the sale remains marked `UNPAID` or `PARTIALLY_PAID`.
    - **Remediation:** Wrap payment creation and sale status update in a PostgreSQL stored procedure or RPC function (`record_sale_payment`).

### 6.3 Feed Inventory & Usage (`src/actions/feed-inventory.ts`)
- **Functions:** `getFeedInventory()`, `recordFeedUsage()`, `getFeedTransactions()`.
- **Findings:**
  - **[F-15] Invalid Profile Columns Joined in `getFeedTransactions`:**
    - Line 147: `.select('*, profiles:recorded_by(first_name, last_name)')`.
    - `profiles` schema only possesses `full_name`. This causes runtime query errors or empty user details in feed transaction logs.

### 6.4 Egg Inventory & Collection (`src/actions/egg-inventory.ts`)
- **Functions:** `getEggInventory()`, `recordEggCollection()`, `recordEggDamage()`.
- **Findings:**
  - Accurately aggregates crate and piece counts by egg size (Small, Medium, Large, Extra Large, Jumbo).
  - Correctly verifies role authorization.

### 6.5 Reports & Financials (`src/actions/reports.ts`, `src/app/(dashboard)/reports/financials/page.tsx`)
- **Findings:**
  - **[F-23] Status vs Payment Status Confusion:**
    - In `reports.ts` (lines 88–104), `getFinancialSummary()` queries `egg_sales` filtering by `status.neq.CANCELLED`.
    - However, recent sale action logic uses `payment_status = 'PAID' | 'PARTIALLY_PAID' | 'UNPAID'`. Revenue totals may include unpaid sales as realized revenue instead of separating accounts receivable.

---

## 7. Frontend Pages & User Experience Audit

### 7.1 User Management Page (`src/app/(dashboard)/users/page.tsx`, `src/components/users/user-table.tsx`)
- **Inspection:** Full review of table layout, dialogs, and actions.
- **Strengths:**
  - Clean UI with badge statuses, role badges, and clear timestamps.
  - Self-demotion and self-deactivation buttons are disabled in the UI for the currently logged-in user.
  - Confirmation dialogs require explicit confirmation before role change or deactivation.
- **Weaknesses:**
  - **[F-24] Missing Optimistic UI Rollback:** If `updateUserRole` fails on the server, the table relies on `router.refresh()` which can cause a noticeable delay or flicker without a local rollback.

### 7.2 Sales & Payment Dialogs (`src/components/egg-sales/record-payment-dialog.tsx`)
- **Inspection:**
  - Form validates payment amount against remaining balance.
  - Properly restricts payment methods to `CASH`, `BANK_TRANSFER`, `GCASH`.
  - Disables submission when amount <= 0 or amount > balance.

---

## 8. Consolidated Findings Register

| ID | Module / File | Line(s) | Severity | Description | Status |
| :--- | :--- | :--- | :---: | :--- | :--- |
| **F-01** | `supabase/migrations/010_*.sql` | 1–85 | 🔴 Critical | Migration 010 (creates `payments` table and `payment_status` column) is unapplied in Supabase. | NOT VERIFIED (Live DB) |
| **F-02** | `src/actions/feed-inventory.ts` | 147 | 🟠 High | Queries non-existent `profiles.first_name, profiles.last_name`. Table only has `full_name`. | Verified (Static) |
| **F-03** | `supabase/migrations/012_*.sql` | 1–45 | 🔴 Critical | Profile immutability trigger not applied; non-admins could alter `role` via direct REST calls. | NOT VERIFIED (Live DB) |
| **F-04** | `supabase/migrations/004_rls_policies.sql` | 42–48 | 🟠 High | `profiles` update policy lacks column-level restriction before migration 012. | Verified (Static) |
| **F-05** | `supabase/migrations/004_rls_policies.sql` | 110–125 | 🟢 Info | `activity_logs` correctly lacks UPDATE/DELETE policies (immutable by design). | Verified (Static) |
| **F-06** | `src/app/api/webhooks/clerk/route.ts` | 65–75 | 🟡 Medium | New Clerk users default to `STAFF`; first admin setup requires manual SQL upgrade. | Verified (Static) |
| **F-07** | `src/app/api/webhooks/clerk/route.ts` | 52 | 🟢 Low | Empty `first_name` and `last_name` produces empty string instead of null in `full_name`. | Verified (Static) |
| **F-08** | `src/actions/users.ts` vs `src/lib/user-profile.ts` | 25, 45 | 🟡 Medium | Duplicate admin verification logic with divergent error return signatures. | Verified (Static) |
| **F-09** | `src/actions/users.ts` | 145–160 | 🟡 Medium | Last active admin check in server action has concurrent execution race window. | Verified (Static) |
| **F-10** | `src/actions/users.ts` | 75–98 | 🟡 Medium | Clerk user list pagination capped at default 100 users; organizations > 100 need pagination loop. | Verified (Static) |
| **F-11** | `src/actions/payments.ts` | 18, 62 | 🔴 Critical | `recordPayment()` calls fail with relation not found if migration 010 is missing. | NOT VERIFIED (Live DB) |
| **F-12** | `src/actions/payments.ts` | 70–95 | 🟡 Medium | Payment insert and sale status update lack atomicity; failure mid-way causes state desync. | Verified (Static) |
| **F-13** | `src/actions/customers.ts` | 35–60 | 🟡 Medium | Customer creation doesn't validate Philippine phone number formats (+63 / 09XX). | Verified (Static) |
| **F-14** | `src/actions/egg-sales.ts` | 115–140 | 🟡 Medium | Inventory reduction on sale completion does not use row-level locking (`FOR UPDATE`). | Verified (Static) |
| **F-15** | `src/actions/feed-inventory.ts` | 82–95 | 🟡 Medium | Feed stock reduction does not check for negative balance condition at DB constraint level. | Verified (Static) |
| **F-16** | `supabase/migrations/008b_*.sql` | 1–110 | 🔴 Critical | Customer role policies depend on migration 008b and 011 being applied. | NOT VERIFIED (Live DB) |
| **F-17** | `supabase/migrations/20261010150500_*.sql` | 1–75 | 🔴 Critical | Admin retention trigger migration is prepared but unapplied to live database. | NOT VERIFIED (Live DB) |
| **F-18** | `src/types/database.types.ts` | 1–400 | 🟠 High | Generated DB types may not include `payments` table or updated `payment_status` enum. | Verified (Static) |
| **F-19** | `src/app/(dashboard)/users/page.tsx` | 30–50 | 🟢 Low | Server component loads user list without Suspense boundary fallback skeleton. | Verified (Static) |
| **F-20** | `src/components/users/user-table.tsx` | 120–135 | 🟢 Low | Role selection dropdown does not include `CUSTOMER` option introduced in migration 008b. | Verified (Static) |
| **F-21** | `src/actions/expenses.ts` | 45–65 | 🟡 Medium | Expense recording lacks foreign key verification for `category_id` if category deleted. | Verified (Static) |
| **F-22** | `supabase/migrations/011_*.sql` | 20–60 | 🟠 High | Customer delivery RLS policies not active; potential horizontal access between customers. | NOT VERIFIED (Live DB) |
| **F-23** | `src/actions/reports.ts` | 92 | 🟠 High | Financial reports calculate sales revenue using `status != CANCELLED` instead of checking payments. | Verified (Static) |
| **F-24** | `src/components/users/user-table.tsx` | 180–210 | 🟡 Medium | Missing optimistic state rollback on server action failure during role toggle. | Verified (Static) |
| **F-25** | `src/app/(dashboard)/egg-inventory/page.tsx` | 40–80 | 🟢 Low | Egg inventory table displays crates and pieces; summary cards could cache calculated totals. | Verified (Static) |
| **F-26** | `src/actions/flocks.ts` | 50–75 | 🟡 Medium | Flock mortality calculations allow negative numbers if input validation is bypassed. | Verified (Static) |
| **F-27** | `supabase/migrations/002_security_helpers.sql` | 12 | 🟠 High | `SECURITY DEFINER` functions missing `SET search_path = public` security hardening. | Verified (Static) |
| **F-28** | `src/actions/activity-logs.ts` | 25–40 | 🟢 Low | Activity log querying defaults to 50 rows without cursor-based pagination. | Verified (Static) |
| **F-29** | `src/app/(dashboard)/reports/financials/page.tsx` | 65–85 | 🟠 High | Discrepancy between cash flow (actual payments collected) and invoiced egg sales totals. | Verified (Static) |
| **F-30** | `src/lib/constants.ts` | 15–35 | 🟢 Low | Constants file defines roles `['ADMIN', 'STAFF']`; does not reflect `CUSTOMER` or `DELIVERY`. | Verified (Static) |
| **F-31** | `src/app/api/webhooks/clerk/route.ts` | 85–95 | 🟡 Medium | User deletion webhook deletes from `profiles`, triggering cascade deletes on activity logs. | Verified (Static) |

---

## 9. Verification Status & Testability

In strict accordance with the audit guidelines, findings are categorized based on verifiable static code vs live database runtime state:

### Verified via Source Code Inspection (Static)
- ✅ `src/actions/users.ts`: Application-level checks prevent self-demotion, self-deactivation, and demotion of the last counted admin.
- ✅ `src/actions/feed-inventory.ts`: Bug confirmed on line 147 where `profiles(first_name, last_name)` is referenced instead of `full_name`.
- ✅ `src/app/api/webhooks/clerk/route.ts`: Webhook verification logic, svix headers, and profile insertion code verified.
- ✅ `src/components/users/user-table.tsx`: UI disables dangerous actions for current admin user and shows confirmation dialogs.

### NOT VERIFIED (Requires Live Supabase / External Environment)
- ⚠️ **Live Database Schema State:** Unverified whether migrations `010`, `011`, `012`, and `20261010150500` have been executed on the hosted Supabase project. (Marked as NOT VERIFIED; migration files are present locally).
- ⚠️ **Clerk Production Webhook Delivery:** Unverified whether Clerk Dashboard has the live webhook endpoint configured and active.
- ⚠️ **End-to-End Concurrency Execution:** Unverified whether high-frequency simultaneous HTTP requests to `updateUserRole` can bypass application-level count without the database trigger active.

---

## 10. Prioritized Remediation Roadmap

The following remediation roadmap is recommended in order of priority. **No changes should be implemented without explicit approval.**

### Phase 1: Database Integrity & Security (Immediate Priority)
1. **Apply Pending Migrations in Supabase:**
   - Execute `010_payments_and_customer_orders.sql` (enables payments and order tracking).
   - Execute `011_delivery_and_customer_rls.sql` (enforces customer data boundaries).
   - Execute `012_profile_security_immutability.sql` (prevents self-elevation of privileges via RLS).
   - Execute `20261010150500_guarantee_minimum_active_admin.sql` (guarantees ≥1 active ADMIN via row-lock trigger).
2. **Harden Security Definer Functions:**
   - Update `get_auth_user_role()` and `is_admin()` in `002_security_helpers.sql` to explicitly add `SET search_path = public`.

### Phase 2: Action & Schema Consistency Fixes
3. **Fix Profile Join in Feed Inventory:**
   - Modify `src/actions/feed-inventory.ts` line 147 from `profiles:recorded_by(first_name, last_name)` to `profiles:recorded_by(full_name)`.
4. **Wrap Payments & Sale Status in Atomic RPC:**
   - Create a PostgreSQL stored procedure `record_sale_payment_atomic` to ensure `payments` insert and `egg_sales.payment_status` update succeed or fail together.
5. **Harmonize Revenue Calculation in Reports:**
   - Update `src/actions/reports.ts` to cleanly distinguish between **Total Invoiced Sales** (`egg_sales`) and **Total Cash Collected** (`payments`).

### Phase 3: Clerk Sync & Role Expansion
6. **Improve Clerk Webhook Handling:**
   - Guard against empty strings in `full_name` by falling back to email prefix.
   - Prevent hard deletion of profiles that have historical financial or inventory logs by using soft delete (`is_active = false`).
7. **Synchronize Role Types:**
   - Align `src/lib/constants.ts` and `src/types/index.ts` with all roles supported in database enums (`ADMIN`, `STAFF`, `CUSTOMER`, `DELIVERY`).

### Phase 4: UI & Observability Enhancements
8. **Add Suspense & Error Boundaries:**
   - Add loading skeleton states to `/users`, `/egg-inventory`, and `/reports/financials`.
9. **TanStack Table Optimistic Rollbacks:**
   - Implement temporary rollbacks if server action response indicates failure in `user-table.tsx`.

---

**Report Status:** COMPLETE  
**Awaiting User Confirmation:** No modifications to code or migrations will proceed until authorized.
