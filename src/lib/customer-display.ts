/**
 * POULTRY HUB — Customer Display Name Utilities
 *
 * Provides shared, pure helper functions for resolving customer names
 * consistently across the customer portal header, dashboard, and forms.
 */

/**
 * Helper to determine if a string represents an actual, meaningful human or business name.
 * Rejects empty strings, whitespace, default "Customer" placeholders, and email addresses.
 */
export function isMeaningfulCustomerName(name: string | null | undefined): boolean {
  if (!name) return false;
  const trimmed = name.trim();
  if (!trimmed || trimmed.toLowerCase() === "customer") return false;
  // If the string contains an '@' and a '.', it is an email address rather than an actual name.
  if (trimmed.includes("@") && trimmed.includes(".")) return false;
  return true;
}

/**
 * Converts an email username (the portion before the '@') into a readable display name.
 *
 * Rules:
 * - Splits on dots (`.`) and underscores (`_`); each segment is capitalised.
 * - Segments that are only digits are dropped (e.g. "john123" → "John123" kept,
 *   but "john.1234" → only the numeric-only segment "1234" is dropped).
 * - The full email domain is never included.
 * - Returns `null` if the result is empty or unusable.
 *
 * Examples:
 *   "angelabacalunas@gmail.com"  → "Angelabacalunas"
 *   "john.santos@gmail.com"      → "John Santos"
 *   "maria_rose@yahoo.com"       → "Maria Rose"
 *   "user.123@example.com"       → "User"  (numeric-only segments dropped)
 *   "@example.com"               → null
 *   ""                           → null
 */
export function emailUsernameToDisplayName(email: string | null | undefined): string | null {
  if (!email) return null;

  const atIndex = email.indexOf("@");
  // Must have an '@' that isn't the very first character
  if (atIndex <= 0) return null;

  const username = email.slice(0, atIndex).trim();
  if (!username) return null;

  // Split on dots and underscores, filter empty segments and purely-numeric segments
  const segments = username
    .split(/[._]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !/^\d+$/.test(s));

  if (segments.length === 0) return null;

  // Capitalise the first letter of every segment, keep the rest as-is
  const displayName = segments
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");

  return displayName || null;
}

/**
 * Resolves the display name for a customer based on available identity sources:
 * 1. Linked customer directory record name (customers.name) if meaningful
 * 2. Authenticated user profile full name (profiles.full_name) if meaningful
 * 3. Customer directory contact person (customers.contact_person) if meaningful
 * 4. Clerk identity (first + last name, fullName, or firstName alone) if meaningful
 * 5. Clerk metadata (unsafeMetadata / publicMetadata full_name or name) if meaningful
 * 6. Email username derived display name (portion before '@', formatted)
 * 7. Default fallback: "Customer"
 */
export function resolveCustomerDisplayName(params: {
  profile?: { full_name?: string | null } | null;
  customerRecord?: { name?: string | null; contact_person?: string | null; email?: string | null } | null;
  clerkUser?: {
    firstName?: string | null;
    lastName?: string | null;
    fullName?: string | null;
    unsafeMetadata?: Record<string, unknown> | null;
    publicMetadata?: Record<string, unknown> | null;
  } | null;
  /** Primary email address for the authenticated user — used as fallback display name source. */
  email?: string | null;
}): string {
  const { profile, customerRecord, clerkUser, email } = params;

  // 1. Linked customer record name (from customers directory table)
  if (customerRecord?.name && isMeaningfulCustomerName(customerRecord.name)) {
    return customerRecord.name.trim();
  }

  // 2. User profile full name (from public.profiles.full_name)
  if (profile?.full_name && isMeaningfulCustomerName(profile.full_name)) {
    return profile.full_name.trim();
  }

  // 3. Customer contact person (e.g. customers.contact_person)
  if (customerRecord?.contact_person && isMeaningfulCustomerName(customerRecord.contact_person)) {
    return customerRecord.contact_person.trim();
  }

  // 4. Clerk identity (firstName + lastName)
  const clerkFullName = [clerkUser?.firstName, clerkUser?.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  if (isMeaningfulCustomerName(clerkFullName)) {
    return clerkFullName;
  }

  if (clerkUser?.fullName && isMeaningfulCustomerName(clerkUser.fullName)) {
    return clerkUser.fullName.trim();
  }

  if (clerkUser?.firstName && isMeaningfulCustomerName(clerkUser.firstName)) {
    return clerkUser.firstName.trim();
  }

  // 5. Clerk metadata if set
  const metadataFullName =
    (typeof clerkUser?.unsafeMetadata?.full_name === "string" && clerkUser.unsafeMetadata.full_name) ||
    (typeof clerkUser?.unsafeMetadata?.name === "string" && clerkUser.unsafeMetadata.name) ||
    (typeof clerkUser?.publicMetadata?.full_name === "string" && clerkUser.publicMetadata.full_name) ||
    (typeof clerkUser?.publicMetadata?.name === "string" && clerkUser.publicMetadata.name) ||
    null;

  if (metadataFullName && isMeaningfulCustomerName(metadataFullName)) {
    return metadataFullName.trim();
  }

  // 6. Email username — derive a readable name from the part before '@'
  // Also try the customer record's email if the primary email is unavailable.
  const emailSource = email || customerRecord?.email || null;
  const usernameDisplay = emailUsernameToDisplayName(emailSource);
  if (usernameDisplay) {
    return usernameDisplay;
  }

  // 7. Final fallback — never display an email address as the customer's name.
  return "Customer";
}
