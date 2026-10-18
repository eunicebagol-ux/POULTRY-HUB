/**
 * POULTRY HUB — Application Constants
 *
 * Domain constants and UX preview references aligned with SKILL.md.
 * NOTE: The PostgreSQL schema has not yet been applied.
 * Server-side RPCs will remain the sole authority for financial totals and inventory deductions.
 */

import type {
  EggSize,
  PackagingType,
  FlockStatus,
  UserRole,
  PaymentMethod,
  PaymentStatus,
  CustomerPaymentMethod,
  CustomerPaymentStatus,
  CustomerOrderStatus,
  ChickenBreed,
  EggShellColor,
} from "@/types";

// ─── Egg Sizes ────────────────────────────────────────────────────────────────

export const EGG_SIZES: EggSize[] = [
  "SMALL",
  "MEDIUM",
  "LARGE",
  "EXTRA_LARGE",
  "JUMBO",
  "UNGRADED",
];

export const EGG_SIZE_LABELS: Record<EggSize, string> = {
  SMALL: "Small",
  MEDIUM: "Medium",
  LARGE: "Large",
  EXTRA_LARGE: "Extra Large",
  JUMBO: "Jumbo",
  UNGRADED: "Ungraded",
};

// ─── Packaging Types ─────────────────────────────────────────────────────────

export const PACKAGING_TYPES: PackagingType[] = [
  "PIECE",
  "TRAY_30",
  "CARTON_12",
  "BOX_360",
];

/**
 * Authoritative multipliers.
 * total_pieces = package_quantity × PACKAGING_MULTIPLIERS[type]
 * Server (PostgreSQL RPC) is the final authority; these are mirrored client-side
 * for UX preview only. Never trust client-computed totals server-side.
 */
export const PACKAGING_MULTIPLIERS: Record<PackagingType, number> = {
  PIECE: 1,
  TRAY_30: 30,
  CARTON_12: 12,
  BOX_360: 360,
};

export const PACKAGING_LABELS: Record<PackagingType, string> = {
  PIECE: "Piece (×1)",
  TRAY_30: "Tray (×30)",
  CARTON_12: "Carton (×12)",
  BOX_360: "Box (×360)",
};

// ─── Flock Status ─────────────────────────────────────────────────────────────

export const FLOCK_STATUSES: FlockStatus[] = ["ACTIVE", "RETIRED", "QUARANTINED"];

export const FLOCK_STATUS_LABELS: Record<FlockStatus, string> = {
  ACTIVE: "Active",
  RETIRED: "Retired",
  QUARANTINED: "Quarantined",
};

// ─── Chicken Breeds ───────────────────────────────────────────────────────────

export const CHICKEN_BREEDS: ChickenBreed[] = [
  "Lohmann Brown",
  "Hy-Line Brown",
  "ISA Brown",
  "White Leghorn",
];

export const EGG_SHELL_COLORS: EggShellColor[] = [
  "Brown",
  "White",
  "Cream / Tinted",
  "Other",
];

export interface ChickenBreedCardData {
  id: ChickenBreed;
  name: ChickenBreed;
  typicalEggColor: EggShellColor;
  description: string;
  image: string;
}

export const CHICKEN_BREED_DETAILS: Record<ChickenBreed, ChickenBreedCardData> = {
  "Lohmann Brown": {
    id: "Lohmann Brown",
    name: "Lohmann Brown",
    typicalEggColor: "Brown",
    description: "Industry-standard brown egg layer with uniform shell color and high productivity.",
    image: "/images/breeds/lohmann-brown.jpg",
  },
  "Hy-Line Brown": {
    id: "Hy-Line Brown",
    name: "Hy-Line Brown",
    typicalEggColor: "Brown",
    description: "World-leading layer producing rich brown eggs with superior internal egg quality.",
    image: "/images/breeds/hyline-brown.jpg",
  },
  "ISA Brown": {
    id: "ISA Brown",
    name: "ISA Brown",
    typicalEggColor: "Brown",
    description: "High performance commercial layer known for strong brown shells and feed efficiency.",
    image: "/images/breeds/isa-brown.jpg",
  },
  "White Leghorn": {
    id: "White Leghorn",
    name: "White Leghorn",
    typicalEggColor: "White",
    description: "Exceptional efficiency producing uniform, pristine white-shelled eggs.",
    image: "/images/breeds/white-leghorn.jpg",
  },
};

export const BREED_DEFAULT_EGG_COLORS: Record<ChickenBreed, EggShellColor> = {
  "Lohmann Brown": "Brown",
  "Hy-Line Brown": "Brown",
  "ISA Brown": "Brown",
  "White Leghorn": "White",
};

// ─── User Roles ───────────────────────────────────────────────────────────────

export const USER_ROLES: UserRole[] = ["ADMIN", "STAFF", "CUSTOMER"];

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "Administrator",
  STAFF: "Staff",
  CUSTOMER: "Customer",
};

// ─── Supabase Project ─────────────────────────────────────────────────────────

export const SUPABASE_PROJECT_REF = "tlvjjgpmxwcfhixxpsei";

// ─── Currency / Locale ────────────────────────────────────────────────────────

export const DEFAULT_CURRENCY = "PHP";
export const DEFAULT_CURRENCY_SYMBOL = "₱";
export const DEFAULT_LOCALE = "en-PH";

// ─── Collection Shifts ────────────────────────────────────────────────────────

export const COLLECTION_SHIFTS = ["MORNING", "AFTERNOON", "EVENING"] as const;
export type CollectionShift = (typeof COLLECTION_SHIFTS)[number];

export const COLLECTION_SHIFT_LABELS: Record<CollectionShift, string> = {
  MORNING: "Morning",
  AFTERNOON: "Afternoon",
  EVENING: "Evening",
};

// ─── Payment Methods ──────────────────────────────────────────────────────────

export const PAYMENT_METHODS: PaymentMethod[] = [
  "CASH",
  "BANK_TRANSFER",
  "CHECK",
  "E_WALLET",
];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Cash",
  BANK_TRANSFER: "Bank Transfer",
  CHECK: "Check",
  E_WALLET: "E-Wallet",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: "Pending",
  PARTIAL: "Partial",
  PAID: "Paid",
  CANCELLED: "Cancelled",
};

// ─── Customer Order Status Transitions ────────────────────────────────────────

/**
 * Explicit state-machine transition map for customer orders.
 * Terminal states (COMPLETED, CANCELLED) permit no further transitions.
 */
export const ALLOWED_STATUS_TRANSITIONS: Record<
  CustomerOrderStatus,
  readonly CustomerOrderStatus[]
> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

// ─── Customer Portal Payment Methods (Migration 015) ──────────────────────────
// These are DEMO payment methods for the customer-facing order portal.
// Separate from the admin-side PAYMENT_METHODS used in egg_sales.


export const CUSTOMER_PAYMENT_METHODS: CustomerPaymentMethod[] = [
  "GCASH",
  "BANK_TRANSFER",
  "CASH_ON_DELIVERY",
];

export const CUSTOMER_PAYMENT_METHOD_LABELS: Record<CustomerPaymentMethod, string> = {
  GCASH: "GCash (Demo)",
  BANK_TRANSFER: "Bank Transfer (Demo)",
  CASH_ON_DELIVERY: "Pay on Delivery / Pickup",
};

export const CUSTOMER_PAYMENT_METHOD_DESCRIPTIONS: Record<CustomerPaymentMethod, string> = {
  GCASH:
    "Send payment via GCash to our registered number. Provide your GCash transaction reference number as proof.",
  BANK_TRANSFER:
    "Transfer to our bank account and provide the bank transaction reference number for verification.",
  CASH_ON_DELIVERY:
    "Pay in cash when your order is delivered or when you pick it up from the farm. No upfront proof needed.",
};

export const CUSTOMER_PAYMENT_STATUS_LABELS: Record<CustomerPaymentStatus, string> = {
  PENDING_SUBMISSION: "Payment Not Submitted",
  SUBMITTED: "Payment Submitted — Awaiting Verification",
  VERIFIED: "Payment Verified",
  REJECTED: "Payment Rejected",
  REFUNDED: "Refunded",
};

// Demo GCash details — NOT real credentials
export const DEMO_GCASH_NUMBER = "0917-XXX-XXXX (Demo Only)";
export const DEMO_GCASH_NAME = "Poultry Hub Farm (Demo)";

// Demo bank account — NOT real credentials
export const DEMO_BANK_NAME = "BDO Unibank (Demo)";
export const DEMO_BANK_ACCOUNT_NAME = "Poultry Hub Farm (Demo)";
export const DEMO_BANK_ACCOUNT_NUMBER = "0000-0000-0000 (Demo Only)";
