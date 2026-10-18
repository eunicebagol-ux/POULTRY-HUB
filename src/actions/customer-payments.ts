"use server";

/**
 * POULTRY HUB — Customer Payment Submission Server Actions
 *
 * SECURITY CONTRACT:
 *   1. customer_id is ALWAYS resolved server-side via resolveCustomerRecord().
 *      Never trusted from client input.
 *   2. Verification fields (verified_by, verified_at, verification_notes,
 *      rejection_reason) are set ONLY by STAFF/ADMIN actions.
 *   3. Customers cannot mark their own payments as VERIFIED.
 *   4. Customers cannot submit duplicate active payments for the same order.
 *   5. Declared amounts are informational. Authoritative invoicing is done
 *      by STAFF/ADMIN via record_egg_sale() in the egg_sales workflow.
 *   6. Order must be in CONFIRMED or later status for payment to be submitted
 *      (prevents payments on unreviewed PENDING orders).
 *   7. Status transitions use concurrency-safe atomic UPDATEs.
 *
 * MIGRATION DEPENDENCY:
 *   Requires Migration 015 (customer_payment_submissions table) plus
 *   Migrations 012 (CUSTOMER role) and 014 (customer_orders) to be applied.
 *   Until then, all actions return a 503-style error.
 */

import { getCurrentUserProfile } from "@/lib/user-profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import {
  submitPaymentSubmissionSchema,
  verifyPaymentSubmissionSchema,
  type SubmitPaymentSubmissionInput,
  type VerifyPaymentSubmissionInput,
} from "@/lib/validations/customer-payments";
import type {
  CustomerPaymentMethod,
  CustomerPaymentStatus,
  CustomerPaymentSubmission,
} from "@/types";

export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

// ─── Helper: table-exists guard ───────────────────────────────────────────────

function isMigration015Missing(errorMsg: string, code?: string): boolean {
  return (
    errorMsg?.includes("does not exist") ||
    code === "42P01" ||
    errorMsg?.includes("customer_payment_submissions") ||
    errorMsg?.includes("customer_payment_method") ||
    errorMsg?.includes("customer_payment_status")
  );
}

// ─── Helper: Resolve authenticated customer record ────────────────────────────

async function resolveCustomerRecord(
  callerId: string
): Promise<{ id: string; is_active: boolean } | null> {
  const supabase = await createClient();

  // Primary: Clerk ID linkage
  const { data: byClerkId } = await supabase
    .from("customers")
    .select("id, is_active")
    .eq("clerk_user_id", callerId)
    .maybeSingle();

  if (byClerkId) return byClerkId;

  // Fallback: verified email (safe — Clerk guarantees ownership)
  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  const verifiedEmailObj =
    clerkUser.emailAddresses?.find(
      (e) =>
        e.id === clerkUser.primaryEmailAddressId &&
        e.verification?.status === "verified"
    ) ??
    clerkUser.emailAddresses?.find(
      (e) => e.verification?.status === "verified"
    );

  const verifiedEmail = verifiedEmailObj?.emailAddress?.toLowerCase().trim();
  if (!verifiedEmail) return null;

  const { data: byEmail } = await supabase
    .from("customers")
    .select("id, is_active, clerk_user_id")
    .eq("email", verifiedEmail);

  const unlinked = (byEmail ?? []).filter((c) => !c.clerk_user_id);
  if (unlinked.length !== 1) return null;

  // Auto-link
  const adminClient = createAdminClient();
  await adminClient
    .from("customers")
    .update({ clerk_user_id: callerId, updated_at: new Date().toISOString() })
    .eq("id", unlinked[0].id);

  return { id: unlinked[0].id, is_active: unlinked[0].is_active };
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Fetches the payment submission for a specific order.
 * CUSTOMER: may only query their own orders.
 * STAFF/ADMIN: may query any order.
 * Returns null if no submission exists (not an error — order may not have one yet).
 */
export async function getPaymentForOrder(
  orderId: string
): Promise<ActionResult<CustomerPaymentSubmission | null>> {
  const caller = await getCurrentUserProfile();

  if (!caller || !caller.is_active) {
    return { success: false, error: "Unauthorized: active account required." };
  }

  if (!orderId) {
    return { success: false, error: "order_id is required." };
  }

  try {
    const supabase = await createClient();

    // For customers: verify order ownership before exposing payment data
    if (caller.role === "CUSTOMER") {
      const customerRecord = await resolveCustomerRecord(caller.id);
      if (!customerRecord || !customerRecord.is_active) {
        return {
          success: false,
          error: "Customer account not found or not active.",
        };
      }

      // Verify order belongs to this customer (belt + suspenders)
      const { data: order } = await supabase
        .from("customer_orders")
        .select("id, customer_id")
        .eq("id", orderId)
        .maybeSingle();

      if (!order || order.customer_id !== customerRecord.id) {
        return { success: false, error: "Order not found." };
      }
    }

    const { data, error } = await supabase
      .from("customer_payment_submissions")
      .select(
        "id, order_id, customer_id, payment_method, status, reference_number, customer_notes, declared_amount, verified_by, verified_at, verification_notes, rejection_reason, created_at, updated_at"
      )
      .eq("order_id", orderId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      if (isMigration015Missing(error.message, error.code)) {
        return { success: true, data: null }; // Migration not applied — return gracefully
      }
      return { success: false, error: error.message };
    }

    return {
      success: true,
      data: data
        ? {
            ...data,
            payment_method: data.payment_method as CustomerPaymentMethod,
            status: data.status as CustomerPaymentStatus,
            declared_amount: data.declared_amount
              ? Number(data.declared_amount)
              : null,
          }
        : null,
    };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Failed to load payment info.",
    };
  }
}

/**
 * STAFF/ADMIN: Fetches all payment submissions for the management view.
 * Returns newest first. Includes customer name and order reference.
 */
export interface PaymentSubmissionManagementRow extends CustomerPaymentSubmission {
  customer_name: string;
  order_created_at: string;
}

export async function getAllPaymentSubmissions(): Promise<
  ActionResult<PaymentSubmissionManagementRow[]>
> {
  const caller = await getCurrentUserProfile();

  if (
    !caller ||
    !caller.is_active ||
    !["ADMIN", "STAFF"].includes(caller.role)
  ) {
    return {
      success: false,
      error: "Unauthorized: STAFF or ADMIN account required.",
    };
  }

  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("customer_payment_submissions")
      .select(
        `
        id,
        order_id,
        customer_id,
        payment_method,
        status,
        reference_number,
        customer_notes,
        declared_amount,
        verified_by,
        verified_at,
        verification_notes,
        rejection_reason,
        created_at,
        updated_at,
        customer:customers ( name ),
        order:customer_orders ( created_at )
      `
      )
      .order("created_at", { ascending: false })
      .limit(300);

    if (error) {
      if (isMigration015Missing(error.message, error.code)) {
        return { success: true, data: [] };
      }
      return { success: false, error: error.message };
    }

    interface RawRow {
      id: string;
      order_id: string;
      customer_id: string;
      payment_method: string;
      status: string;
      reference_number: string | null;
      customer_notes: string | null;
      declared_amount: string | number | null;
      verified_by: string | null;
      verified_at: string | null;
      verification_notes: string | null;
      rejection_reason: string | null;
      created_at: string;
      updated_at: string;
      customer?: { name: string } | null;
      order?: { created_at: string } | null;
    }

    const rows: PaymentSubmissionManagementRow[] = (
      (data ?? []) as unknown as RawRow[]
    ).map((r) => ({
      id: r.id,
      order_id: r.order_id,
      customer_id: r.customer_id,
      payment_method: r.payment_method as CustomerPaymentMethod,
      status: r.status as CustomerPaymentStatus,
      reference_number: r.reference_number,
      customer_notes: r.customer_notes,
      declared_amount: r.declared_amount != null ? Number(r.declared_amount) : null,
      verified_by: r.verified_by,
      verified_at: r.verified_at,
      verification_notes: r.verification_notes,
      rejection_reason: r.rejection_reason,
      created_at: r.created_at,
      updated_at: r.updated_at,
      customer_name: r.customer?.name ?? "Unknown Customer",
      order_created_at: r.order?.created_at ?? r.created_at,
    }));

    return { success: true, data: rows };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to load payment submissions.",
    };
  }
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/**
 * CUSTOMER: Submits a payment submission for an order.
 *
 * SECURITY GUARANTEES:
 *   - customer_id is resolved server-side via resolveCustomerRecord().
 *   - Order must belong to the customer (ownership verified before insert).
 *   - Order must be CONFIRMED or later (not PENDING, CANCELLED, COMPLETED).
 *   - Only one active (non-REJECTED) submission per order is allowed.
 *   - GCash and Bank Transfer require a reference_number.
 *   - Status is hardcoded to 'SUBMITTED' — customer cannot self-verify.
 *   - Verification fields are never set by this action.
 */
export async function submitPaymentSubmission(
  input: SubmitPaymentSubmissionInput
): Promise<ActionResult<{ submissionId: string }>> {
  const caller = await getCurrentUserProfile();

  if (!caller || !caller.is_active) {
    return { success: false, error: "Unauthorized: active account required." };
  }

  if (caller.role !== "CUSTOMER") {
    return {
      success: false,
      error: "Only approved CUSTOMER accounts may submit payment information.",
    };
  }

  // Validate input
  const parsed = submitPaymentSubmissionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid payment input.",
    };
  }

  const {
    order_id,
    payment_method,
    declared_amount,
    reference_number,
    customer_notes,
  } = parsed.data;

  // Strictly validate declared_amount if provided (must be finite positive number)
  if (declared_amount !== undefined) {
    if (
      typeof declared_amount !== "number" ||
      !Number.isFinite(declared_amount) ||
      Number.isNaN(declared_amount) ||
      declared_amount <= 0 ||
      declared_amount > 9_999_999
    ) {
      return {
        success: false,
        error: "Declared amount must be a valid positive number up to 9,999,999.",
      };
    }
  }

  // Resolve customer record server-side
  const customerRecord = await resolveCustomerRecord(caller.id);
  if (!customerRecord) {
    return {
      success: false,
      error:
        "Your account is not linked to a customer record. Please contact the farm administrator.",
    };
  }

  if (!customerRecord.is_active) {
    return {
      success: false,
      error: "Your customer account is not active.",
    };
  }

  try {
    const supabase = await createClient();

    // ── Verify order ownership, status, and fetch server-authoritative items ──
    const { data: order, error: orderErr } = await supabase
      .from("customer_orders")
      .select("id, customer_id, status, customer_order_items(package_quantity, quoted_unit_price)")
      .eq("id", order_id)
      .maybeSingle();

    if (orderErr) {
      if (isMigration015Missing(orderErr.message, orderErr.code)) {
        return {
          success: false,
          error:
            "Payment submission is not yet available. Please contact the farm administrator.",
        };
      }
      return { success: false, error: orderErr.message };
    }

    if (!order) {
      return { success: false, error: "Order not found." };
    }

    // Strict ownership check (belt + suspenders)
    if (order.customer_id !== customerRecord.id) {
      return { success: false, error: "Order not found." }; // Obfuscate
    }

    // Calculate trusted estimated total on the server from order items
    type OrderItemSummary = { package_quantity: number; quoted_unit_price: number | string };
    const orderItems = (order.customer_order_items as unknown as OrderItemSummary[] | null) ?? [];
    const trustedEstimatedTotal = orderItems.reduce((sum, item) => {
      const qty = Number(item.package_quantity) || 0;
      const price = Number(item.quoted_unit_price) || 0;
      return sum + qty * price;
    }, 0);

    // Enforce: order must be CONFIRMED or later, not PENDING/CANCELLED/COMPLETED
    const allowedStatuses = ["CONFIRMED", "PREPARING", "READY"];
    if (!allowedStatuses.includes(order.status)) {
      const statusMessages: Record<string, string> = {
        PENDING:
          "Payment can only be submitted after the farm has confirmed your order. Please wait for confirmation.",
        COMPLETED:
          "This order has already been completed.",
        CANCELLED:
          "Cannot submit payment for a cancelled order.",
      };
      return {
        success: false,
        error:
          statusMessages[order.status] ??
          `Payment cannot be submitted for an order in ${order.status} status.`,
      };
    }

    // ── Duplicate-payment protection (Application check) ─────────────────────
    // Check for an active (non-REJECTED) submission already on this order
    const { data: existing, error: existingErr } = await supabase
      .from("customer_payment_submissions")
      .select("id, status, payment_method")
      .eq("order_id", order_id)
      .neq("status", "REJECTED")
      .maybeSingle();

    if (existingErr && !isMigration015Missing(existingErr.message, existingErr.code)) {
      return { success: false, error: existingErr.message };
    }

    if (existing) {
      const statusLabel: Record<string, string> = {
        PENDING_SUBMISSION: "already has a pending payment",
        SUBMITTED: "already has a payment submission awaiting verification",
        VERIFIED: "has already been verified",
        REFUNDED: "has already been refunded",
      };
      return {
        success: false,
        error: `This order ${statusLabel[existing.status] ?? "already has an active payment submission"}. Please contact the farm team if you need to make changes.`,
      };
    }

    // ── Insert the payment submission ────────────────────────────────────────
    const adminClient = createAdminClient();

    const { data: submissionData, error: insertErr } = await adminClient
      .from("customer_payment_submissions")
      .insert({
        order_id,
        customer_id: customerRecord.id, // Server-resolved, never client
        payment_method,
        status: "SUBMITTED",             // Hardcoded — customer cannot self-verify
        reference_number: reference_number?.trim() || null,
        customer_notes: customer_notes?.trim() || null,
        // declared_amount is informational only; authoritative total is calculated server-side
        declared_amount: declared_amount ?? null,
        // Verification fields: explicitly NULL — set only by STAFF/ADMIN
        verified_by: null,
        verified_at: null,
        verification_notes: null,
        rejection_reason: null,
      })
      .select("id")
      .single();

    if (insertErr) {
      // Handle PostgreSQL unique constraint violation (code 23505) from partial unique index
      if (insertErr.code === "23505") {
        return {
          success: false,
          error:
            "This order already has an active payment submission. Please contact the farm team if you need to make changes.",
        };
      }
      if (isMigration015Missing(insertErr.message, insertErr.code)) {
        return {
          success: false,
          error:
            "Payment submission is not yet available. Please contact the farm administrator.",
        };
      }
      return { success: false, error: insertErr.message };
    }

    // ── Audit log ────────────────────────────────────────────────────────────
    try {
      await adminClient.from("activity_logs").insert({
        actor_id: caller.id,
        action: "CUSTOMER_PAYMENT_SUBMITTED",
        entity_table: "customer_payment_submissions",
        entity_id: submissionData.id,
        metadata: {
          order_id,
          customer_id: customerRecord.id,
          payment_method,
          status: "SUBMITTED",
          declared_amount: declared_amount ?? null,
          trusted_estimated_total: trustedEstimatedTotal,
        },
      });
    } catch (auditErr) {
      console.warn("Could not write CUSTOMER_PAYMENT_SUBMITTED audit log:", auditErr);
    }

    revalidatePath("/customer/orders");
    revalidatePath("/customer/dashboard");
    revalidatePath("/customer-orders");

    return { success: true, data: { submissionId: submissionData.id } };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Failed to submit payment.",
    };
  }
}

/**
 * STAFF/ADMIN: Verifies or rejects a customer payment submission.
 *
 * SECURITY & ARCHITECTURAL GUARANTEES:
 *   - Only STAFF or ADMIN may call this action.
 *   - Submission must be in SUBMITTED status (already verified/rejected submissions rejected).
 *   - Concurrency-safe: uses atomic UPDATE with .eq("status", "SUBMITTED").
 *   - verified_by is always set to the caller's profile ID (server-controlled).
 *   - Rejection requires a reason.
 *   - LEDGER SEPARATION: Verifying this submission confirms the customer-facing
 *     payment proof/intent. It intentionally DOES NOT create a row in the authoritative
 *     egg_sales or payments ledger. Physical cash collection or bank reconciliation
 *     must still be officially posted through the standard Egg Sales fulfillment workflow.
 */
export async function verifyPaymentSubmission(
  input: VerifyPaymentSubmissionInput
): Promise<ActionResult> {
  const caller = await getCurrentUserProfile();

  if (
    !caller ||
    !caller.is_active ||
    !["ADMIN", "STAFF"].includes(caller.role)
  ) {
    return {
      success: false,
      error: "Unauthorized: STAFF or ADMIN account required.",
    };
  }

  const parsed = verifyPaymentSubmissionSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input.",
    };
  }

  const { submission_id, action, verification_notes, rejection_reason } =
    parsed.data;

  // Rejection must include a reason
  if (action === "REJECT" && !rejection_reason?.trim()) {
    return {
      success: false,
      error: "A rejection reason is required when rejecting a payment.",
    };
  }

  try {
    const supabase = await createClient();

    // Fetch current submission to validate state
    const { data: submission, error: fetchErr } = await supabase
      .from("customer_payment_submissions")
      .select("id, status, order_id, payment_method")
      .eq("id", submission_id)
      .single();

    if (fetchErr || !submission) {
      return { success: false, error: "Payment submission not found." };
    }

    if (submission.status !== "SUBMITTED") {
      return {
        success: false,
        error: `Cannot ${action.toLowerCase()} a submission that is currently ${submission.status}. Only SUBMITTED payments can be verified or rejected.`,
      };
    }

    const newStatus: CustomerPaymentStatus =
      action === "VERIFY" ? "VERIFIED" : "REJECTED";

    const updatePayload: {
      status: CustomerPaymentStatus;
      verified_by: string;
      verified_at: string;
      updated_at: string;
      verification_notes?: string | null;
      rejection_reason?: string | null;
    } = {
      status: newStatus,
      verified_by: caller.id,
      verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      verification_notes: verification_notes?.trim() || null,
      rejection_reason: action === "REJECT" ? rejection_reason?.trim() || null : null,
    };

    // Concurrency-safe atomic UPDATE — only matches if still SUBMITTED
    const { data: updatedRows, error: updateErr } = await supabase
      .from("customer_payment_submissions")
      .update(updatePayload)
      .eq("id", submission_id)
      .eq("status", "SUBMITTED") // Atomic guard against concurrent modification
      .select("id");

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    if (!updatedRows || updatedRows.length === 0) {
      return {
        success: false,
        error:
          "Payment submission status was modified concurrently. Please refresh and try again.",
      };
    }

    // Audit log
    try {
      const adminClient = createAdminClient();
      await adminClient.from("activity_logs").insert({
        actor_id: caller.id,
        action:
          action === "VERIFY"
            ? "CUSTOMER_PAYMENT_VERIFIED"
            : "CUSTOMER_PAYMENT_REJECTED",
        entity_table: "customer_payment_submissions",
        entity_id: submission_id,
        metadata: {
          order_id: submission.order_id,
          payment_method: submission.payment_method,
          new_status: newStatus,
          verified_by_role: caller.role,
          rejection_reason: rejection_reason?.trim() || null,
        },
      });
    } catch (auditErr) {
      console.warn(
        "Could not write payment verification audit log:",
        auditErr
      );
    }

    revalidatePath("/customer/orders");
    revalidatePath("/customer/dashboard");
    revalidatePath("/customer-orders");

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to update payment submission.",
    };
  }
}
