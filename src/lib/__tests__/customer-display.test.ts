/**
 * POULTRY HUB — customer-display.ts unit tests
 *
 * Run with:  npx vitest run src/lib/__tests__/customer-display.test.ts
 */

import { describe, it, expect } from "vitest";
import {
  emailUsernameToDisplayName,
  isMeaningfulCustomerName,
  resolveCustomerDisplayName,
} from "../customer-display";

// ─── emailUsernameToDisplayName ─────────────────────────────────────────────

describe("emailUsernameToDisplayName", () => {
  it("capitalises a single-word username", () => {
    expect(emailUsernameToDisplayName("angelabacalunas@gmail.com")).toBe(
      "Angelabacalunas"
    );
  });

  it("splits on dots and capitalises each segment", () => {
    expect(emailUsernameToDisplayName("john.santos@gmail.com")).toBe(
      "John Santos"
    );
  });

  it("splits on underscores and capitalises each segment", () => {
    expect(emailUsernameToDisplayName("maria_rose@yahoo.com")).toBe(
      "Maria Rose"
    );
  });

  it("handles a mix of dots and underscores", () => {
    expect(emailUsernameToDisplayName("maria.rose_santos@email.com")).toBe(
      "Maria Rose Santos"
    );
  });

  it("drops purely-numeric segments", () => {
    expect(emailUsernameToDisplayName("user.123@example.com")).toBe("User");
  });

  it("keeps alphanumeric segments (not purely numeric)", () => {
    expect(emailUsernameToDisplayName("john123@example.com")).toBe("John123");
  });

  it("returns null when the '@' is the first character", () => {
    expect(emailUsernameToDisplayName("@example.com")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(emailUsernameToDisplayName("")).toBeNull();
  });

  it("returns null for null", () => {
    expect(emailUsernameToDisplayName(null)).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(emailUsernameToDisplayName(undefined)).toBeNull();
  });

  it("returns null when all segments are purely numeric", () => {
    expect(emailUsernameToDisplayName("123.456@example.com")).toBeNull();
  });

  it("never includes the email domain", () => {
    const result = emailUsernameToDisplayName("user@example.com");
    expect(result).not.toContain("example");
    expect(result).not.toContain("@");
    expect(result).not.toContain(".com");
  });

  it("handles multiple consecutive separators gracefully", () => {
    // "anna..rose" splits to ["anna", "", "rose"] — empty segment filtered
    expect(emailUsernameToDisplayName("anna..rose@example.com")).toBe(
      "Anna Rose"
    );
  });
});

// ─── isMeaningfulCustomerName ────────────────────────────────────────────────

describe("isMeaningfulCustomerName", () => {
  it("accepts a regular full name", () => {
    expect(isMeaningfulCustomerName("Angela Bacalunas")).toBe(true);
  });

  it("rejects null", () => {
    expect(isMeaningfulCustomerName(null)).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isMeaningfulCustomerName("")).toBe(false);
  });

  it("rejects whitespace-only string", () => {
    expect(isMeaningfulCustomerName("   ")).toBe(false);
  });

  it("rejects the placeholder 'Customer' (case-insensitive)", () => {
    expect(isMeaningfulCustomerName("Customer")).toBe(false);
    expect(isMeaningfulCustomerName("customer")).toBe(false);
    expect(isMeaningfulCustomerName("CUSTOMER")).toBe(false);
  });

  it("rejects an email address", () => {
    expect(isMeaningfulCustomerName("user@example.com")).toBe(false);
  });
});

// ─── resolveCustomerDisplayName ──────────────────────────────────────────────

describe("resolveCustomerDisplayName", () => {
  // Priority 1 — customer record name
  it("uses customers.name when available", () => {
    expect(
      resolveCustomerDisplayName({
        customerRecord: { name: "Sunrise Farm", contact_person: null, email: null },
        profile: { full_name: "Other Name" },
        email: "user@example.com",
      })
    ).toBe("Sunrise Farm");
  });

  // Priority 2 — profile full_name
  it("uses profile.full_name when customer name is absent", () => {
    expect(
      resolveCustomerDisplayName({
        profile: { full_name: "Angela Bacalunas" },
        email: "user@example.com",
      })
    ).toBe("Angela Bacalunas");
  });

  // Priority 3 — contact_person
  it("uses customers.contact_person when name and profile are absent", () => {
    expect(
      resolveCustomerDisplayName({
        customerRecord: { name: null, contact_person: "Maria Santos", email: null },
        profile: { full_name: null },
        email: "user@example.com",
      })
    ).toBe("Maria Santos");
  });

  // Priority 4 — Clerk firstName + lastName
  it("uses Clerk firstName + lastName", () => {
    expect(
      resolveCustomerDisplayName({
        clerkUser: { firstName: "John", lastName: "Santos" },
        email: "john.santos@gmail.com",
      })
    ).toBe("John Santos");
  });

  // Priority 4 — Clerk fullName
  it("uses Clerk fullName when firstName/lastName absent", () => {
    expect(
      resolveCustomerDisplayName({
        clerkUser: { firstName: null, lastName: null, fullName: "Maria Rose" },
        email: "user@example.com",
      })
    ).toBe("Maria Rose");
  });

  // Priority 6 — email username fallback
  it("falls back to email username when all name sources are absent", () => {
    expect(
      resolveCustomerDisplayName({
        profile: { full_name: null },
        customerRecord: { name: null, contact_person: null, email: null },
        clerkUser: { firstName: null, lastName: null, fullName: null },
        email: "angelabacalunas@gmail.com",
      })
    ).toBe("Angelabacalunas");
  });

  it("splits dots in email username as fallback", () => {
    expect(
      resolveCustomerDisplayName({
        email: "john.santos@gmail.com",
      })
    ).toBe("John Santos");
  });

  it("splits underscores in email username as fallback", () => {
    expect(
      resolveCustomerDisplayName({
        email: "maria_rose@yahoo.com",
      })
    ).toBe("Maria Rose");
  });

  // Profile placeholder 'Customer' is rejected, email fallback fires
  it("falls through the 'Customer' placeholder profile name to email fallback", () => {
    expect(
      resolveCustomerDisplayName({
        profile: { full_name: "Customer" },
        email: "john.santos@gmail.com",
      })
    ).toBe("John Santos");
  });

  // Priority 7 — final fallback
  it("returns 'Customer' when every source is absent including email", () => {
    expect(
      resolveCustomerDisplayName({
        profile: { full_name: null },
        customerRecord: { name: null, contact_person: null, email: null },
        clerkUser: null,
        email: null,
      })
    ).toBe("Customer");
  });

  it("returns 'Customer' when email is invalid (no '@')", () => {
    expect(
      resolveCustomerDisplayName({
        email: "not-an-email",
      })
    ).toBe("Customer");
  });

  it("returns 'Customer' when email username is purely numeric", () => {
    expect(
      resolveCustomerDisplayName({
        email: "123456@example.com",
      })
    ).toBe("Customer");
  });

  it("never exposes the email domain in the returned name", () => {
    const result = resolveCustomerDisplayName({
      email: "user@example.com",
    });
    expect(result).not.toContain("example");
    expect(result).not.toContain("@");
  });
});
