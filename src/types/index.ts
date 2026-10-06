/**
 * POULTRY HUB — Domain Type Stubs
 *
 * Domain models and UI types aligned with the approved POULTRY HUB architecture in SKILL.md.
 * NOTE: The PostgreSQL database schema has not yet been applied. These are domain definitions
 * for UI, constants, and application components; they do not imply that database objects exist.
 */

/** User roles supported by the POULTRY HUB RBAC system */
export type UserRole = "ADMIN" | "STAFF";

/**
 * Approved egg sizes in POULTRY HUB:
 * SMALL, MEDIUM, LARGE, EXTRA_LARGE, JUMBO, UNGRADED
 */
export type EggSize =
  | "SMALL"
  | "MEDIUM"
  | "LARGE"
  | "EXTRA_LARGE"
  | "JUMBO"
  | "UNGRADED";

/**
 * Approved packaging types in POULTRY HUB:
 * PIECE (1), TRAY_30 (30), CARTON_12 (12), BOX_360 (360)
 */
export type PackagingType = "PIECE" | "TRAY_30" | "CARTON_12" | "BOX_360";

/** Flock operational lifecycle status — must match the PostgreSQL flock_status enum */
export type FlockStatus = "ACTIVE" | "RETIRED" | "QUARANTINED";

/** Egg sale order and payment status */
export type SaleStatus = "PENDING" | "PAID" | "CANCELLED";

/**
 * Entry type for the append-only flock mortality and culling ledgers:
 * - STANDARD: Normal operational event
 * - CORRECTION_REVERSAL: Compensating reversal referencing a prior entry
 */
export type MortalityCullingEntryType = "STANDARD" | "CORRECTION_REVERSAL";

/**
 * Transaction type for the append-only egg_inventory_transactions ledger
 */
export type EggInventoryTransactionType =
  | "PRODUCTION"
  | "SALE"
  | "ADJUSTMENT"
  | "CORRECTION";

/**
 * Transaction type for the append-only feed_inventory_transactions ledger
 */
export type FeedInventoryTransactionType =
  | "STOCK_RECEIVED"
  | "CONSUMPTION"
  | "ADJUSTMENT"
  | "CORRECTION";
