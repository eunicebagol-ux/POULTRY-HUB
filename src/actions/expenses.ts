"use server";

import { getCurrentUserProfile } from "@/lib/user-profile";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  createExpenseSchema,
  updateExpenseSchema,
  isSystemCategory,
  type CreateExpenseInput,
  type UpdateExpenseInput,
} from "@/lib/validations/expenses";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

export interface SupplierOption {
  id: string;
  name: string;
}

export interface ExpenseRow {
  id: string;
  expense_date: string;
  category: string;
  amount: number;
  description: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Fetches all expenses joined with supplier name, ordered newest-first.
 * Uses the authenticated user's client so RLS is enforced.
 */
export async function getExpenses(): Promise<ActionResult<ExpenseRow[]>> {
  const caller = await getCurrentUserProfile();
  if (!caller || !caller.is_active) {
    return { success: false, error: "Unauthorized: active account required." };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("expenses")
    .select(
      `
      id,
      expense_date,
      category,
      amount,
      description,
      supplier_id,
      created_by,
      created_at,
      updated_at,
      supplier:suppliers ( name )
    `
    )
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getExpenses]", error.message);
    return { success: false, error: "Failed to load expenses." };
  }

  // Use `as unknown as` to work around PostgREST join type inference,
  // consistent with the pattern used in egg-sales.ts.
  const rawRows = (data ?? []) as unknown as Array<{
    id: string;
    expense_date: string;
    category: string;
    amount: number;
    description: string | null;
    supplier_id: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
    supplier: { name: string } | null;
  }>;

  const rows: ExpenseRow[] = rawRows.map((row) => ({
    id: row.id,
    expense_date: row.expense_date,
    category: row.category,
    amount: Number(row.amount),
    description: row.description,
    supplier_id: row.supplier_id,
    supplier_name: row.supplier?.name ?? null,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));

  return { success: true, data: rows };
}

/**
 * Fetches active suppliers for use in expense form dropdowns.
 */
export async function getActiveSuppliersForExpenses(): Promise<
  ActionResult<SupplierOption[]>
> {
  const caller = await getCurrentUserProfile();
  if (!caller || !caller.is_active) {
    return { success: false, error: "Unauthorized: active account required." };
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("suppliers")
    .select("id, name")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    console.error("[getActiveSuppliersForExpenses]", error.message);
    return { success: false, error: "Failed to load suppliers." };
  }

  return { success: true, data: data ?? [] };
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/**
 * Creates a manual expense record.
 * STAFF and ADMIN are permitted. FEED_PURCHASE cannot be created manually.
 */
export async function createExpense(
  input: CreateExpenseInput
): Promise<ActionResult<{ id: string }>> {
  // 1. Authenticate & authorize
  const caller = await getCurrentUserProfile();
  if (!caller || !caller.is_active) {
    return { success: false, error: "Unauthorized: active account required." };
  }

  // 2. Server-side validation
  const parsed = createExpenseSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Invalid input.";
    return { success: false, error: first };
  }

  const { expense_date, category, amount, description, supplier_id } =
    parsed.data;

  // 3. Extra guard: category cannot be a system category
  if (isSystemCategory(category)) {
    return {
      success: false,
      error: "FEED_PURCHASE expenses are system-generated and cannot be created manually.",
    };
  }

  // 4. created_by is always taken from the server session
  const createdBy = caller.id;

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("expenses")
    .insert({
      expense_date,
      category,
      amount,
      description: description || null,
      supplier_id: supplier_id || null,
      created_by: createdBy,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[createExpense]", error.message);
    return { success: false, error: "Failed to record expense. Please try again." };
  }

  revalidatePath("/expenses");
  revalidatePath("/dashboard");

  return { success: true, data: { id: data.id } };
}

/**
 * Updates an existing manual expense.
 * ADMIN only. FEED_PURCHASE records cannot be updated.
 */
export async function updateExpense(
  expenseId: string,
  input: UpdateExpenseInput
): Promise<ActionResult> {
  // 1. Authenticate & authorize
  const caller = await getCurrentUserProfile();
  if (!caller || !caller.is_active) {
    return { success: false, error: "Unauthorized: active account required." };
  }
  if (caller.role !== "ADMIN") {
    return { success: false, error: "Access denied: only administrators can update expenses." };
  }

  // 2. Server-side validation
  const parsed = updateExpenseSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Invalid input.";
    return { success: false, error: first };
  }

  const { expense_date, category, amount, description, supplier_id } =
    parsed.data;

  // 3. Extra guard: category cannot be set to a system category
  if (isSystemCategory(category)) {
    return {
      success: false,
      error: "Expenses cannot be reclassified as FEED_PURCHASE.",
    };
  }

  const supabase = await createClient();

  // 4. Fetch the existing record to verify it is not a system-generated expense
  const { data: existing, error: fetchError } = await supabase
    .from("expenses")
    .select("id, category")
    .eq("id", expenseId)
    .single();

  if (fetchError || !existing) {
    return { success: false, error: "Expense record not found." };
  }

  if (isSystemCategory(existing.category)) {
    return {
      success: false,
      error: "System-generated FEED_PURCHASE expenses cannot be edited.",
    };
  }

  // 5. Perform update; explicitly set updated_at (no trigger exists)
  const { error: updateError } = await supabase
    .from("expenses")
    .update({
      expense_date,
      category,
      amount,
      description: description || null,
      supplier_id: supplier_id || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", expenseId);

  if (updateError) {
    console.error("[updateExpense]", updateError.message);
    return { success: false, error: "Failed to update expense. Please try again." };
  }

  revalidatePath("/expenses");
  revalidatePath("/dashboard");

  return { success: true };
}

/**
 * Deletes a manual expense.
 * ADMIN only. FEED_PURCHASE records cannot be deleted.
 */
export async function deleteExpense(expenseId: string): Promise<ActionResult> {
  // 1. Authenticate & authorize
  const caller = await getCurrentUserProfile();
  if (!caller || !caller.is_active) {
    return { success: false, error: "Unauthorized: active account required." };
  }
  if (caller.role !== "ADMIN") {
    return {
      success: false,
      error: "Access denied: only administrators can delete expenses.",
    };
  }

  const supabase = await createClient();

  // 2. Fetch and verify
  const { data: existing, error: fetchError } = await supabase
    .from("expenses")
    .select("id, category")
    .eq("id", expenseId)
    .single();

  if (fetchError || !existing) {
    return { success: false, error: "Expense record not found." };
  }

  // 3. Block deletion of system-generated expenses
  if (isSystemCategory(existing.category)) {
    return {
      success: false,
      error:
        "FEED_PURCHASE expenses are linked to feed inventory transactions and cannot be deleted. To correct a feed purchase, please use a reversal or adjustment workflow.",
    };
  }

  // 4. Perform deletion (RLS enforces ADMIN-only at the database level)
  const { error: deleteError } = await supabase
    .from("expenses")
    .delete()
    .eq("id", expenseId);

  if (deleteError) {
    console.error("[deleteExpense]", deleteError.message);
    return { success: false, error: "Failed to delete expense. Please try again." };
  }

  revalidatePath("/expenses");
  revalidatePath("/dashboard");

  return { success: true };
}
