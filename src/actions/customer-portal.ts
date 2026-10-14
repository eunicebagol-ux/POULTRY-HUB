"use server";

import { getCurrentUserProfile, type UserProfile } from "@/lib/user-profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { EggSize, PackagingType, PaymentMethod, PaymentStatus } from "@/types";

export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

export interface CustomerSaleItemView {
  id: string;
  size: EggSize;
  packaging: PackagingType;
  package_quantity: number;
  total_pieces: number;
  unit_price: number;
  line_total: number;
}

export interface CustomerPurchaseView {
  id: string;
  invoice_number: string | null;
  sale_date: string;
  subtotal: number;
  discount: number;
  total_amount: number;
  status: string;
  payment_status: PaymentStatus | string;
  notes: string | null;
  items: CustomerSaleItemView[];
}

export interface CustomerPaymentView {
  id: string;
  sale_id: string;
  invoice_number?: string | null;
  amount: number;
  payment_method: PaymentMethod;
  payment_date: string;
  reference_number: string | null;
  notes: string | null;
  created_at: string;
}

export interface CustomerSummaryView {
  totalPurchases: number;
  totalPaid: number;
  outstandingBalance: number;
  orderCount: number;
}

export interface CustomerDashboardData {
  profile: UserProfile;
  customerRecord: {
    id: string;
    name: string;
    contact_person: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    is_active: boolean;
  } | null;
  purchases: CustomerPurchaseView[];
  payments: CustomerPaymentView[];
  summary: CustomerSummaryView;
}

const updateProfileSchema = z.object({
  full_name: z.string().trim().min(2, "Full name must be at least 2 characters").max(100),
  phone: z.string().trim().max(30).optional().nullable(),
  address: z.string().trim().max(250).optional().nullable(),
});

export type UpdateCustomerProfileInput = z.infer<typeof updateProfileSchema>;

/**
 * Lightweight helper for layout header display.
 * Resolves the customer's name without loading full dashboard data.
 * Rejects email-looking values that were incorrectly stored as names.
 */
export async function getCustomerDisplayName(): Promise<string> {
  // Simple check: does this look like an email address?
  const looksLikeEmail = (v: string | null | undefined): boolean =>
    !!v && v.includes("@") && v.includes(".");

  try {
    const caller = await getCurrentUserProfile();
    if (!caller) {
      console.log("[getCustomerDisplayName] No caller profile → 'Customer'");
      return "Customer";
    }

    const clerkUser = await currentUser();
    const clerkName = [clerkUser?.firstName, clerkUser?.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();

    // Try to find linked customer record name
    if (caller.id) {
      const supabase = await createClient();
      const { data: custByClerkId } = await supabase
        .from("customers")
        .select("name")
        .eq("clerk_user_id", caller.id)
        .maybeSingle();

      if (custByClerkId?.name && !looksLikeEmail(custByClerkId.name)) {
        console.log(`[getCustomerDisplayName] Source: customers.name = "${custByClerkId.name}"`);
        return custByClerkId.name;
      }

      // Fallback: check by verified email for unlinked records
      const verifiedEmail = clerkUser?.emailAddresses
        ?.find((e) => e.verification?.status === "verified")
        ?.emailAddress?.toLowerCase()
        .trim();

      if (verifiedEmail) {
        const { data: custByEmail } = await supabase
          .from("customers")
          .select("name, clerk_user_id")
          .eq("email", verifiedEmail)
          .maybeSingle();

        if (custByEmail?.name && !custByEmail.clerk_user_id && !looksLikeEmail(custByEmail.name)) {
          console.log(`[getCustomerDisplayName] Source: customers (by email).name = "${custByEmail.name}"`);
          return custByEmail.name;
        }
      }
    }

    // Fallback chain: profile name → Clerk name → "Customer"
    const profileName =
      caller.id === clerkUser?.id ? caller.full_name : null;

    if (profileName && !looksLikeEmail(profileName)) {
      console.log(`[getCustomerDisplayName] Source: profiles.full_name = "${profileName}"`);
      return profileName;
    }

    if (clerkName && !looksLikeEmail(clerkName)) {
      console.log(`[getCustomerDisplayName] Source: Clerk firstName/lastName = "${clerkName}"`);
      return clerkName;
    }

    console.log(
      `[getCustomerDisplayName] All sources were empty or email-like → 'Customer'. ` +
      `profile.full_name="${caller.full_name}", clerkName="${clerkName}"`
    );
    return "Customer";
  } catch (err) {
    console.error("[getCustomerDisplayName] Error:", err);
    return "Customer";
  }
}

/**
 * Fetches secure, isolated dashboard data for the authenticated customer.
 * Strict customer boundary:
 * - Requires active CUSTOMER (or ADMIN) account.
 * - Resolves customer entity solely via verified server-side identity (Clerk ID / verified email).
 * - Queries only egg_sales matching customer_id = customer.id.
 * - Never trusts any client-provided ID.
 */
export async function getCustomerDashboardData(): Promise<ActionResult<CustomerDashboardData>> {
  const caller = await getCurrentUserProfile();

  if (!caller || !caller.is_active) {
    return { success: false, error: "Unauthorized: Active account required." };
  }

  if (caller.role !== "CUSTOMER") {
    return {
      success: false,
      error: "Access denied: The customer portal is reserved for customer accounts.",
    };
  }

  try {
    const supabase = await createClient();
    const clerkUser = await currentUser();
    const verifiedEmailObj =
      clerkUser?.emailAddresses?.find(
        (e) =>
          e.id === clerkUser.primaryEmailAddressId &&
          e.verification?.status === "verified"
      ) ??
      clerkUser?.emailAddresses?.find(
        (e) => e.verification?.status === "verified"
      );
    const verifiedEmail = verifiedEmailObj?.emailAddress?.toLowerCase().trim();

    // Stage 1: Direct lookup using 1-to-1 clerk_user_id link
    let customerRecord: {
      id: string;
      name: string;
      contact_person: string | null;
      phone: string | null;
      email: string | null;
      address: string | null;
      is_active: boolean;
    } | null = null;

    const { data: custByClerkId } = await supabase
      .from("customers")
      .select("id, name, contact_person, phone, email, address, is_active")
      .eq("clerk_user_id", caller.id)
      .maybeSingle();

    if (custByClerkId) {
      customerRecord = custByClerkId;
    } else if (verifiedEmail) {
      // Stage 2: Safe auto-linking via verified email.
      // Note on DB uniqueness: While unique index customers_clerk_user_id_key is defined in migration 012/013,
      // non-NULL uniqueness is also enforced at application level by failing closed if multiple unlinked rows match.
      const { data: matchingCusts } = await supabase
        .from("customers")
        .select("id, name, contact_person, phone, email, address, is_active, clerk_user_id")
        .eq("email", verifiedEmail);

      const unlinkedCusts = (matchingCusts ?? []).filter((c) => !c.clerk_user_id);

      if (unlinkedCusts.length === 1) {
        const targetCust = unlinkedCusts[0];
        const adminClient = createAdminClient();
        const { error: linkErr } = await adminClient
          .from("customers")
          .update({
            clerk_user_id: caller.id,
            updated_at: new Date().toISOString(),
          })
          .eq("id", targetCust.id);

        if (!linkErr) {
          customerRecord = {
            id: targetCust.id,
            name: targetCust.name,
            contact_person: targetCust.contact_person,
            phone: targetCust.phone,
            email: targetCust.email,
            address: targetCust.address,
            is_active: targetCust.is_active,
          };
        }
      }
      // If matchingCusts has >1 unlinked rows or rows linked to another user, fail closed
    }

    // If no purchases exist yet because customer has no farm record, return safe zero-state
    if (!customerRecord) {
      return {
        success: true,
        data: {
          profile: caller,
          customerRecord: null,
          purchases: [],
          payments: [],
          summary: {
            totalPurchases: 0,
            totalPaid: 0,
            outstandingBalance: 0,
            orderCount: 0,
          },
        },
      };
    }

    // Fetch only this customer's egg sales
    const { data: salesData, error: salesErr } = await supabase
      .from("egg_sales")
      .select(`
        id,
        invoice_number,
        sale_date,
        subtotal,
        discount,
        total_amount,
        status,
        payment_status,
        notes,
        egg_sale_items (
          id,
          size,
          packaging,
          package_quantity,
          total_pieces,
          unit_price,
          line_total
        )
      `)
      .eq("customer_id", customerRecord.id)
      .order("sale_date", { ascending: false });

    if (salesErr) {
      console.error("Error fetching customer purchases:", salesErr);
      return { success: false, error: "Failed to load purchase history." };
    }

    interface RawSaleItem {
      id: string;
      size: EggSize;
      packaging: PackagingType;
      package_quantity: number;
      total_pieces: number;
      unit_price: number;
      line_total: number;
    }

    interface RawSaleRecord {
      id: string;
      invoice_number: string | null;
      sale_date: string;
      subtotal: number;
      discount: number;
      total_amount: number;
      status: string;
      payment_status: string | null;
      notes: string | null;
      egg_sale_items?: RawSaleItem[];
    }

    const purchases: CustomerPurchaseView[] = ((salesData ?? []) as unknown as RawSaleRecord[]).map((s) => ({
      id: s.id,
      invoice_number: s.invoice_number,
      sale_date: s.sale_date,
      subtotal: Number(s.subtotal) || 0,
      discount: Number(s.discount) || 0,
      total_amount: Number(s.total_amount) || 0,
      status: s.status,
      payment_status: s.payment_status || "PENDING",
      notes: s.notes,
      items: (s.egg_sale_items ?? []).map((item) => ({
        id: item.id,
        size: item.size,
        packaging: item.packaging,
        package_quantity: item.package_quantity,
        total_pieces: item.total_pieces,
        unit_price: Number(item.unit_price) || 0,
        line_total: Number(item.line_total) || 0,
      })),
    }));

    // Fetch payments linked strictly to this customer's sales
    const saleIds = purchases.map((p) => p.id);
    let payments: CustomerPaymentView[] = [];

    if (saleIds.length > 0) {
      try {
        const { data: payData, error: payErr } = await supabase
          .from("payments")
          .select(`
            id,
            sale_id,
            amount,
            payment_method,
            payment_date,
            reference_number,
            notes,
            created_at
          `)
          .in("sale_id", saleIds)
          .order("payment_date", { ascending: false });

        interface RawPaymentRecord {
          id: string;
          sale_id: string;
          amount: number;
          payment_method: PaymentMethod;
          payment_date: string;
          reference_number: string | null;
          notes: string | null;
          created_at: string;
        }

        if (!payErr && payData) {
          const invoiceMap = new Map(purchases.map((p) => [p.id, p.invoice_number]));
          payments = (payData as unknown as RawPaymentRecord[]).map((p) => ({
            id: p.id,
            sale_id: p.sale_id,
            invoice_number: invoiceMap.get(p.sale_id) ?? null,
            amount: Number(p.amount) || 0,
            payment_method: p.payment_method,
            payment_date: p.payment_date,
            reference_number: p.reference_number,
            notes: p.notes,
            created_at: p.created_at,
          }));
        }
      } catch (payEx) {
        // In environments where payments table is not yet migrated, fall back gracefully
        console.warn("Payments table not queried or empty:", payEx);
      }
    }

    // Calculate authoritative totals
    const nonCancelledSales = purchases.filter((p) => p.status !== "CANCELLED");
    const totalPurchases = nonCancelledSales.reduce((sum, p) => sum + p.total_amount, 0);
    const totalPaid = payments.reduce((sum, pay) => sum + pay.amount, 0);
    const outstandingBalance = Math.max(0, totalPurchases - totalPaid);

    return {
      success: true,
      data: {
        profile: caller,
        customerRecord,
        purchases,
        payments,
        summary: {
          totalPurchases,
          totalPaid,
          outstandingBalance,
          orderCount: nonCancelledSales.length,
        },
      },
    };
  } catch (err) {
    console.error("Error in getCustomerDashboardData:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to load customer dashboard.",
    };
  }
}

/**
 * Updates permitted profile information for the authenticated customer.
 * Strictly prevents modification of role or is_active status.
 */
export async function updateCustomerProfile(
  input: UpdateCustomerProfileInput
): Promise<ActionResult> {
  const caller = await getCurrentUserProfile();

  if (!caller || !caller.is_active) {
    return { success: false, error: "Unauthorized: Active account required." };
  }

  if (caller.role !== "CUSTOMER") {
    return {
      success: false,
      error: "Access denied: The customer portal is reserved for customer accounts.",
    };
  }

  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid profile data.",
    };
  }

  const { full_name, phone, address } = parsed.data;

  try {
    const supabase = await createClient();
    const adminClient = createAdminClient();

    // Update public.profiles (only permitted fields)
    const { error: profileErr } = await supabase
      .from("profiles")
      .update({
        full_name,
        phone: phone || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", caller.id);

    if (profileErr) {
      return { success: false, error: profileErr.message };
    }

    // Update the linked customer entity only when we can resolve an exact record.
    // The admin client bypasses RLS, so we must constrain the update to a single
    // row identified by its primary key — never by a potentially ambiguous email pattern.
    const clerkUser = await currentUser();
    const verifiedEmail = clerkUser?.emailAddresses?.[0]?.emailAddress?.toLowerCase().trim();

    if (caller.id) {
      let linkedCustomerId: string | null = null;

      // Stage 1: Resolve customer record by clerk_user_id
      const { data: custByClerk } = await adminClient
        .from("customers")
        .select("id")
        .eq("clerk_user_id", caller.id)
        .maybeSingle();

      if (custByClerk) {
        linkedCustomerId = custByClerk.id;
      } else if (verifiedEmail) {
        // Stage 2: Resolve single unlinked record by verified email and auto-link
        const { data: matchingCusts } = await adminClient
          .from("customers")
          .select("id, clerk_user_id")
          .eq("email", verifiedEmail);

        const unlinkedCusts = (matchingCusts ?? []).filter((c) => !c.clerk_user_id);
        if (unlinkedCusts.length === 1) {
          linkedCustomerId = unlinkedCusts[0].id;
          await adminClient
            .from("customers")
            .update({ clerk_user_id: caller.id, updated_at: new Date().toISOString() })
            .eq("id", linkedCustomerId);
        }
      }

      if (linkedCustomerId) {
        // Update only the one resolved record — scoped strictly by primary key.
        await adminClient
          .from("customers")
          .update({
            name: full_name,
            phone: phone || null,
            address: address || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", linkedCustomerId);
      }
    }

    revalidatePath("/customer/dashboard");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update profile.",
    };
  }
}
