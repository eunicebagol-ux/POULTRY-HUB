/**
 * POULTRY HUB — Application Constants
 *
 * Domain constants and UX preview references aligned with SKILL.md.
 * NOTE: The PostgreSQL schema has not yet been applied.
 * Server-side RPCs will remain the sole authority for financial totals and inventory deductions.
 */

import type { EggSize, PackagingType, FlockStatus, UserRole } from "@/types";

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

// ─── User Roles ───────────────────────────────────────────────────────────────

export const USER_ROLES: UserRole[] = ["ADMIN", "STAFF"];

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "Administrator",
  STAFF: "Staff",
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
