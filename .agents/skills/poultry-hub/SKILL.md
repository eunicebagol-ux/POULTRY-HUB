---
name: poultry-hub
description: >-
  POULTRY HUB Engineering Development Skill. Complete project-level instructions,
  architecture rules, database design, RLS/RPC security standards, UI/UX guidelines,
  development phases, verification checklists, and Definition of Done for the
  POULTRY HUB Poultry Egg Production Management System.
---

# POULTRY HUB — Project Engineering Skill

> **Read this skill in full before writing any code, migration, RPC, RLS policy,
> or UI component for the POULTRY HUB project.**

---

## 1. Project Purpose

POULTRY HUB is a web-based, professional-grade Poultry Egg Production Management System
designed to help manage egg production, flock management, feed inventory, egg sales,
expenses, and basic farm operations.

This is a real production system. It must behave like one.

---

## 2. Technology Stack

| Layer | Technology |
|---|---|
| Framework | Next.js (current stable, App Router, TypeScript strict) |
| UI Components | shadcn/ui preset `b2p9JDUT` (`base-nova` style) |
| Styling | Tailwind CSS v4 (shadcn preset configuration) |
| Icons | Lucide React |
| State / Forms | React Hook Form + Zod |
| Charts | Recharts |
| Notifications | Sonner |
| Date Utilities | date-fns |
| Database | PostgreSQL 17 via Supabase (project: `tlvjjgpmxwcfhixxpsei`) |
| Auth | Supabase Auth with `@supabase/ssr` (HttpOnly cookie sessions) |
| Authorization | Supabase Row Level Security (RLS) |
| Business Logic | PostgreSQL SECURITY DEFINER RPC functions |
| Runtime | Node.js (Windows PowerShell — use `npm.cmd` / `npx.cmd`) |

---

## 3. User Roles

### ADMIN
- Full system access.
- Manage users (create, deactivate, change roles).
- Full CRUD on all entities.
- Receive feed stock (only admins can add feed intake).
- Make inventory adjustments and corrections.
- Void or cancel sales and expenses.
- View all activity logs.
- Manage all system settings.

### STAFF
- Login and view dashboard.
- Record daily egg production (via RPC).
- Record daily feed consumption (via RPC).
- Create permitted sales (via RPC — stock deducted atomically).
- View active flock information.
- View inventory levels (read-only).
- Record permitted operational expenses.
- Manage their own profile (name, phone, avatar only).
- **Cannot:** manage users, access admin settings, view audit logs, void/delete records,
  make inventory adjustments, receive feed stock, or perform unauthorized destructive operations.

---

## 4. Security Architecture

### 4.1 Defense-in-Depth
Authorization is always enforced at **three layers in order of precedence**:
1. **PostgreSQL RLS** (database-level, ultimate authority — cannot be bypassed by the client).
2. **Server Actions / Middleware** (application-level guard — rejects unauthorized server calls).
3. **UI Visibility** (UX only — hide admin controls from staff, but never rely on this alone).

### 4.2 Authentication
- Supabase Auth manages identity via HttpOnly, Secure, SameSite cookies via `@supabase/ssr`.
- The browser client is created via `createBrowserClient`.
- The server client is created via `createServerClient` with the Next.js cookie store.
- The admin utility uses the service-role key (`createClient` with `SUPABASE_SERVICE_ROLE_KEY`)
  — server-side only.

### 4.3 Critical Security Rules
- `SUPABASE_SERVICE_ROLE_KEY` must **NEVER** be prefixed with `NEXT_PUBLIC_`.
- `SUPABASE_SERVICE_ROLE_KEY` must **NEVER** be imported in browser/client components.
- Passwords, API keys, JWTs, and service-role secrets must **NEVER** appear in:
  - SQL migration files
  - seed files
  - source code
  - Git commits
  - documentation
  - terminal output summaries
- New user signups always default to `STAFF` role. The `handle_new_user()` trigger
  **ignores all user metadata** for the role field and hardcodes `'STAFF'`.
- Admin role assignment requires an explicit authorized server-side administrative action.

### 4.4 Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL          — Safe for browser bundle
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY — Safe for browser bundle (publishable/anon key)
SUPABASE_SERVICE_ROLE_KEY         — SERVER-SIDE ONLY, never NEXT_PUBLIC_
NEXT_PUBLIC_APP_URL               — Safe for browser bundle
```

---

## 5. Database Architecture

### 5.1 Supabase Project
- **Project Name:** POULTRY HUB
- **Project Ref:** `tlvjjgpmxwcfhixxpsei`
- **API URL:** `https://tlvjjgpmxwcfhixxpsei.supabase.co`
- **Database Engine:** PostgreSQL 17

### 5.2 Complete Table List (18 Tables)

#### Master / Operational Tables
1. `profiles` — User extension & RBAC (extends `auth.users`)
2. `flocks` — Laying hen batch management (snapshot of `current_bird_count`)
3. `egg_production` — Daily collection header records
4. `egg_production_sizes` — Normalized egg sizing breakdown
5. `egg_inventory` — Live egg stock snapshot by size
6. `feed_inventory` — Feed stock snapshot by feed type
7. `feed_consumption` — Daily flock feeding operational records
8. `customers` — Client directory (buyers)
9. `suppliers` — Vendor directory (feed, meds, packaging)
10. `egg_sales` — Sales invoice headers
11. `egg_sale_items` — Invoice line items (packaging & size)
12. `expenses` — Farm operating expense records
13. `system_settings` — Farm configuration (single-row)

#### Ledger / Audit Tables (APPEND-ONLY — NO UPDATE/DELETE EVER)
14. `flock_mortality` — Immutable bird mortality event ledger
15. `flock_culling` — Immutable bird culling event ledger
16. `egg_inventory_transactions` — Immutable egg stock movement ledger
17. `feed_inventory_transactions` — Immutable feed stock movement ledger
18. `activity_logs` — System-wide immutable audit trail

### 5.3 Key Business Constraints

**Egg Production Integrity:**
```sql
CHECK (total_eggs = good_eggs + damaged_eggs + cracked_eggs)
UNIQUE (flock_id, production_date, collection_shift)
-- Enforced via RPC: SUM(sizes.quantity) = good_eggs
```

**Egg Sizes (exact values, no others):**
- `SMALL`, `MEDIUM`, `LARGE`, `EXTRA_LARGE`, `JUMBO`, `UNGRADED`

**Packaging Types:**
- `PIECE` (×1), `TRAY_30` (×30), `CARTON_12` (×12), `BOX_360` (×360)

**Currency / Locale:**
- Default: Philippine Peso (`PHP` / `₱`)
- Configurable via `system_settings`

**Flock Bird Count Safety:**
- `current_bird_count` is maintained by mortality/culling triggers.
- `current_bird_count` can NEVER become negative (trigger validates).
- `current_bird_count <= initial_bird_count` (CHECK constraint).

### 5.4 Ledger Immutability Rules

The following tables are **strictly append-only**:
- `flock_mortality`
- `flock_culling`
- `egg_inventory_transactions`
- `feed_inventory_transactions`
- `activity_logs`

**No UPDATE or DELETE RLS policy may ever be created for these tables.**
**No administrative bypass is permitted to rewrite historical ledger records.**

Corrections are represented by new **compensating/reversal records**:
- `flock_mortality` and `flock_culling` support `entry_type`:
  - `STANDARD` — Normal mortality/culling event.
  - `CORRECTION_REVERSAL` — Corrects a prior erroneous entry.
    Must include `reference_entry_id` pointing to the original record.

### 5.5 Inventory Snapshot Maintenance
- `egg_inventory.stock_pieces` and `feed_inventory.current_stock_kg` are
  **snapshot balances only**.
- They are updated **exclusively** by atomic PostgreSQL RPC procedures.
- **Direct client INSERT/UPDATE/DELETE on inventory snapshot tables is forbidden.**
- Every balance change creates a corresponding ledger entry in the appropriate
  transaction table in the same database transaction.

---

## 6. RLS Strategy

### 6.1 Helper Functions (SECURITY DEFINER)
```sql
public.is_admin()        — Returns TRUE if auth.uid() is ADMIN and is_active
public.is_active_staff() — Returns TRUE if auth.uid() is active (any role)
```

### 6.2 Policy Summary

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `profiles` | Own or Admin | Admin only | Own (personal) or Admin (all) | Admin only |
| `flocks` | Active users | Active users | Active users | Admin only |
| `flock_mortality` | Active users | Via RPC only | **FORBIDDEN** | **FORBIDDEN** |
| `flock_culling` | Active users | Via RPC only | **FORBIDDEN** | **FORBIDDEN** |
| `egg_production` | Active users | Via RPC only | Admin or author ≤24h | Admin only |
| `egg_production_sizes` | Active users | Via RPC only | Via RPC only | Admin only |
| `egg_inventory` | Active users | **FORBIDDEN** (direct) | **FORBIDDEN** (direct) | **FORBIDDEN** |
| `egg_inventory_transactions` | Active users | Via RPC only | **FORBIDDEN** | **FORBIDDEN** |
| `feed_inventory` | Active users | Admin via RPC | Admin via RPC | **FORBIDDEN** |
| `feed_inventory_transactions` | Active users | Via RPC only | **FORBIDDEN** | **FORBIDDEN** |
| `feed_consumption` | Active users | Active via RPC | Admin only | Admin only |
| `customers` | Active users | Active users | Active users | Admin only |
| `suppliers` | Active users | Active users | Active users | Admin only |
| `egg_sales` | Active users | Active via RPC | Admin or author (PENDING only) | Admin only |
| `egg_sale_items` | Active users | Via RPC only | Via RPC only | Admin only |
| `expenses` | Active users | Active users | Admin only | Admin only |
| `activity_logs` | Admin only | Via RPC/trigger | **FORBIDDEN** | **FORBIDDEN** |
| `system_settings` | Active users | Admin only | Admin only | **FORBIDDEN** |

---

## 7. RPC Security Standards

### 7.1 Every SECURITY DEFINER RPC Must:
- Include `SET search_path = public, pg_temp;`
- Derive the caller using `v_user_id := auth.uid();`
- Reject unauthenticated callers: `IF v_user_id IS NULL THEN RAISE EXCEPTION`
- Verify the profile exists and is active
- Verify the role for admin-only operations
- **Never trust client-supplied `recorded_by`, `performed_by`, or `user_id`**
- Use `SELECT ... FOR UPDATE` on rows where balances or counts are changed
- Prevent negative inventory or bird counts (reject with informative exception)
- Perform all related mutations atomically (all succeed or all fail)
- Insert a corresponding `activity_logs` audit entry before commit
- `REVOKE EXECUTE ON FUNCTION FROM PUBLIC;`
- `GRANT EXECUTE ON FUNCTION TO authenticated;`

### 7.2 Required Core RPCs

#### `record_egg_production()`
- Callers: ADMIN, STAFF
- Validates: active flock, `total_eggs = good_eggs + damaged_eggs + cracked_eggs`,
  `SUM(sizes.quantity) = good_eggs`
- Inserts: `egg_production`, `egg_production_sizes`
- Locks and updates: `egg_inventory` by size with `FOR UPDATE`
- Creates: `PRODUCTION` entries in `egg_inventory_transactions`
- Logs: `activity_logs` entry `action = 'RECORD_PRODUCTION'`

#### `record_egg_sale()`
- Callers: ADMIN, STAFF
- **PostgreSQL is the sole authority for ALL financial totals and inventory deductions.**
- Locks: `egg_inventory` rows with `FOR UPDATE` before any validation
- Validates: sufficient stock per size before any insert
- Computes (server-side):
  - `total_pieces = package_quantity * packaging_multiplier`
  - `line_total = package_quantity * unit_price`
  - `subtotal = SUM(line_totals)`
  - `0 <= discount <= subtotal`
  - `total_amount = subtotal - discount`
- Inserts: `egg_sales`, `egg_sale_items`
- Creates: `SALE` entries in `egg_inventory_transactions` (negative quantity)
- Updates: `egg_inventory.stock_pieces`
- Logs: `activity_logs` entry `action = 'CREATE_SALE'`
- **Client-supplied totals are ignored. Only raw inputs (sizes, quantities, unit prices) are accepted.**

#### `record_feed_consumption()`
- Callers: ADMIN, STAFF
- Locks: `feed_inventory` row with `FOR UPDATE`
- Validates: `current_stock_kg >= quantity_kg`
- Inserts: `feed_consumption`
- Creates: `CONSUMPTION` entry in `feed_inventory_transactions`
- Updates: `feed_inventory.current_stock_kg`
- Logs: `activity_logs` entry `action = 'RECORD_FEED_CONSUMPTION'`

#### `record_feed_stock_intake()`
- Callers: ADMIN only (enforced)
- Locks: `feed_inventory` row with `FOR UPDATE`
- Validates: `quantity_kg > 0`
- Creates: `STOCK_RECEIVED` entry in `feed_inventory_transactions`
- Updates: `feed_inventory.current_stock_kg`
- Optionally updates `cost_per_kg` if provided
- Logs: `activity_logs` entry `action = 'FEED_STOCK_RECEIVED'`

#### `adjust_egg_inventory()`
- Callers: ADMIN only (enforced)
- Locks: `egg_inventory` row with `FOR UPDATE`
- Validates: resulting `stock_pieces >= 0`
- Computes delta: `delta = new_stock_pieces - current_stock_pieces`
- Creates: `ADJUSTMENT` or `CORRECTION` entry in `egg_inventory_transactions`
- Updates: `egg_inventory.stock_pieces`
- Requires: reason/notes (not optional)
- Logs: `activity_logs` entry `action = 'EGG_INVENTORY_ADJUSTED'`

#### `record_flock_mortality()`
- Callers: ADMIN, STAFF
- Supports `entry_type`: `STANDARD`, `CORRECTION_REVERSAL`
- Validates on `CORRECTION_REVERSAL`:
  - `reference_entry_id` exists and belongs to the same flock
  - The original entry has not already been reversed (prevent double-reversal)
  - Resulting `current_bird_count >= 0`
- Locks: `flocks` row with `FOR UPDATE`
- Inserts: `flock_mortality` (append-only)
- Updates: `flocks.current_bird_count` with directional delta
- Logs: `activity_logs` entry `action = 'RECORD_MORTALITY'`

#### `record_flock_culling()`
- Same structure as `record_flock_mortality()` for culling events
- Logs: `activity_logs` entry `action = 'RECORD_CULLING'`

---

## 8. Audit Logging Requirements

The following operations **must** generate an `activity_logs` entry atomically
within the same transaction:
- Egg production creation / update
- Flock mortality recording / reversal
- Flock culling recording / reversal
- Egg inventory adjustment / correction
- Feed stock receipt
- Feed consumption recording
- Egg sale creation / void / cancellation
- Expense creation / update / deletion
- User role change
- User account activation / deactivation
- Important system settings changes

---

## 9. Mortality & Culling Correction Strategy

When a mortality or culling record contains a data error:
1. Do NOT modify the original ledger row.
2. Create a new `CORRECTION_REVERSAL` record referencing the original via `reference_entry_id`.
3. The correction record quantity must be the **exact signed amount to restore the correct balance**.
4. The correction and bird count update occur in the same atomic transaction.
5. Both original and correction records remain permanently visible in the ledger.
6. A mandatory justification note is required on the reversal record.

---

## 10. Sales Integrity Rules

- The client submits: customer, sale date, line items (size, packaging type, package quantity,
  unit price), and discount amount.
- The server (PostgreSQL RPC) calculates and validates all other values:
  - `total_pieces` per line
  - line totals
  - subtotal
  - discount bounds
  - final `total_amount`
- If any line item has insufficient inventory, the **entire transaction is rejected**.
- The client must **never** supply pre-calculated totals or inventory delta values.

---

## 11. Folder Structure

```
C:\POULTRY-HUB\
├── .agents\
│   └── skills\
│       └── poultry-hub\
│           └── SKILL.md            ← This file
├── .env.example
├── .env.local                      ← NEVER committed
├── .gitignore
├── components.json                 ← shadcn preset b2p9JDUT (base-nova)
├── next.config.ts
├── package.json
├── postcss.config.mjs
├── tailwind.config.ts
├── tsconfig.json                   ← strict mode required
├── supabase\
│   └── migrations\
│       ├── 001_initial_tables.sql
│       ├── 002_security_helpers.sql
│       ├── 003_atomic_rpc_procedures.sql
│       ├── 004_rls_policies.sql
│       ├── 005_auth_trigger.sql
│       └── 006_baseline_seed.sql
└── src\
    ├── app\
    │   ├── (auth)\
    │   │   ├── login\page.tsx
    │   │   ├── forgot-password\page.tsx
    │   │   └── layout.tsx
    │   ├── (dashboard)\
    │   │   ├── layout.tsx
    │   │   ├── page.tsx              ← Dashboard
    │   │   ├── flocks\
    │   │   ├── egg-production\
    │   │   ├── egg-inventory\
    │   │   ├── feed-inventory\
    │   │   ├── feed-consumption\
    │   │   ├── egg-sales\
    │   │   ├── expenses\
    │   │   ├── customers\
    │   │   ├── suppliers\
    │   │   ├── reports\
    │   │   ├── users\               ← ADMIN ONLY
    │   │   ├── activity-logs\       ← ADMIN ONLY
    │   │   ├── settings\            ← ADMIN ONLY
    │   │   └── profile\
    │   ├── globals.css
    │   ├── layout.tsx
    │   ├── loading.tsx
    │   ├── not-found.tsx
    │   └── error.tsx
    ├── components\
    │   ├── ui\                      ← shadcn primitives
    │   ├── layout\                  ← Sidebar, Header, MobileNav, Breadcrumbs
    │   ├── dashboard\               ← StatCard, Charts, AlertBanners
    │   ├── forms\                   ← ProductionForm, SaleForm, FlockForm...
    │   ├── tables\                  ← Reusable DataTable
    │   ├── shared\                  ← ConfirmDialog, EmptyState, StatusBadge
    │   └── providers\               ← AuthProvider, ThemeProvider
    ├── lib\
    │   ├── supabase\
    │   │   ├── client.ts            ← createBrowserClient
    │   │   ├── server.ts            ← createServerClient (cookies)
    │   │   ├── middleware.ts        ← session refresh helper
    │   │   └── admin.ts             ← service role client (server-side ONLY)
    │   ├── utils.ts                 ← formatCurrency (₱), formatDate, cn
    │   ├── constants.ts             ← EGG_SIZES, PACKAGING_TYPES, etc.
    │   └── validations\             ← Zod schemas
    ├── actions\                     ← Next.js Server Actions
    │   ├── flocks.ts
    │   ├── mortality.ts
    │   ├── culling.ts
    │   ├── egg-production.ts
    │   ├── egg-sales.ts
    │   ├── feed.ts
    │   ├── expenses.ts
    │   ├── customers.ts
    │   ├── suppliers.ts
    │   ├── users.ts
    │   └── settings.ts
    ├── types\
    │   ├── database.types.ts        ← Supabase generated types
    │   └── index.ts                 ← Domain models, UI view types
    ├── hooks\
    └── middleware.ts                ← Root Next.js middleware
```

---

## 12. UI / UX Standards

### 12.1 Design Philosophy
- **Professional agricultural enterprise SaaS** — not a school CRUD demo.
- shadcn/ui `base-nova` preset — preserve it, do not replace with generic defaults.
- Clean, data-focused, accessible, responsive.
- Consistent use of `shadcn/ui` components throughout.

### 12.2 Required UX States
Every data-driven view must implement **all four states**:
1. **Loading state** — Use `skeleton` components while data is fetching.
2. **Empty state** — Descriptive message (e.g., *"No egg production records yet. Record the first collection."*). Never show blank or broken UI.
3. **Error state** — User-friendly message with retry option. Log technical error to console.
4. **Success feedback** — `sonner` toast notification on successful mutations.

### 12.3 Destructive Operations
- All delete, void, or cancel operations require a `ConfirmDialog` (shadcn `AlertDialog`)
  before execution.
- The confirm dialog must clearly state the action and its consequences.

### 12.4 Form Validation
- All forms use React Hook Form + Zod.
- Client-side validation for immediate user feedback.
- Server-side validation in Server Actions or RPC for authoritative enforcement.
- Display field-level validation errors inline.

### 12.5 Forbidden UI Patterns
- No fake/placeholder data in the UI.
- No hardcoded test records displayed as real data.
- No disabled fields silently passing values to the server.
- No client-side calculation of financial totals that are also calculated server-side
  without cross-validating the server result.

---

## 13. Development Phases

### Phase 0 — Foundation (COMPLETED WHEN SKILL IS INSTALLED)
- [x] Next.js project bootstrapped at `C:\POULTRY-HUB\`
- [x] shadcn/ui preset `b2p9JDUT` initialized
- [x] Required packages installed
- [ ] Supabase SSR clients configured (`src/lib/supabase/`)
- [ ] `.env.local` created (credentials, never committed)
- [ ] `.env.example` created (variable names only)
- [ ] Database migrations written and applied
- [ ] RLS enabled on all 18 tables
- [ ] Auth trigger installed (`handle_new_user()` → defaults to STAFF)
- [ ] Baseline seed applied (system_settings, egg_inventory rows)
- [ ] `npm.cmd run build` passes with zero errors
- [ ] Git status clean (excluding `.env.local` and `node_modules`)

### Phase 1 — Auth & Application Shell
- [ ] Login page (email + password)
- [ ] Forgot password / reset password flow
- [ ] Session middleware (route guard + token refresh)
- [ ] App layout (sidebar, header, breadcrumbs)
- [ ] Role-aware sidebar navigation
- [ ] User profile page
- [ ] Admin vs Staff role indicator

### Phase 2 — Flocks & Egg Production Core
- [ ] Flock management (list, create, edit, status)
- [ ] Flock detail page (tabs: overview, mortality, culling, production history)
- [ ] Mortality log (record, view, correction/reversal)
- [ ] Culling log (record, view, correction/reversal)
- [ ] Egg production recording (with sizing validation)
- [ ] Egg inventory view (stock by size, tray conversion, alerts)
- [ ] Egg inventory transactions ledger view

### Phase 3 — Feed Inventory & Consumption
- [ ] Feed inventory view (stock in kg, reorder alerts)
- [ ] Feed stock intake form (Admin only)
- [ ] Feed consumption recording
- [ ] Feed inventory transactions ledger
- [ ] Feed Conversion Ratio (FCR) calculations

### Phase 4 — Commercial Operations
- [ ] Customer directory
- [ ] Egg sales invoice creation (atomic RPC)
- [ ] Invoice detail / print view
- [ ] Farm expenses recording and categorization
- [ ] Payment status tracking

### Phase 5 — Suppliers & Dashboard
- [ ] Supplier/vendor directory
- [ ] Operational dashboard (KPI cards, production trend chart)
- [ ] Low stock warnings
- [ ] Today's summary (production, sales, expenses)

### Phase 6 — Reporting, Administration & Audit
- [ ] Production reports (daily, weekly, monthly)
- [ ] Financial P&L report
- [ ] Flock performance & mortality analytics
- [ ] Feed efficiency (FCR) report
- [ ] Staff / user management (Admin)
- [ ] Activity audit log viewer (Admin)
- [ ] System settings editor (Admin)

### Phase 7 — QA & Hardening
- [ ] End-to-end browser testing (all user journeys)
- [ ] RLS policy testing (verify staff cannot bypass restrictions)
- [ ] Concurrency testing (concurrent sales deducting same inventory)
- [ ] Negative inventory prevention verification
- [ ] TypeScript strict mode — zero errors
- [ ] Accessibility audit (keyboard navigation, ARIA)
- [ ] Responsive layout testing (mobile, tablet, desktop)
- [ ] Performance profiling

---

## 14. Git Rules

- The repository is `C:\POULTRY-HUB\` with root `.git`.
- **NEVER commit `.env.local`** or any file containing secrets.
- `.gitignore` must exclude: `.env.local`, `node_modules/`, `.next/`.
- Commit only after a successful `npm.cmd run build`.
- Each phase gets a clear commit message: `feat(phase-0): initialize project foundation`.
- Show `git status` and `git diff --stat` before every commit.
- Never force-push to main without explicit user approval.

---

## 15. Verification Checklist (Before Declaring Any Phase Complete)

Before reporting a phase as done, verify:

### Code Quality
- [ ] `npm.cmd run build` — exit code 0, zero errors
- [ ] `npm.cmd run lint` — zero errors (warnings may be acceptable)
- [ ] TypeScript strict mode — no `any`, no implicit any, no type suppressions

### Security
- [ ] No secrets in source code, SQL files, or documentation
- [ ] `SUPABASE_SERVICE_ROLE_KEY` not in any `NEXT_PUBLIC_*` variable
- [ ] Service role client not imported in client components
- [ ] RLS enabled on all 18 tables (verify via Supabase MCP or SQL)
- [ ] Ledger tables have zero UPDATE/DELETE policies
- [ ] Auth trigger defaults new users to STAFF

### Database
- [ ] All 18 tables exist with correct constraints and indexes
- [ ] All required RPCs deployed with SECURITY DEFINER and correct grants
- [ ] All RLS policies applied and correct
- [ ] Baseline seed applied (system_settings, egg_inventory rows)

### UI/UX
- [ ] All four states implemented (loading, empty, error, success)
- [ ] No fake/hardcoded data displayed
- [ ] Destructive operations require confirmation
- [ ] Forms validate client-side and server-side

---

## 16. Forbidden Shortcuts

The following are explicitly prohibited and must never be implemented:

1. Trusting client-supplied financial totals in sales.
2. Trusting client-supplied inventory delta values.
3. Using middleware or UI guards as the sole authorization mechanism (RLS is required).
4. Allowing direct `INSERT/UPDATE/DELETE` on `egg_inventory` or `feed_inventory` from client.
5. Allowing `UPDATE` or `DELETE` on ledger tables (`flock_mortality`, `flock_culling`,
   `egg_inventory_transactions`, `feed_inventory_transactions`, `activity_logs`).
6. Defaulting new users to ADMIN via signup metadata.
7. Putting service-role keys in `NEXT_PUBLIC_*` variables.
8. Displaying fake or seeded business data as real production data.
9. Skipping Zod validation on Server Actions.
10. Proceeding to the next development phase without passing the verification checklist.
11. Implementing destructive operations without confirmation dialogs.
12. Creating inventory adjustments without admin role verification.
13. Allowing negative `current_bird_count`, `stock_pieces`, or `current_stock_kg`.
14. Storing redundant calculated values (e.g., pre-computing totals that can be derived).

---

## 17. Packaging Multipliers (Authoritative Reference)

| Packaging Type | Pieces per Unit |
|---|---|
| `PIECE` | 1 |
| `TRAY_30` | 30 |
| `CARTON_12` | 12 |
| `BOX_360` | 360 |

Default primary wholesale unit: **TRAY_30**.
Default tray capacity configurable via `system_settings.default_tray_capacity` (default: 30).

---

## 18. Current Project State (as of Phase 0 initialization)

- **Repository:** `C:\POULTRY-HUB\` — root Git repo on branch `main`, no commits yet.
- **Next.js:** `v16.3.8` (current stable resolved by `create-next-app@latest`)
- **React:** `v19.2.8`
- **shadcn/ui:** Preset `b2p9JDUT` applied, style `base-nova`, Tailwind CSS v4.
- **Packages installed:** `@supabase/supabase-js`, `@supabase/ssr`, `react-hook-form`,
  `zod`, `date-fns`, `recharts`, `sonner`, `lucide-react`, `@base-ui/react`.
- **Supabase Project:** `tlvjjgpmxwcfhixxpsei` — ACTIVE_HEALTHY, 0 public tables.
- **Database:** PostgreSQL 17.11 — clean slate, no migrations applied yet.
- **Pending (Phase 0 completion):**
  - Supabase SSR client files (`src/lib/supabase/`)
  - `.env.local` and `.env.example`
  - All 6 migration files written
  - Migrations applied to Supabase
  - Baseline seed applied
  - Build verification
  - Initial Git commit

---

## 19. Definition of Done

A feature or phase is **Done** when:

1. All Phase verification checklist items are checked.
2. `npm.cmd run build` exits with code 0.
3. Zero TypeScript errors in strict mode.
4. Zero ESLint errors.
5. RLS verified on all affected tables.
6. No secrets in source files or commits.
7. All four UI states implemented for all data views.
8. No fake data used in demonstration or testing.
9. Git status is clean (only `.env.local` in untracked/ignored).
10. The feature has been explicitly reported to the user with a full summary.
11. User has explicitly approved progression to the next phase.
