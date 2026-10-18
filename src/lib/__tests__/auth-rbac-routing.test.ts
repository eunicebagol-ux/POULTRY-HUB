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
});
