"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUserProfile } from "@/lib/user-profile";
import {
  createBankTransferAccountSchema,
  updateBankTransferAccountSchema,
  type CreateBankTransferAccountInput,
  type UpdateBankTransferAccountInput,
} from "@/lib/validations/bank-transfer-accounts";
import type { BankTransferAccountView } from "@/types";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * CUSTOMER / CHECKOUT:
 * Returns all active receiving accounts configured by the farm administrator.
 * Inactive accounts and admin metadata are excluded.
 */
export async function getActiveBankTransferAccounts(): Promise<
  ActionResult<BankTransferAccountView[]>
> {
  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("bank_transfer_accounts")
      .select("id, bank_name, account_holder_name, account_number, instructions, is_active, display_order, created_at, updated_at")
      .eq("is_active", true)
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      data: (data ?? []).map((row) => ({
        id: row.id,
        bank_name: row.bank_name,
        account_holder_name: row.account_holder_name,
        account_number: row.account_number,
        instructions: row.instructions,
        is_active: row.is_active,
        display_order: row.display_order,
        created_at: row.created_at,
        updated_at: row.updated_at,
      })),
    };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to load active bank receiving accounts.",
    };
  }
}

/**
 * ADMIN:
 * Returns all configured receiving accounts (both active and inactive)
 * for the Admin Settings management panel.
 */
export async function getAllBankTransferAccounts(): Promise<
  ActionResult<BankTransferAccountView[]>
> {
  const caller = await getCurrentUserProfile();
  if (!caller || !caller.is_active) {
    return { success: false, error: "Unauthorized: active account required." };
  }

  if (caller.role !== "ADMIN") {
    return {
      success: false,
      error: "Unauthorized: ADMIN access required to view bank accounts.",
    };
  }

  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("bank_transfer_accounts")
      .select("id, bank_name, account_holder_name, account_number, instructions, is_active, display_order, created_by, updated_by, created_at, updated_at")
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    return {
      success: true,
      data: (data ?? []).map((row) => ({
        id: row.id,
        bank_name: row.bank_name,
        account_holder_name: row.account_holder_name,
        account_number: row.account_number,
        instructions: row.instructions,
        is_active: row.is_active,
        display_order: row.display_order,
        created_by: row.created_by,
        updated_by: row.updated_by,
        created_at: row.created_at,
        updated_at: row.updated_at,
      })),
    };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to load bank receiving accounts.",
    };
  }
}

/**
 * ADMIN:
 * Creates a new bank receiving account.
 */
export async function createBankTransferAccount(
  input: CreateBankTransferAccountInput
): Promise<ActionResult<BankTransferAccountView>> {
  const caller = await getCurrentUserProfile();
  if (!caller || !caller.is_active) {
    return { success: false, error: "Unauthorized: active account required." };
  }

  if (caller.role !== "ADMIN") {
    return {
      success: false,
      error: "Unauthorized: ADMIN access required to create bank accounts.",
    };
  }

  const parsed = createBankTransferAccountSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid bank account input.",
    };
  }

  const effectiveBankName =
    parsed.data.bank_name_select === "Other"
      ? parsed.data.custom_bank_name?.trim() || "Other"
      : parsed.data.bank_name_select;

  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("bank_transfer_accounts")
      .insert({
        bank_name: effectiveBankName,
        account_holder_name: parsed.data.account_holder_name.trim(),
        account_number: parsed.data.account_number.trim(),
        instructions: parsed.data.instructions?.trim() || null,
        is_active: parsed.data.is_active,
        display_order: parsed.data.display_order,
        created_by: caller.id,
        updated_by: caller.id,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return {
          success: false,
          error: "An account with this bank name and account number already exists.",
        };
      }
      return { success: false, error: error.message };
    }

    // Activity log
    try {
      const adminClient = createAdminClient();
      await adminClient.from("activity_logs").insert({
        actor_id: caller.id,
        action: "BANK_TRANSFER_ACCOUNT_CREATED",
        entity_table: "bank_transfer_accounts",
        entity_id: data.id,
        metadata: {
          bank_name: effectiveBankName,
          account_holder_name: data.account_holder_name,
          account_number: data.account_number,
          is_active: data.is_active,
        },
      });
    } catch {
      // non-fatal
    }

    revalidatePath("/settings");
    revalidatePath("/customer/order");

    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to create bank receiving account.",
    };
  }
}

/**
 * ADMIN:
 * Updates an existing bank receiving account.
 */
export async function updateBankTransferAccount(
  input: UpdateBankTransferAccountInput
): Promise<ActionResult<BankTransferAccountView>> {
  const caller = await getCurrentUserProfile();
  if (!caller || !caller.is_active) {
    return { success: false, error: "Unauthorized: active account required." };
  }

  if (caller.role !== "ADMIN") {
    return {
      success: false,
      error: "Unauthorized: ADMIN access required to update bank accounts.",
    };
  }

  const parsed = updateBankTransferAccountSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid bank account input.",
    };
  }

  const effectiveBankName =
    parsed.data.bank_name_select === "Other"
      ? parsed.data.custom_bank_name?.trim() || "Other"
      : parsed.data.bank_name_select;

  try {
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("bank_transfer_accounts")
      .update({
        bank_name: effectiveBankName,
        account_holder_name: parsed.data.account_holder_name.trim(),
        account_number: parsed.data.account_number.trim(),
        instructions: parsed.data.instructions?.trim() || null,
        is_active: parsed.data.is_active,
        display_order: parsed.data.display_order,
        updated_by: caller.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", parsed.data.id)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return {
          success: false,
          error: "An account with this bank name and account number already exists.",
        };
      }
      return { success: false, error: error.message };
    }

    // Activity log
    try {
      const adminClient = createAdminClient();
      await adminClient.from("activity_logs").insert({
        actor_id: caller.id,
        action: "BANK_TRANSFER_ACCOUNT_UPDATED",
        entity_table: "bank_transfer_accounts",
        entity_id: data.id,
        metadata: {
          bank_name: effectiveBankName,
          account_holder_name: data.account_holder_name,
          account_number: data.account_number,
          is_active: data.is_active,
        },
      });
    } catch {
      // non-fatal
    }

    revalidatePath("/settings");
    revalidatePath("/customer/order");

    return { success: true, data };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to update bank receiving account.",
    };
  }
}

/**
 * ADMIN:
 * Toggles an account active or inactive.
 */
export async function toggleBankTransferAccountStatus(
  id: string
): Promise<ActionResult<{ id: string; is_active: boolean }>> {
  const caller = await getCurrentUserProfile();
  if (!caller || !caller.is_active) {
    return { success: false, error: "Unauthorized: active account required." };
  }

  if (caller.role !== "ADMIN") {
    return {
      success: false,
      error: "Unauthorized: ADMIN access required to toggle bank account status.",
    };
  }

  try {
    const supabase = await createClient();

    const { data: current, error: fetchErr } = await supabase
      .from("bank_transfer_accounts")
      .select("id, is_active, bank_name, account_number")
      .eq("id", id)
      .single();

    if (fetchErr || !current) {
      return { success: false, error: "Bank account not found." };
    }

    const nextStatus = !current.is_active;

    const { error: updateErr } = await supabase
      .from("bank_transfer_accounts")
      .update({
        is_active: nextStatus,
        updated_by: caller.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    // Activity log
    try {
      const adminClient = createAdminClient();
      await adminClient.from("activity_logs").insert({
        actor_id: caller.id,
        action: nextStatus
          ? "BANK_TRANSFER_ACCOUNT_ACTIVATED"
          : "BANK_TRANSFER_ACCOUNT_DEACTIVATED",
        entity_table: "bank_transfer_accounts",
        entity_id: id,
        metadata: {
          bank_name: current.bank_name,
          account_number: current.account_number,
          is_active: nextStatus,
        },
      });
    } catch {
      // non-fatal
    }

    revalidatePath("/settings");
    revalidatePath("/customer/order");

    return { success: true, data: { id, is_active: nextStatus } };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to change bank account status.",
    };
  }
}

/**
 * ADMIN:
 * Deletes a bank receiving account only when safe (no customer payment submissions reference it).
 */
export async function deleteBankTransferAccount(
  id: string
): Promise<ActionResult<void>> {
  const caller = await getCurrentUserProfile();
  if (!caller || !caller.is_active) {
    return { success: false, error: "Unauthorized: active account required." };
  }

  if (caller.role !== "ADMIN") {
    return {
      success: false,
      error: "Unauthorized: ADMIN access required to delete bank accounts.",
    };
  }

  try {
    const supabase = await createClient();

    // Safety check: verify no customer_payment_submissions reference this account
    const { data: referencingSubmissions, error: checkError } = await supabase
      .from("customer_payment_submissions")
      .select("id")
      .eq("bank_transfer_account_id", id)
      .limit(1);

    if (checkError) {
      return {
        success: false,
        error: "Failed to verify payment history before deleting account.",
      };
    }

    if (referencingSubmissions && referencingSubmissions.length > 0) {
      return {
        success: false,
        error:
          "Cannot delete this receiving account because existing customer payment records reference it. Deactivate the account instead to preserve payment history.",
      };
    }

    const { error: deleteErr } = await supabase
      .from("bank_transfer_accounts")
      .delete()
      .eq("id", id);

    if (deleteErr) {
      return { success: false, error: deleteErr.message };
    }

    // Activity log
    try {
      const adminClient = createAdminClient();
      await adminClient.from("activity_logs").insert({
        actor_id: caller.id,
        action: "BANK_TRANSFER_ACCOUNT_DELETED",
        entity_table: "bank_transfer_accounts",
        entity_id: id,
      });
    } catch {
      // non-fatal
    }

    revalidatePath("/settings");
    revalidatePath("/customer/order");

    return { success: true, data: undefined };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to delete bank receiving account.",
    };
  }
}

/**
 * CUSTOMER / STAFF:
 * Securely uploads a proof of payment receipt to the `payment-receipts` bucket.
 * Validates file size (max 5MB) and mime type (images & PDFs).
 */
export async function uploadPaymentReceipt(
  formData: FormData
): Promise<ActionResult<{ url: string; fileName: string }>> {
  const caller = await getCurrentUserProfile();
  if (!caller || !caller.is_active) {
    return { success: false, error: "Unauthorized: active account required." };
  }

  const file = formData.get("receipt") as File | null;
  if (!file || typeof file === "string") {
    return { success: false, error: "No receipt file provided." };
  }

  // Size limit: 5MB
  const MAX_SIZE = 5 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    return {
      success: false,
      error: "Receipt file is too large. Maximum file size is 5MB.",
    };
  }

  // Allowed MIME types
  const allowedTypes = [
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
    "application/pdf",
  ];
  if (!allowedTypes.includes(file.type)) {
    return {
      success: false,
      error:
        "Invalid file format. Please upload a PNG, JPEG, WEBP, GIF, or PDF file.",
    };
  }

  try {
    const adminClient = createAdminClient();

    // Create safe unique path: {callerId}/{timestamp}-{sanitizedName}
    const cleanFileName = file.name
      .replace(/[^a-zA-Z0-9.-]/g, "_")
      .toLowerCase();
    const storagePath = `${caller.id}/${Date.now()}_${cleanFileName}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await adminClient.storage
      .from("payment-receipts")
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      return {
        success: false,
        error: `Receipt upload failed: ${uploadError.message}`,
      };
    }

    const { data: publicUrlData } = adminClient.storage
      .from("payment-receipts")
      .getPublicUrl(storagePath);

    return {
      success: true,
      data: {
        url: publicUrlData.publicUrl,
        fileName: file.name,
      },
    };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Failed to upload payment receipt.",
    };
  }
}
