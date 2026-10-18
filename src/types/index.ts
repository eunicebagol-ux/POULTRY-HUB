/**
 * POULTRY HUB — Domain Type Stubs
 *
 * Domain models and UI types aligned with the approved POULTRY HUB architecture in SKILL.md.
 */

/** User roles supported by the POULTRY HUB RBAC system */
export type UserRole = "ADMIN" | "STAFF" | "CUSTOMER";

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

/** Four standardized laying hen chicken breeds available in POULTRY HUB */
export type ChickenBreed =
  | "Lohmann Brown"
  | "Hy-Line Brown"
  | "ISA Brown"
  | "White Leghorn";

/** Standardized egg shell colors */
export type EggShellColor =
  | "Brown"
  | "White"
  | "Cream / Tinted"
  | "Other";

/** Egg sale order and payment status */
export type SaleStatus = "PENDING" | "PARTIAL" | "PAID" | "CANCELLED";

/** Payment status for egg sales */
export type PaymentStatus = "PENDING" | "PARTIAL" | "PAID" | "CANCELLED";

/**
 * Customer order lifecycle status — matches customer_order_status PostgreSQL enum.
 * Only STAFF/ADMIN may advance status beyond PENDING or CANCELLED.
 */
export type CustomerOrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "PREPARING"
  | "READY"
  | "COMPLETED"
  | "CANCELLED";

/** Customer payment methods supported by POULTRY HUB */
export type PaymentMethod = "CASH" | "BANK_TRANSFER" | "CHECK" | "E_WALLET";

/**
 * Customer-portal payment methods (Migration 015).
 * These are demo methods — no live payment API is connected.
 * Separate from the admin-side PaymentMethod used in egg_sales.
 */
export type CustomerPaymentMethod =
  | "GCASH"           // GCash: customer provides reference number
  | "BANK_TRANSFER"   // Bank transfer: customer provides bank reference
  | "CASH_ON_DELIVERY"; // Pay on delivery/pickup: no upfront proof

/**
 * Payment submission lifecycle status (Migration 015).
 * PENDING_SUBMISSION: payment method chosen, proof not yet provided.
 * SUBMITTED: customer provided reference/intent, awaiting staff review.
 * VERIFIED: staff confirmed payment receipt.
 * REJECTED: staff rejected proof (customer sees rejection_reason).
 * REFUNDED: refund issued.
 */
export type CustomerPaymentStatus =
  | "PENDING_SUBMISSION"
  | "SUBMITTED"
  | "VERIFIED"
  | "REJECTED"
  | "REFUNDED";

/** Customer payment submission record (Migration 015) */
export interface CustomerPaymentSubmission {
  id: string;
  order_id: string;
  customer_id: string;
  payment_method: CustomerPaymentMethod;
  status: CustomerPaymentStatus;
  reference_number: string | null;
  customer_notes: string | null;
  declared_amount: number | null;
  verified_by: string | null;
  verified_at: string | null;
  verification_notes: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

/** Payment record representation in the UI */
export interface PaymentRecordView {
  id: string;
  sale_id: string;
  amount: number;
  payment_method: PaymentMethod;
  payment_date: string;
  reference_number: string | null;
  notes: string | null;
  recorded_by: string | null;
  created_at: string;
  recorded_by_profile?: {
    full_name: string;
  } | null;
}

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
