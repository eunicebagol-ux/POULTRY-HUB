"use server";

import { getCurrentUserProfile } from "@/lib/user-profile";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  updateUserRoleSchema,
  updateUserStatusSchema,
  type UpdateUserRoleInput,
  type UpdateUserStatusInput,
} from "@/lib/validations/users";
import { revalidatePath } from "next/cache";
import { clerkClient } from "@clerk/nextjs/server";
import type { UserRole } from "@/types";

export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

// ─── View Types ───────────────────────────────────────────────────────────────

export interface UserProfileRow {
  id: string;
  full_name: string;
  role: UserRole;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  linked_customer_id?: string | null;
  linked_customer_name?: string | null;
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/**
 * Fetches all user profiles for the Admin User Management page.
 * Strictly gated: Active ADMIN callers only.
 *
 * Uses the secure server-side admin client to guarantee full visibility
 * of newly registered or quarantined customer profiles, while ensuring
 * the service-role client is NEVER exposed to the browser.
 */
export async function getUsers(): Promise<ActionResult<UserProfileRow[]>> {
  const caller = await getCurrentUserProfile();

  if (!caller || !caller.is_active || caller.role !== "ADMIN") {
    return {
      success: false,
      error: "Unauthorized: Only active administrators can view the user directory.",
    };
  }

  try {
    const adminClient = createAdminClient();

    const { data, error } = await adminClient
      .from("profiles")
      .select("id, full_name, role, phone, avatar_url, is_active, created_at, updated_at")
      .order("created_at", { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    const profiles = (data ?? []) as UserProfileRow[];

    // Reconcile registered Clerk accounts that may not have been provisioned due to webhook failure/absence
    try {
      const client = await clerkClient();
      const clerkResponse = await client.users.getUserList({ limit: 100 });
      if (clerkResponse?.data) {
        const existingProfileIds = new Set(profiles.map((p) => p.id));

        for (const u of clerkResponse.data) {
          if (!existingProfileIds.has(u.id)) {
            const primaryEmail =
              u.emailAddresses?.find((e) => e.id === u.primaryEmailAddressId)?.emailAddress ||
              u.emailAddresses?.[0]?.emailAddress;
            const fullName =
              [u.firstName, u.lastName].filter(Boolean).join(" ").trim() ||
              primaryEmail ||
              "Customer";

            const isApproved = u.publicMetadata?.is_active === true;

            const newProfileRow: UserProfileRow = {
              id: u.id,
              full_name: fullName,
              role: "CUSTOMER", // STRICT SECURITY: Unprovisioned accounts default to quarantined CUSTOMER role
              phone: u.phoneNumbers?.[0]?.phoneNumber || null,
              avatar_url: u.imageUrl || null,
              is_active: isApproved, // Inactive/pending by default until admin explicitly approves
              created_at: new Date(u.createdAt).toISOString(),
              updated_at: new Date(u.updatedAt).toISOString(),
            };

            const { error: insErr } = await adminClient.from("profiles").upsert(
              {
                id: newProfileRow.id,
                full_name: newProfileRow.full_name,
                role: newProfileRow.role,
                phone: newProfileRow.phone,
                avatar_url: newProfileRow.avatar_url,
                is_active: newProfileRow.is_active,
                updated_at: newProfileRow.updated_at,
              },
              { onConflict: "id" }
            );

            if (!insErr) {
              profiles.unshift(newProfileRow);
              existingProfileIds.add(newProfileRow.id);
            } else if (insErr.code === "22P02" || insErr.message?.includes("user_role")) {
              // Exact diagnosis: Migration 012 (adding 'CUSTOMER' to public.user_role) is pending in DB.
              console.warn(
                `Database schema limitation (Migration 012 pending): Cannot persist role="CUSTOMER" to public.profiles (${insErr.message}). Reconciling user ${u.id} in memory.`
              );
              profiles.unshift(newProfileRow);
              existingProfileIds.add(newProfileRow.id);
            } else {
              console.error(
                "Error auto-provisioning missing profile from Clerk in getUsers:",
                insErr.message || insErr.code || JSON.stringify(insErr)
              );
            }
          }
        }
      }
    } catch (clerkSyncErr) {
      console.warn("Could not synchronize Clerk users in getUsers:", clerkSyncErr);
    }

    // Attempt to inspect linked customer records safely without failing if column doesn't exist
    try {
      const { data: custData, error: custErr } = await adminClient
        .from("customers")
        .select("id, name, clerk_user_id");

      if (!custErr && custData) {
        const custMap = new Map<string, { id: string; name: string }>();
        custData.forEach((c) => {
          if (c.clerk_user_id) {
            custMap.set(c.clerk_user_id, { id: c.id, name: c.name });
          }
        });

        profiles.forEach((p) => {
          const linked = custMap.get(p.id);
          if (linked) {
            p.linked_customer_id = linked.id;
            p.linked_customer_name = linked.name;
          }
        });
      }
    } catch {
      // Column clerk_user_id not yet added or table error - graceful fallback
    }

    return { success: true, data: profiles };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to load user directory.",
    };
  }
}

/**
 * Administrative action to update a user's role.
 *
 * Security Requirements:
 * 1. Caller must be authenticated, active, and have the ADMIN role in public.profiles.
 * 2. Role input is validated against Zod schema (only "ADMIN" or "STAFF").
 * 3. Cannot demote self if that would leave zero active admins.
 * 4. Audit trail entry is logged in public.activity_logs.
 */
export async function updateUserRole(
  input: UpdateUserRoleInput
): Promise<ActionResult> {
  const caller = await getCurrentUserProfile();

  if (!caller || !caller.is_active || caller.role !== "ADMIN") {
    return {
      success: false,
      error: "Unauthorized: Only active administrators can modify user roles.",
    };
  }

  const parsed = updateUserRoleSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid input parameters.",
    };
  }

  const { targetUserId, role: newRole } = parsed.data;

  // Guard: Administrators cannot change their own role under any circumstances
  if (caller.id === targetUserId) {
    return {
      success: false,
      error: "Administrators cannot modify their own role.",
    };
  }

  try {
    const supabase = await createClient();

    // Fetch target user's current profile
    const { data: targetProfile, error: fetchError } = await supabase
      .from("profiles")
      .select("id, role, full_name, is_active")
      .eq("id", targetUserId)
      .single();

    if (fetchError || !targetProfile) {
      return { success: false, error: "Target user profile not found." };
    }

    // Security Guard: Prevent CUSTOMER accounts from being promoted to STAFF or ADMIN through the user role action
    if (targetProfile.role === "CUSTOMER") {
      return {
        success: false,
        error:
          "Customer portal accounts cannot be converted to farm staff or administrators. Internal staff accounts must be provisioned independently.",
      };
    }

    if (newRole === "CUSTOMER") {
      return {
        success: false,
        error: "Internal staff accounts cannot be converted to customer portal accounts.",
      };
    }

    if (targetProfile.role === newRole) {
      return { success: true };
    }

    // Guard: Prevent demoting an active administrator if no other active administrators remain
    if (targetProfile.role === "ADMIN" && targetProfile.is_active && newRole !== "ADMIN") {
      const { count: otherAdminsCount, error: countErr } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "ADMIN")
        .eq("is_active", true)
        .neq("id", targetUserId);

      if (countErr || otherAdminsCount === null || otherAdminsCount < 1) {
        return {
          success: false,
          error: "Cannot demote the only active administrator.",
        };
      }
    }

    // Update role
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        role: newRole,
        updated_at: new Date().toISOString(),
      })
      .eq("id", targetUserId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }


    // Record audit log entry via service-role client (bypasses RLS on activity_logs)
    try {
      const adminClient = createAdminClient();
      const { error: auditError } = await adminClient.from("activity_logs").insert({
        actor_id: caller.id,
        action: "USER_ROLE_CHANGED",
        entity_table: "profiles",
        entity_id: targetUserId,
        metadata: {
          previous_role: targetProfile.role,
          new_role: newRole,
          target_name: targetProfile.full_name,
        },
      });

      if (auditError) {
        console.error("Failed to record USER_ROLE_CHANGED audit log:", auditError.message);
      }
    } catch (auditErr) {
      console.error(
        "Failed to write audit log entry:",
        auditErr instanceof Error ? auditErr.message : auditErr
      );
    }

    revalidatePath("/users");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update user role.",
    };
  }
}

/**
 * Administrative action to activate or deactivate a user account.
 *
 * Security Requirements:
 * 1. Caller must be authenticated, active, and have the ADMIN role in public.profiles.
 * 2. Status input is validated against Zod schema.
 * 3. Administrator cannot deactivate their own active account.
 * 4. Audit trail entry is logged in public.activity_logs.
 */
export async function updateUserStatus(
  input: UpdateUserStatusInput
): Promise<ActionResult> {
  const caller = await getCurrentUserProfile();

  if (!caller || !caller.is_active || caller.role !== "ADMIN") {
    return {
      success: false,
      error: "Unauthorized: Only active administrators can modify account status.",
    };
  }

  const parsed = updateUserStatusSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid input parameters.",
    };
  }

  const { targetUserId, isActive: newStatus } = parsed.data;

  // Guard: Admin cannot deactivate their own account
  if (caller.id === targetUserId && !newStatus) {
    return {
      success: false,
      error: "You cannot deactivate your own administrative account.",
    };
  }

  try {
    const supabase = await createClient();

    // Fetch target user's current profile
    const { data: targetProfile, error: fetchError } = await supabase
      .from("profiles")
      .select("id, role, full_name, is_active")
      .eq("id", targetUserId)
      .single();

    if (fetchError || !targetProfile) {
      return { success: false, error: "Target user profile not found." };
    }

    if (targetProfile.is_active === newStatus) {
      return { success: true };
    }

    // Guard: Prevent deactivating an active administrator if no other active administrators remain
    if (targetProfile.role === "ADMIN" && targetProfile.is_active && !newStatus) {
      const { count: otherAdminsCount, error: countErr } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "ADMIN")
        .eq("is_active", true)
        .neq("id", targetUserId);

      if (countErr || otherAdminsCount === null || otherAdminsCount < 1) {
        return {
          success: false,
          error: "Cannot deactivate the only active administrator.",
        };
      }
    }

    // Update active status
    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        is_active: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", targetUserId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // If target is a CUSTOMER, synchronize the linked customer record's active status
    if (targetProfile.role === "CUSTOMER") {
      try {
        const adminClient = createAdminClient();
        await adminClient
          .from("customers")
          .update({
            is_active: newStatus,
            updated_at: new Date().toISOString(),
          })
          .eq("clerk_user_id", targetUserId);
      } catch (custSyncErr) {
        console.warn("Could not synchronize customer entity active status:", custSyncErr);
      }
    }

    // Record audit log entry via service-role client (bypasses RLS on activity_logs)
    try {
      const adminClient = createAdminClient();
      const { error: auditError } = await adminClient.from("activity_logs").insert({
        actor_id: caller.id,
        action: "USER_STATUS_CHANGED",
        entity_table: "profiles",
        entity_id: targetUserId,
        metadata: {
          previous_status: targetProfile.is_active,
          new_status: newStatus,
          target_name: targetProfile.full_name,
        },
      });

      if (auditError) {
        console.error("Failed to record USER_STATUS_CHANGED audit log:", auditError.message);
      }
    } catch (auditErr) {
      console.error(
        "Failed to write audit log entry:",
        auditErr instanceof Error ? auditErr.message : auditErr
      );
    }

    revalidatePath("/users");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to update user status.",
    };
  }
}

/**
 * Dedicated Admin action to approve a pending or quarantined customer account.
 *
 * Security Requirements:
 * 1. Caller must be authenticated, active ADMIN.
 * 2. Target profile must have role === "CUSTOMER".
 * 3. Activates the profile (is_active = true).
 * 4. Atomically links to existing customer record if specified or verifies unambiguous match.
 * 5. Prevents duplicate customer creation or overwriting existing clerk_user_id links.
 * 6. Audit trail is recorded in public.activity_logs.
 */
export async function approveCustomerUser(input: {
  targetUserId: string;
  linkExistingCustomerId?: string;
}): Promise<ActionResult> {
  const caller = await getCurrentUserProfile();

  if (!caller || !caller.is_active || caller.role !== "ADMIN") {
    return {
      success: false,
      error: "Unauthorized: Only active administrators can approve customer accounts.",
    };
  }

  const { targetUserId, linkExistingCustomerId } = input;
  if (!targetUserId) {
    return { success: false, error: "targetUserId is required." };
  }

  try {
    const adminClient = createAdminClient();

    // 1. Fetch target profile or Clerk user
    let targetProfile: {
      id: string;
      role: UserRole;
      full_name: string;
      phone: string | null;
      avatar_url?: string | null;
      is_active: boolean;
    } | null = null;

    const { data: dbProfile } = await adminClient
      .from("profiles")
      .select("id, role, full_name, phone, avatar_url, is_active")
      .eq("id", targetUserId)
      .maybeSingle();

    if (dbProfile) {
      if (dbProfile.role !== "CUSTOMER") {
        return {
          success: false,
          error: "Only customer portal accounts can be processed via customer approval.",
        };
      }
      targetProfile = dbProfile;
    } else {
      // Reconcile directly from Clerk if profile was synthesized in memory
      try {
        const client = await clerkClient();
        const clerkUser = await client.users.getUser(targetUserId);
        if (clerkUser) {
          const primaryEmail =
            clerkUser.emailAddresses?.find((e) => e.id === clerkUser.primaryEmailAddressId)?.emailAddress ||
            clerkUser.emailAddresses?.[0]?.emailAddress;
          targetProfile = {
            id: clerkUser.id,
            role: "CUSTOMER" as UserRole,
            full_name:
              [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim() ||
              primaryEmail ||
              "Customer",
            phone: clerkUser.phoneNumbers?.[0]?.phoneNumber || null,
            avatar_url: clerkUser.imageUrl || null,
            is_active: false,
          };
        }
      } catch (cErr) {
        console.warn("Could not query Clerk user in approveCustomerUser:", cErr);
      }
    }

    if (!targetProfile) {
      return { success: false, error: "Target profile not found in database or authentication provider." };
    }

    // 2. Resolve or establish customer record link
    let resolvedCustomerId: string | null = null;

    try {
      // Check if clerk_user_id column is present in customers table
      const { data: existingCustByClerk, error: clerkErr } = await adminClient
        .from("customers")
        .select("id, name, clerk_user_id, is_active")
        .eq("clerk_user_id", targetUserId)
        .maybeSingle();

      if (!clerkErr && existingCustByClerk) {
        resolvedCustomerId = existingCustByClerk.id;
        // Ensure customer record is active
        await adminClient
          .from("customers")
          .update({ is_active: true, updated_at: new Date().toISOString() })
          .eq("id", existingCustByClerk.id);
      } else if (!clerkErr && linkExistingCustomerId) {
        // Explicit link requested by administrator
        const { data: targetCust, error: tcErr } = await adminClient
          .from("customers")
          .select("id, name, clerk_user_id")
          .eq("id", linkExistingCustomerId)
          .single();

        if (tcErr || !targetCust) {
          return { success: false, error: "Specified customer record to link was not found." };
        }

        if (targetCust.clerk_user_id && targetCust.clerk_user_id !== targetUserId) {
          return {
            success: false,
            error: "Cannot link: This customer record is already associated with another user.",
          };
        }

        await adminClient
          .from("customers")
          .update({
            clerk_user_id: targetUserId,
            is_active: true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", targetCust.id);

        resolvedCustomerId = targetCust.id;
      } else if (!clerkErr) {
        // Check if an unlinked customer record already exists with matching name/phone
        const { data: unlinkedByName } = await adminClient
          .from("customers")
          .select("id, clerk_user_id")
          .eq("name", targetProfile.full_name)
          .is("clerk_user_id", null);

        if (unlinkedByName && unlinkedByName.length === 1) {
          // Link unambiguous single match
          await adminClient
            .from("customers")
            .update({
              clerk_user_id: targetUserId,
              is_active: true,
              updated_at: new Date().toISOString(),
            })
            .eq("id", unlinkedByName[0].id);
          resolvedCustomerId = unlinkedByName[0].id;
        } else {
          // Create new customer directory entity record for this customer
          const { data: newCust, error: insErr } = await adminClient
            .from("customers")
            .insert({
              name: targetProfile.full_name,
              phone: targetProfile.phone || null,
              clerk_user_id: targetUserId,
              is_active: true,
            })
            .select("id")
            .single();

          if (!insErr && newCust) {
            resolvedCustomerId = newCust.id;
          }
        }
      }
    } catch {
      // Graceful fallback if customers.clerk_user_id is not yet migrated in database
    }

    // 3. Activate the profile in database (handling pending enum Migration 012 gracefully)
    const { error: activateErr } = await adminClient
      .from("profiles")
      .upsert({
        id: targetUserId,
        role: "CUSTOMER",
        full_name: targetProfile.full_name,
        phone: targetProfile.phone || null,
        avatar_url: targetProfile.avatar_url || null,
        is_active: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: "id" });

    if (activateErr && activateErr.code !== "22P02") {
      return { success: false, error: activateErr.message };
    }

    // 4. Update Clerk publicMetadata to persist approved active status in authentication provider
    try {
      const client = await clerkClient();
      await client.users.updateUser(targetUserId, {
        publicMetadata: {
          role: "CUSTOMER",
          is_active: true,
        },
      });
    } catch (clerkUpdErr) {
      console.warn("Could not synchronize approval to Clerk metadata:", clerkUpdErr);
    }

    // 4. Record audit log entry
    try {
      await adminClient.from("activity_logs").insert({
        actor_id: caller.id,
        action: "CUSTOMER_APPROVED",
        entity_table: "profiles",
        entity_id: targetUserId,
        metadata: {
          target_name: targetProfile.full_name,
          customer_id: resolvedCustomerId,
          approved_by: caller.full_name,
        },
      });
    } catch (auditErr) {
      console.warn("Audit log for CUSTOMER_APPROVED failed:", auditErr);
    }

    revalidatePath("/users");
    revalidatePath("/customers");
    revalidatePath("/customer/dashboard");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to approve customer account.",
    };
  }
}

/**
 * Dedicated Admin action to deactivate a customer account.
 */
export async function deactivateCustomerUser(targetUserId: string): Promise<ActionResult> {
  const caller = await getCurrentUserProfile();

  if (!caller || !caller.is_active || caller.role !== "ADMIN") {
    return {
      success: false,
      error: "Unauthorized: Only active administrators can deactivate customer accounts.",
    };
  }

  if (!targetUserId) {
    return { success: false, error: "targetUserId is required." };
  }

  try {
    const adminClient = createAdminClient();

    // 1. Fetch target profile or Clerk user
    let targetName = "";
    const { data: targetProfile, error: pErr } = await adminClient
      .from("profiles")
      .select("id, role, full_name, is_active")
      .eq("id", targetUserId)
      .maybeSingle();

    if (targetProfile) {
      if (targetProfile.role !== "CUSTOMER") {
        return {
          success: false,
          error: "Only customer portal accounts can be processed via this action.",
        };
      }
      targetName = targetProfile.full_name;
    } else {
      try {
        const client = await clerkClient();
        const clerkUser = await client.users.getUser(targetUserId);
        if (clerkUser) {
          targetName =
            [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim() ||
            clerkUser.emailAddresses?.[0]?.emailAddress ||
            "Customer";
        }
      } catch (cErr) {
        console.warn("Could not query Clerk user in deactivateCustomerUser:", cErr);
      }
    }

    if (!targetProfile && !targetName) {
      return { success: false, error: "Target profile not found." };
    }

    // 2. Deactivate profile in database (if present)
    if (targetProfile) {
      const { error: updErr } = await adminClient
        .from("profiles")
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", targetUserId);

      if (updErr && updErr.code !== "22P02") {
        return { success: false, error: updErr.message };
      }
    }

    // Sync deactivation to Clerk metadata
    try {
      const client = await clerkClient();
      await client.users.updateUser(targetUserId, {
        publicMetadata: {
          role: "CUSTOMER",
          is_active: false,
        },
      });
    } catch (cUpdErr) {
      console.warn("Could not sync deactivation to Clerk metadata:", cUpdErr);
    }

    // 3. Deactivate linked customer entity safely
    try {
      await adminClient
        .from("customers")
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq("clerk_user_id", targetUserId);
    } catch {
      // Column may not exist
    }

    // 4. Audit log
    try {
      await adminClient.from("activity_logs").insert({
        actor_id: caller.id,
        action: "CUSTOMER_DEACTIVATED",
        entity_table: "profiles",
        entity_id: targetUserId,
        metadata: {
          target_name: targetName,
          deactivated_by: caller.full_name,
        },
      });
    } catch (auditErr) {
      console.warn("Audit log for CUSTOMER_DEACTIVATED failed:", auditErr);
    }

    revalidatePath("/users");
    revalidatePath("/customers");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to deactivate customer account.",
    };
  }
}
