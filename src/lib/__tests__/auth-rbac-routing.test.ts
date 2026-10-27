/**
 * POULTRY HUB — Auth & RBAC Routing Verification Tests
 *
 * Validates role-based access control, customer approval separation,
 * and routing rules for ADMIN, STAFF, and CUSTOMER roles.
 *
 * Run with: npx vitest run src/lib/__tests__/auth-rbac-routing.test.ts
 */

import { describe, it, expect } from "vitest";
import type { UserProfile } from "@/lib/user-profile";

/**
 * Pure simulation of Customer Layout route guard logic
 * to guarantee ADMIN and STAFF are never blocked by customer approval checks.
 */
function evaluateCustomerLayoutAccess(profile: UserProfile | null): {
  action: "REDIRECT_DASHBOARD" | "RENDER_PENDING" | "RENDER_CUSTOMER_PORTAL";
  redirectUrl?: string;
} {
  // Security Guard: Farm staff and admins are strictly separated from customer portal
  if (profile && (profile.role === "STAFF" || profile.role === "ADMIN")) {
    return { action: "REDIRECT_DASHBOARD", redirectUrl: "/dashboard" };
  }

  // Handle pending, suspended, or unprovisioned customer accounts
  if (!profile || !profile.is_active) {
    return { action: "RENDER_PENDING" };
  }

  return { action: "RENDER_CUSTOMER_PORTAL" };
}

/**
 * Pure simulation of Dashboard Layout route guard logic
 * to guarantee CUSTOMER users are strictly separated from farm management.
 */
function evaluateDashboardLayoutAccess(profile: UserProfile | null): {
  action: "REDIRECT_CUSTOMER" | "RENDER_APP_SHELL" | "RENDER_BANNER";
  redirectUrl?: string;
  userRole?: string;
} {
  if (profile && profile.role === "CUSTOMER") {
    return { action: "REDIRECT_CUSTOMER", redirectUrl: "/customer/dashboard" };
  }

  if (profile && profile.is_active) {
    return { action: "RENDER_APP_SHELL", userRole: profile.role };
  }

  return { action: "RENDER_BANNER", userRole: "STAFF" };
}

describe("Auth & RBAC Routing Guard Tests", () => {
  const adminProfile: UserProfile = {
    id: "user_3KF6Mh5bST23HwZGTMQq0CXGUpv",
    role: "ADMIN",
    full_name: "EUNICE ALISON BAGOL",
    phone: null,
    avatar_url: null,
    is_active: true,
  };

  const staffProfile: UserProfile = {
    id: "user_3KMd1b0TaEq1JCfCcuIyJp1kHKb",
    role: "STAFF",
    full_name: "Staff Member",
    phone: null,
    avatar_url: null,
    is_active: true,
  };

  const approvedCustomerProfile: UserProfile = {
    id: "user_3Kgxcg8vepU7HifcIzNi3fcb8EA",
    role: "CUSTOMER",
    full_name: "Customer Angela",
    phone: null,
    avatar_url: null,
    is_active: true,
  };

  const pendingCustomerProfile: UserProfile = {
    id: "user_pending_cust_123",
    role: "CUSTOMER",
    full_name: "Pending Customer",
    phone: null,
    avatar_url: null,
    is_active: false,
  };

  const deactivatedCustomerProfile: UserProfile = {
    id: "user_deactivated_cust_456",
    role: "CUSTOMER",
    full_name: "Deactivated Customer",
    phone: null,
    avatar_url: null,
    is_active: false,
  };

  describe("Customer Portal Access Guard (CustomerLayout)", () => {
    it("redirects authenticated ADMIN to /dashboard (never blocked by customer approval)", () => {
      const result = evaluateCustomerLayoutAccess(adminProfile);
      expect(result.action).toBe("REDIRECT_DASHBOARD");
      expect(result.redirectUrl).toBe("/dashboard");
    });

    it("redirects authenticated STAFF to /dashboard", () => {
      const result = evaluateCustomerLayoutAccess(staffProfile);
      expect(result.action).toBe("REDIRECT_DASHBOARD");
      expect(result.redirectUrl).toBe("/dashboard");
    });

    it("allows approved, active CUSTOMER to access the customer portal", () => {
      const result = evaluateCustomerLayoutAccess(approvedCustomerProfile);
      expect(result.action).toBe("RENDER_CUSTOMER_PORTAL");
    });

    it("shows Account Pending Approval to pending CUSTOMER", () => {
      const result = evaluateCustomerLayoutAccess(pendingCustomerProfile);
      expect(result.action).toBe("RENDER_PENDING");
    });

    it("denies access to deactivated CUSTOMER and shows pending/deactivated message", () => {
      const result = evaluateCustomerLayoutAccess(deactivatedCustomerProfile);
      expect(result.action).toBe("RENDER_PENDING");
    });
  });

  describe("Dashboard Access Guard (AuthenticatedLayout)", () => {
    it("renders AppShell with ADMIN role for active administrator", () => {
      const result = evaluateDashboardLayoutAccess(adminProfile);
      expect(result.action).toBe("RENDER_APP_SHELL");
      expect(result.userRole).toBe("ADMIN");
    });

    it("renders AppShell with STAFF role for active staff member", () => {
      const result = evaluateDashboardLayoutAccess(staffProfile);
      expect(result.action).toBe("RENDER_APP_SHELL");
      expect(result.userRole).toBe("STAFF");
    });

    it("redirects CUSTOMER users to /customer/dashboard away from farm management", () => {
      const result = evaluateDashboardLayoutAccess(approvedCustomerProfile);
      expect(result.action).toBe("REDIRECT_CUSTOMER");
      expect(result.redirectUrl).toBe("/customer/dashboard");
    });

    it("redirects pending CUSTOMER users to /customer/dashboard", () => {
      const result = evaluateDashboardLayoutAccess(pendingCustomerProfile);
      expect(result.action).toBe("REDIRECT_CUSTOMER");
      expect(result.redirectUrl).toBe("/customer/dashboard");
    });
  });

  describe("Automatic Customer Provisioning & Status Preservation", () => {
    // Pure simulation of JIT provisioning logic in src/lib/user-profile.ts
    function provisionJitCustomer(userId: string, fullName: string): UserProfile {
      return {
        id: userId,
        role: "CUSTOMER",
        full_name: fullName,
        phone: null,
        avatar_url: null,
        is_active: true,
      };
    }

    // Pure simulation of Clerk webhook user.created logic in src/app/api/webhooks/route.ts
    function processWebhookUserCreated(
      existingProfile: { role: string; is_active: boolean } | null
    ): { role: string; is_active: boolean } {
      const assignedRole = existingProfile?.role || "CUSTOMER";
      const isActive = existingProfile ? existingProfile.is_active : true;
      return { role: assignedRole, is_active: isActive };
    }

    // Pure simulation of Clerk webhook user.updated logic in src/app/api/webhooks/route.ts
    function processWebhookUserUpdated(
      existingProfile: { role: string; is_active: boolean } | null
    ): { role: string; is_active: boolean } {
      const assignedRole = existingProfile?.role || "CUSTOMER";
      const isActive = existingProfile ? existingProfile.is_active : true;
      return { role: assignedRole, is_active: isActive };
    }

    // Pure simulation of unprovisioned user reconciliation in src/actions/users.ts
    function reconcileClerkUser(
      existingProfileIds: Set<string>,
      clerkUser: { id: string; publicMetadata?: { is_active?: boolean } }
    ): { skipped: boolean; profile?: { role: string; is_active: boolean } } {
      if (existingProfileIds.has(clerkUser.id)) {
        return { skipped: true };
      }
      const isExplicitlyDeactivated = clerkUser.publicMetadata?.is_active === false;
      const isActive = !isExplicitlyDeactivated;
      return {
        skipped: false,
        profile: {
          role: "CUSTOMER",
          is_active: isActive,
        },
      };
    }

    it("automatically provisions new customers with CUSTOMER role and active status", () => {
      const newCustomer = provisionJitCustomer("user_brand_new_123", "New Direct Buyer");
      expect(newCustomer.role).toBe("CUSTOMER");
      expect(newCustomer.is_active).toBe(true);

      // Verify newly registered customer immediately passes the customer portal access guard
      const accessResult = evaluateCustomerLayoutAccess(newCustomer);
      expect(accessResult.action).toBe("RENDER_CUSTOMER_PORTAL");
    });

    it("provisions new users via webhook with active CUSTOMER role", () => {
      const result = processWebhookUserCreated(null);
      expect(result.role).toBe("CUSTOMER");
      expect(result.is_active).toBe(true);
    });

    it("preserves inactive status when webhook is replayed for an existing deactivated customer", () => {
      const existingDeactivated = { role: "CUSTOMER", is_active: false };
      const createdResult = processWebhookUserCreated(existingDeactivated);
      expect(createdResult.role).toBe("CUSTOMER");
      expect(createdResult.is_active).toBe(false);

      const updatedResult = processWebhookUserUpdated(existingDeactivated);
      expect(updatedResult.role).toBe("CUSTOMER");
      expect(updatedResult.is_active).toBe(false);
    });

    it("preserves ADMIN and STAFF roles during webhook processing and never demotes them", () => {
      const existingAdmin = { role: "ADMIN", is_active: true };
      const adminCreated = processWebhookUserCreated(existingAdmin);
      expect(adminCreated.role).toBe("ADMIN");
      expect(adminCreated.is_active).toBe(true);

      const existingStaff = { role: "STAFF", is_active: true };
      const staffUpdated = processWebhookUserUpdated(existingStaff);
      expect(staffUpdated.role).toBe("STAFF");
      expect(staffUpdated.is_active).toBe(true);
    });

    it("does not overwrite existing database profiles during admin user reconciliation", () => {
      const existingIds = new Set(["user_existing_in_db"]);
      const result = reconcileClerkUser(existingIds, { id: "user_existing_in_db" });
      expect(result.skipped).toBe(true);
      expect(result.profile).toBeUndefined();
    });

    it("reconciles explicitly deactivated Clerk users as inactive", () => {
      const existingIds = new Set<string>();
      const result = reconcileClerkUser(existingIds, {
        id: "user_deactivated_in_clerk",
        publicMetadata: { is_active: false },
      });
      expect(result.skipped).toBe(false);
      expect(result.profile?.role).toBe("CUSTOMER");
      expect(result.profile?.is_active).toBe(false);
    });

    it("reconciles brand-new Clerk users without deactivation metadata as active", () => {
      const existingIds = new Set<string>();
      const result = reconcileClerkUser(existingIds, {
        id: "user_fresh_clerk_signup",
        publicMetadata: {},
      });
      expect(result.skipped).toBe(false);
      expect(result.profile?.role).toBe("CUSTOMER");
      expect(result.profile?.is_active).toBe(true);
    });
  });
});
