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

import { resolveCustomerDisplayName } from "@/lib/customer-display";
import { calculateCustomerFinancialSummary } from "@/lib/customer-financial-summary";

/**
 * Lightweight helper for layout header display.
 * Resolves the customer's name from profile, customer record, or Clerk identity.
 */
export async function getCustomerDisplayName(): Promise<string> {
  try {
    const caller = await getCurrentUserProfile();
    if (!caller) {
      return "Customer";
    }

    const clerkUser = await currentUser();
    const verifiedEmail =
      clerkUser?.emailAddresses?.find(
        (e) =>
          (clerkUser.primaryEmailAddressId ? e.id === clerkUser.primaryEmailAddressId : false) &&
          e.verification?.status === "verified"
      )?.emailAddress?.toLowerCase().trim() ||
      clerkUser?.emailAddresses?.find((e) => e.verification?.status === "verified")
        ?.emailAddress?.toLowerCase().trim() ||
      clerkUser?.emailAddresses?.[0]?.emailAddress?.toLowerCase().trim();

    // Look for customer record in customers table (safely without crashing on missing clerk_user_id column)
    let customerRecord: { name: string | null; contact_person: string | null; email: string | null } | null = null;
    try {
      const adminClient = createAdminClient();

      // Check by clerk_user_id if column exists
      try {
        const { data: byClerk } = await adminClient
          .from("customers")
          .select("name, contact_person, email")
          .eq("clerk_user_id", caller.id)
          .maybeSingle();

        if (byClerk) {
          customerRecord = byClerk;
        }
      } catch {
        // clerk_user_id column might not exist in database schema
      }

      // Fallback: check by verified email
      if (!customerRecord && verifiedEmail) {
        const { data: byEmail } = await adminClient
          .from("customers")
          .select("name, contact_person, email")
          .eq("email", verifiedEmail)
          .maybeSingle();

        if (byEmail) {
          customerRecord = byEmail;
        }
      }
    } catch {
      // Graceful fallback if database lookup fails
    }

    return resolveCustomerDisplayName({
      profile: caller,
      customerRecord,
      clerkUser,
      email: verifiedEmail,
    });
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

    const adminClient = createAdminClient();

    // Stage 1: Lookup using clerk_user_id if column exists
    try {
      const { data: custByClerkId, error: clerkColErr } = await adminClient
        .from("customers")
        .select("id, name, contact_person, phone, email, address, is_active")
        .eq("clerk_user_id", caller.id)
        .maybeSingle();

      if (!clerkColErr && custByClerkId) {
        customerRecord = custByClerkId;
      }
    } catch {
      // clerk_user_id column might not exist in database schema
    }

    // Stage 2: Safe lookup via verified email
    if (!customerRecord && verifiedEmail) {
      try {
        const { data: matchingCusts } = await adminClient
          .from("customers")
          .select("id, name, contact_person, phone, email, address, is_active")
          .eq("email", verifiedEmail);

        if (matchingCusts && matchingCusts.length === 1) {
          const targetCust = matchingCusts[0];
          customerRecord = {
            id: targetCust.id,
            name: targetCust.name,
            contact_person: targetCust.contact_person,
            phone: targetCust.phone,
            email: targetCust.email,
            address: targetCust.address,
            is_active: targetCust.is_active,
          };

          // If clerk_user_id column exists, link it safely
          try {
            await adminClient
              .from("customers")
              .update({
                clerk_user_id: caller.id,
                updated_at: new Date().toISOString(),
              })
              .eq("id", targetCust.id);
          } catch {
            // Ignore if clerk_user_id column is not present
          }
        }
      } catch {
        // Safe fallback if customers table query fails
      }
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

    // Helper to distinguish missing migration from operational DB errors
    const isMigrationMissing = (err: { message?: string; code?: string } | null | undefined) =>
      !err ||
      err.code === "42P01" ||
      err.code === "PGRST205" ||
      err.message?.includes("does not exist") ||
      err.message?.includes("schema cache");

    // Fetch customer intake orders for financial obligation calculation
    interface RawOrderItem {
      package_quantity: number;
      quoted_unit_price: number;
    }
    interface RawCustomerOrder {
      id: string;
      status: string;
      sale_id: string | null;
      customer_order_items?: RawOrderItem[];
    }

    let customerOrders: RawCustomerOrder[] = [];
    try {
      const { data: ordersData, error: ordersErr } = await supabase
        .from("customer_orders")
        .select(`
          id,
          status,
          sale_id,
          customer_order_items (
            package_quantity,
            quoted_unit_price
          )
        `)
        .eq("customer_id", customerRecord.id);

      if (!ordersErr && ordersData) {
        customerOrders = ordersData as unknown as RawCustomerOrder[];
      } else {
        const { data: adminOrders, error: adminOrdersErr } = await adminClient
          .from("customer_orders")
          .select(`
            id,
            status,
            sale_id,
            customer_order_items (
              package_quantity,
              quoted_unit_price
            )
          `)
          .eq("customer_id", customerRecord.id);

        if (!adminOrdersErr && adminOrders) {
          customerOrders = adminOrders as unknown as RawCustomerOrder[];
        } else if (!isMigrationMissing(ordersErr) && !isMigrationMissing(adminOrdersErr)) {
          console.error("Operational error loading customer orders:", ordersErr || adminOrdersErr);
          return { success: false, error: "Failed to load customer orders." };
        }
      }
    } catch (ordersEx) {
      console.error("Exception loading customer orders:", ordersEx);
      return { success: false, error: "Failed to load customer orders." };
    }

    // Fetch verified customer payment submissions
    interface RawPaymentSubmission {
      id: string;
      order_id: string;
      declared_amount: number | null;
      status: string;
    }

    let verifiedSubmissions: RawPaymentSubmission[] = [];
    try {
      const { data: subData, error: subErr } = await supabase
        .from("customer_payment_submissions")
        .select("id, order_id, declared_amount, status")
        .eq("customer_id", customerRecord.id)
        .eq("status", "VERIFIED");

      if (!subErr && subData) {
        verifiedSubmissions = subData as unknown as RawPaymentSubmission[];
      } else {
        const { data: adminSubs, error: adminSubErr } = await adminClient
          .from("customer_payment_submissions")
          .select("id, order_id, declared_amount, status")
          .eq("customer_id", customerRecord.id)
          .eq("status", "VERIFIED");

        if (!adminSubErr && adminSubs) {
          verifiedSubmissions = adminSubs as unknown as RawPaymentSubmission[];
        } else if (!isMigrationMissing(subErr) && !isMigrationMissing(adminSubErr)) {
          console.error("Operational error loading payment submissions:", subErr || adminSubErr);
          return { success: false, error: "Failed to load verified payment submissions." };
        }
      }
    } catch (subEx) {
      console.error("Exception loading payment submissions:", subEx);
      return { success: false, error: "Failed to load verified payment submissions." };
    }

    // Calculate authoritative totals incorporating orders, sales invoices, and verified payments
    const summary = calculateCustomerFinancialSummary({
      purchases,
      orders: customerOrders.map((o) => ({
        id: o.id,
        status: o.status,
        sale_id: o.sale_id ?? null,
        items: (o.customer_order_items ?? []).map((i) => ({
          package_quantity: Number(i.package_quantity) || 0,
          quoted_unit_price: Number(i.quoted_unit_price) || 0,
        })),
      })),
      ledgerPayments: payments.map((p) => ({
        sale_id: p.sale_id,
        amount: p.amount,
      })),
      paymentSubmissions: verifiedSubmissions.map((s) => ({
        order_id: s.order_id,
        declared_amount: s.declared_amount != null ? Number(s.declared_amount) : null,
        status: s.status,
      })),
    });

    return {
      success: true,
      data: {
        profile: caller,
        customerRecord,
        purchases,
        payments,
        summary,
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

      // Stage 1: Try resolve customer record by clerk_user_id if column exists
      try {
        const { data: custByClerk, error: clerkErr } = await adminClient
          .from("customers")
          .select("id")
          .eq("clerk_user_id", caller.id)
          .maybeSingle();

        if (!clerkErr && custByClerk) {
          linkedCustomerId = custByClerk.id;
        }
      } catch {
        // clerk_user_id column might not exist
      }

      // Stage 2: Resolve record by verified email
      if (!linkedCustomerId && verifiedEmail) {
        try {
          const { data: matchingCusts } = await adminClient
            .from("customers")
            .select("id")
            .eq("email", verifiedEmail);

          if (matchingCusts && matchingCusts.length === 1) {
            linkedCustomerId = matchingCusts[0].id;
            try {
              await adminClient
                .from("customers")
                .update({ clerk_user_id: caller.id, updated_at: new Date().toISOString() })
                .eq("id", linkedCustomerId);
            } catch {
              // Ignore if clerk_user_id column is not present
            }
          }
        } catch {
          // Safe fallback
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
