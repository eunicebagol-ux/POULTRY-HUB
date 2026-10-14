"use server";

import { getCurrentUserProfile } from "@/lib/user-profile";
import { createClient } from "@/lib/supabase/server";
import {
  recordPaymentSchema,
  type RecordPaymentInput,
} from "@/lib/validations/payments";
import { revalidatePath } from "next/cache";
import type { PaymentRecordView } from "@/types";

export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

// ─── View Types ───────────────────────────────────────────────────────────────

export interface PaymentSummary {
  sale_id: string;
  total_amount: number;
  total_paid: number;
  remaining_balance: number;
  payment_status: string;
  payments: PaymentRecordView[];
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Fetches all payment records for a specific egg sale.
 * RLS: SELECT is permitted for all active authenticated users.
 */
export async function getPaymentsForSale(
  saleId: string
): Promise<ActionResult<PaymentRecordView[]>> {
  const caller = await getCurrentUserProfile();
  if (!caller || !caller.is_active) {
    return { success: false, error: "Unauthorized: active account required." };
  }

  if (!saleId) {
    return { success: false, error: "sale_id is required." };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("payments")
      .select(`
        id,
        sale_id,
        amount,
        payment_method,
        payment_date,
        reference_number,
        notes,
        recorded_by,
        created_at,
        recorded_by_profile:profiles!payments_recorded_by_fkey(full_name)
      `)
      .eq("sale_id", saleId)
      .order("payment_date", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      data: (data ?? []) as unknown as PaymentRecordView[],
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to load payments.",
    };
  }
}

/**
 * Fetches a payment summary for a specific egg sale:
 * total_paid, remaining_balance, and individual payments.
 * Used by the payment dialog and sale detail view.
 */
export async function getPaymentSummaryForSale(
  saleId: string
): Promise<ActionResult<PaymentSummary>> {
  const caller = await getCurrentUserProfile();
  if (!caller || !caller.is_active) {
    return { success: false, error: "Unauthorized: active account required." };
  }

  try {
    const supabase = await createClient();

    // Fetch the sale total and current payment_status
    const { data: sale, error: saleError } = await supabase
      .from("egg_sales")
      .select("id, total_amount, payment_status")
      .eq("id", saleId)
      .single();

    if (saleError || !sale) {
      return {
        success: false,
        error: saleError?.message ?? "Sale not found.",
      };
    }

    // Fetch all payment records for this sale
    const { data: payments, error: payError } = await supabase
      .from("payments")
      .select(`
        id,
        sale_id,
        amount,
        payment_method,
        payment_date,
        reference_number,
        notes,
        recorded_by,
        created_at,
        recorded_by_profile:profiles!payments_recorded_by_fkey(full_name)
      `)
      .eq("sale_id", saleId)
      .order("payment_date", { ascending: true })
      .order("created_at", { ascending: true });

    if (payError) {
      return { success: false, error: payError.message };
    }

    const paymentList = (payments ?? []) as unknown as PaymentRecordView[];
    const totalPaid = paymentList.reduce((sum, p) => sum + p.amount, 0);
    const remainingBalance = sale.total_amount - totalPaid;

    return {
      success: true,
      data: {
        sale_id: saleId,
        total_amount: sale.total_amount,
        total_paid: totalPaid,
        remaining_balance: remainingBalance,
        payment_status: sale.payment_status,
        payments: paymentList,
      },
    };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to load payment summary.",
    };
  }
}

/**
 * Returns payment summaries aggregated per customer.
 * Used on the Customers page to show outstanding balances.
 * ADMIN only to prevent financial information exposure to STAFF.
 */
export interface CustomerBalanceSummary {
  customer_id: string;
  customer_name: string;
  total_sales: number;
  total_paid: number;
  outstanding_balance: number;
}

export async function getCustomerBalanceSummaries(): Promise<
  ActionResult<CustomerBalanceSummary[]>
> {
  const caller = await getCurrentUserProfile();
  if (!caller || !caller.is_active) {
    return { success: false, error: "Unauthorized: active account required." };
  }

  if (caller.role !== "ADMIN") {
    return {
      success: false,
      error: "Unauthorized: ADMIN access required for financial summaries.",
    };
  }

  try {
    const supabase = await createClient();

    // Fetch non-cancelled sales grouped by customer
    const { data: sales, error: salesError } = await supabase
      .from("egg_sales")
      .select(
        "id, customer_id, total_amount, payment_status, customer:customers(id, name)"
      )
      .neq("payment_status", "CANCELLED")
      .not("customer_id", "is", null);

    if (salesError) {
      return { success: false, error: salesError.message };
    }

    // Fetch all payments for those sales
    const saleIds = (sales ?? []).map((s) => s.id);
    let payments: { sale_id: string; amount: number }[] = [];

    if (saleIds.length > 0) {
      const { data: paymentsData, error: paymentsError } = await supabase
        .from("payments")
        .select("sale_id, amount")
        .in("sale_id", saleIds);

      if (paymentsError) {
        return { success: false, error: paymentsError.message };
      }

      payments = paymentsData ?? [];
    }

    // Build per-payment totals map
    const paidBySale = new Map<string, number>();
    for (const p of payments) {
      paidBySale.set(p.sale_id, (paidBySale.get(p.sale_id) ?? 0) + p.amount);
    }

    // Aggregate per customer
    const customerMap = new Map<
      string,
      {
        customer_id: string;
        customer_name: string;
        total_sales: number;
        total_paid: number;
      }
    >();

    for (const sale of sales ?? []) {
      const customerId = sale.customer_id as string;
      const customerName =
        (sale.customer as { id: string; name: string } | null)?.name ??
        "Unknown Customer";
      const saleTotal = sale.total_amount;
      const salePaid = paidBySale.get(sale.id) ?? 0;

      if (!customerMap.has(customerId)) {
        customerMap.set(customerId, {
          customer_id: customerId,
          customer_name: customerName,
          total_sales: 0,
          total_paid: 0,
        });
      }

      const entry = customerMap.get(customerId)!;
      entry.total_sales += saleTotal;
      entry.total_paid += salePaid;
    }

    const summaries: CustomerBalanceSummary[] = Array.from(
      customerMap.values()
    )
      .map((c) => ({
        ...c,
        outstanding_balance: c.total_sales - c.total_paid,
      }))
      .sort((a, b) => b.outstanding_balance - a.outstanding_balance);

    return { success: true, data: summaries };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to load customer balance summaries.",
    };
  }
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/**
 * Records a customer payment against an egg sale via the secure
 * record_egg_payment() PostgreSQL RPC.
 *
 * PostgreSQL Authority Guarantees:
 * - Locks egg_sales row with FOR UPDATE (race-condition safe).
 * - Validates sale exists and is not cancelled.
 * - Calculates remaining balance server-side from authoritative ledger.
 * - Rejects overpayment (payment > remaining balance).
 * - Rejects amount <= 0.
 * - Appends immutable record to the payments ledger.
 * - Recalculates and updates egg_sales.payment_status atomically.
 * - Logs RECORD_PAYMENT to activity_logs in the same transaction.
 * - Rolls back everything on any failure.
 *
 * Does NOT affect egg inventory.
 */
export async function recordPayment(
  input: RecordPaymentInput
): Promise<ActionResult<{ payment_id: string }>> {
  const caller = await getCurrentUserProfile();
  if (!caller || !caller.is_active) {
    return { success: false, error: "Unauthorized: active account required." };
  }

  const parsed = recordPaymentSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid payment parameters.",
    };
  }

  const { sale_id, amount, payment_method, payment_date, reference_number, notes } =
    parsed.data;

  try {
    const supabase = await createClient();

    const { data, error } = await supabase.rpc("record_egg_payment", {
      p_sale_id: sale_id,
      p_amount: amount,
      p_payment_method: payment_method,
      p_payment_date: payment_date,
      p_reference_number: reference_number?.trim() || null,
      p_notes: notes?.trim() || null,
    });

    if (error) {
      // Surface human-readable messages for common RPC exceptions
      if (error.message.includes("Overpayment") || error.message.includes("exceeds remaining balance")) {
        return {
          success: false,
          error: error.message,
        };
      }
      if (error.message.includes("cancelled sale")) {
        return {
          success: false,
          error: "Cannot record payment for a cancelled sale.",
        };
      }
      if (error.message.includes("already fully paid")) {
        return {
          success: false,
          error: "This sale is already fully paid. No balance remaining.",
        };
      }
      if (error.message.includes("greater than zero")) {
        return {
          success: false,
          error: "Payment amount must be greater than zero.",
        };
      }
      return { success: false, error: error.message };
    }

    revalidatePath("/egg-sales");
    revalidatePath("/customers");
    revalidatePath("/dashboard");
    revalidatePath("/reports");

    return { success: true, data: { payment_id: data as string } };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to record payment.",
    };
  }
}
