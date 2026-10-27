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
  EggType,
} from "@/types";

// ─── Egg Types (Shell Color) ──────────────────────────────────────────────────

export const EGG_TYPES: EggType[] = ["WHITE", "BROWN"];

export const EGG_TYPE_LABELS: Record<EggType, string> = {
  WHITE: "White Egg",
  BROWN: "Brown Egg",
};

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

/** White egg tray product images */
export const EGG_PRODUCT_WHITE_IMAGES: Record<EggSize, string> = {
  SMALL: "/images/products/egg-tray-white-small.jpg",
  MEDIUM: "/images/products/egg-tray-white-medium.jpg",
  LARGE: "/images/products/egg-tray-white-large.jpg",
  EXTRA_LARGE: "/images/products/egg-tray-white-extra-large.jpg",
  JUMBO: "/images/products/egg-tray-white-jumbo.jpg",
  UNGRADED: "/images/products/egg-tray-white-ungraded.jpg",
};

/** Brown egg tray product images */
export const EGG_PRODUCT_BROWN_IMAGES: Record<EggSize, string> = {
  SMALL: "/images/products/egg-tray-brown-small.jpg",
  MEDIUM: "/images/products/egg-tray-brown-medium.jpg",
  LARGE: "/images/products/egg-tray-brown-large.jpg",
  EXTRA_LARGE: "/images/products/egg-tray-brown-extra-large.jpg",
  JUMBO: "/images/products/egg-tray-brown-jumbo.jpg",
  UNGRADED: "/images/products/egg-tray-brown-ungraded.jpg",
};

/** Combined image resolver by size and egg type */
export const EGG_PRODUCT_IMAGES_BY_TYPE: Record<EggType, Record<EggSize, string>> = {
  WHITE: EGG_PRODUCT_WHITE_IMAGES,
  BROWN: EGG_PRODUCT_BROWN_IMAGES,
};

/** Backward-compatible default product images (points to default white egg tray) */
export const EGG_PRODUCT_IMAGES: Record<EggSize, string> = EGG_PRODUCT_WHITE_IMAGES;

/** Backward-compatible accessible alt texts */
export const EGG_PRODUCT_ALT_TEXTS: Record<EggSize, string> = {
  SMALL: "Fresh small white eggs neatly arranged in a 30-egg tray",
  MEDIUM: "Fresh medium white eggs neatly arranged in a 30-egg tray",
  LARGE: "Fresh large white eggs neatly arranged in a 30-egg tray",
  EXTRA_LARGE: "Fresh extra-large white eggs neatly arranged in a 30-egg tray",
  JUMBO: "Fresh jumbo white eggs neatly arranged in a 30-egg tray",
  UNGRADED: "Fresh ungraded white eggs neatly arranged in a 30-egg tray",
};

/** Resolves the correct product image URL based on egg size and selected egg type */
export function getEggProductImage(size: EggSize, eggType: EggType = "WHITE"): string {
  const map = EGG_PRODUCT_IMAGES_BY_TYPE[eggType] ?? EGG_PRODUCT_WHITE_IMAGES;
  return map[size] ?? EGG_PRODUCT_WHITE_IMAGES[size] ?? "/images/products/egg-tray-white-small.jpg";
}

/** Resolves accessible alt text based on egg size and selected egg type */
export function getEggProductAltText(size: EggSize, eggType: EggType = "WHITE"): string {
  const typeLabel = eggType === "BROWN" ? "brown" : "white";
  const sizeLabel = EGG_SIZE_LABELS[size] ?? size;
  return `Fresh ${sizeLabel.toLowerCase()} ${typeLabel} eggs neatly arranged in a 30-egg tray`;
}

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

// ─── Egg Pricing Reference & Helpers ─────────────────────────────────────────

export const EGG_PRICE_PER_PIECE: Record<EggSize, number> = {
  SMALL: 6.0,
  MEDIUM: 7.0,
  LARGE: 8.0,
  EXTRA_LARGE: 9.0,
  JUMBO: 10.0,
  UNGRADED: 5.0,
};

export const CONFIRMED_TRAY_PRICES: Record<EggType, Record<EggSize, number>> = {
  WHITE: {
    SMALL: 180.0,
    MEDIUM: 210.0,
    LARGE: 240.0,
    EXTRA_LARGE: 270.0,
    JUMBO: 300.0,
    UNGRADED: 150.0,
  },
  BROWN: {
    SMALL: 190.0,
    MEDIUM: 220.0,
    LARGE: 250.0,
    EXTRA_LARGE: 270.0,
    JUMBO: 300.0,
    UNGRADED: 150.0,
  },
};

/**
 * Calculates authoritative packaging price for an egg product line.
 * Derivation rules:
 * - PIECE: price_per_piece
 * - CARTON_12: explicit price_carton_12 when present; otherwise price_per_piece * 12
 * - BOX_360: explicit price_box_360 when present; otherwise price_per_piece * 360
 * - TRAY_30: explicit price_tray_30 when present; otherwise price_per_piece * 30
 */
export function calculatePackagingPrice(
  packaging: PackagingType,
  pricePerPiece: number,
  overrides?: {
    price_tray_30?: number | null;
    price_carton_12?: number | null;
    price_box_360?: number | null;
  }
): number {
  switch (packaging) {
    case "TRAY_30":
      return (
        overrides?.price_tray_30 ??
        pricePerPiece * PACKAGING_MULTIPLIERS.TRAY_30
      );
    case "CARTON_12":
      return (
        overrides?.price_carton_12 ??
        pricePerPiece * PACKAGING_MULTIPLIERS.CARTON_12
      );
    case "BOX_360":
      return (
        overrides?.price_box_360 ??
        pricePerPiece * PACKAGING_MULTIPLIERS.BOX_360
      );
    case "PIECE":
    default:
      return pricePerPiece;
  }
}

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
  "CASH_ON_DELIVERY",
  "CASH_ON_PICKUP",
  "GCASH",
  "BANK_TRANSFER",
];

export const DELIVERY_PAYMENT_METHODS: CustomerPaymentMethod[] = [
  "CASH_ON_DELIVERY",
  "GCASH",
  "BANK_TRANSFER",
];

export const PICKUP_PAYMENT_METHODS: CustomerPaymentMethod[] = [
  "CASH_ON_PICKUP",
  "GCASH",
  "BANK_TRANSFER",
];

export const CUSTOMER_PAYMENT_METHOD_LABELS: Record<CustomerPaymentMethod, string> = {
  CASH_ON_DELIVERY: "Cash on Delivery",
  CASH_ON_PICKUP: "Cash on Pick Up",
  GCASH: "GCash",
  BANK_TRANSFER: "Bank Transfer",
};

export const CUSTOMER_PAYMENT_METHOD_DESCRIPTIONS: Record<CustomerPaymentMethod, string> = {
  CASH_ON_DELIVERY:
    "Pay in cash upon receiving your delivery. Please prepare the exact amount.",
  CASH_ON_PICKUP:
    "Pay in cash at the farm counter when picking up your eggs.",
  GCASH:
    "Transfer payment to our official GCash account and provide your transaction reference number and receipt.",
  BANK_TRANSFER:
    "Transfer to our official bank account and provide the transaction reference number and receipt.",
};

export const CUSTOMER_PAYMENT_STATUS_LABELS: Record<CustomerPaymentStatus, string> = {
  PENDING_SUBMISSION: "Payment Not Submitted",
  SUBMITTED: "Payment Submitted — Awaiting Verification",
  VERIFIED: "Payment Verified",
  REJECTED: "Payment Rejected",
  REFUNDED: "Refunded",
};
