import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { auth, currentUser } from "@clerk/nextjs/server";
import type { UserRole } from "@/types";

export interface UserProfile {
  id: string;
  role: UserRole;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean;
}

/**
 * Server-side helper to fetch the authenticated user's profile from Supabase.
 *
 * IMPORTANT — role resolution security contract:
 *
 * 1. The primary lookup uses the RLS-authenticated Supabase client, which
 *    passes the Clerk JWT so that `auth.jwt() ->> 'sub'` = the caller's
 *    Clerk userId.  The profiles table `id` column stores the Clerk userId
 *    as TEXT, so `eq('id', userId)` matches exactly one row when the token
 *    validates correctly.
 *
 * 2. If the primary lookup fails (e.g. the JWT claim is not yet wired or the
 *    row does not exist), the admin client is used as a read-only FALLBACK to
 *    re-fetch the same row — NEVER to invent a new role.  The admin client
 *    bypasses RLS but still scopes to the exact Clerk userId.
 *
 * 3. Auto-provisioning (INSERT) only happens when NEITHER lookup finds a row
 *    AND the role is explicitly CUSTOMER.  It NEVER promotes any user to ADMIN
 *    or STAFF.  ADMIN and STAFF profiles must always be created by an
 *    authorised server-side administrative action.
 *
 * 4. A missing profile for a Clerk-authenticated user is treated as a
 *    self-registered customer awaiting approval — not as a farm staff member.
 */
export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  const { userId } = await auth();
  if (!userId) return null;

  try {
    // ── 1. Primary: RLS-authenticated read ──────────────────────────────────
    const supabase = await createClient();
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, role, full_name, phone, avatar_url, is_active")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error(
        "[user-profile] RLS client error fetching profile:",
        error.message || error
      );
    }

    if (profile) {
      return profile as UserProfile;
    }

    // ── 2. Fallback: service-role read (bypasses RLS) ───────────────────────
    // This handles the edge case where the Clerk JWT template is not yet
    // configured or is missing the `sub` claim, causing the RLS check to
    // fail even though the row exists.  We explicitly scope to the exact
    // Clerk userId so this cannot return a different user's profile.
    const adminClient = createAdminClient();
    const { data: adminProfile, error: adminError } = await adminClient
      .from("profiles")
      .select("id, role, full_name, phone, avatar_url, is_active")
      .eq("id", userId)
      .maybeSingle();

    if (adminError) {
      console.error(
        "[user-profile] Admin client error fetching profile:",
        adminError.message || adminError
      );
    }

    if (adminProfile) {
      // Row exists in DB — return it directly.  Role comes from the DB, not
      // from Clerk metadata.  This correctly returns ADMIN for admin accounts
      // even when the RLS client fails.
      return adminProfile as UserProfile;
    }

    // ── 3. Auto-provision: only for genuine new self-registrations ───────────
    // At this point no profile row exists at all.  The ONLY safe default for a
    // self-registered Clerk user (who went through the public /sign-up flow) is
    // CUSTOMER with is_active = false (pending admin approval).
    //
    // STAFF and ADMIN accounts must be provisioned by an administrator via the
    // user management screen — never auto-provisioned from this path.
    const clerkUser = await currentUser();
    if (!clerkUser) return null;

    const primaryEmail = clerkUser.emailAddresses?.[0]?.emailAddress;
    const clerkFullName = [clerkUser.firstName, clerkUser.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();
    const fullName = clerkFullName || "Customer";

    const newProfile: UserProfile = {
      id: userId,
      role: "CUSTOMER",
      full_name: fullName,
      phone: clerkUser.phoneNumbers?.[0]?.phoneNumber || null,
      avatar_url: clerkUser.imageUrl || null,
      // is_active starts as false — admin must approve the customer account.
      // We deliberately ignore clerkUser.publicMetadata here: metadata is
      // editable by any Clerk dashboard operator and must not be trusted for
      // granting farm system access.
      is_active: false,
    };

    try {
      await adminClient.from("profiles").upsert(
        {
          ...newProfile,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );
    } catch (upsertErr) {
      // Silently continue if the DB write fails — the in-memory newProfile
      // (CUSTOMER, is_active: false) is still returned so the caller can
      // show the pending-approval screen rather than crashing.
      console.warn("[user-profile] Could not upsert new customer profile:", upsertErr);
    }

    // Auto-link this Clerk user to an existing customers table entry if the
    // email matches an unlinked record, or create a new customer entry.
    if (primaryEmail) {
      try {
        const normalizedEmail = primaryEmail.toLowerCase().trim();
        const { data: matchingCusts } = await adminClient
          .from("customers")
          .select("id, clerk_user_id")
          .eq("email", normalizedEmail);

        const unlinkedCusts = (matchingCusts ?? []).filter(
          (c) => !c.clerk_user_id
        );

        if (unlinkedCusts.length === 1) {
          await adminClient
            .from("customers")
            .update({
              clerk_user_id: userId,
              is_active: false,
              updated_at: new Date().toISOString(),
            })
            .eq("id", unlinkedCusts[0].id);
        } else if (!matchingCusts || matchingCusts.length === 0) {
          await adminClient.from("customers").insert({
            name: fullName,
            email: normalizedEmail,
            phone: newProfile.phone,
            clerk_user_id: userId,
            is_active: false,
          });
        }
      } catch (custErr) {
        console.warn("[user-profile] Could not auto-link customer record:", custErr);
      }
    }

    return newProfile;
  } catch (error) {
    console.error(
      "[user-profile] Unexpected error:",
      error instanceof Error ? error.message : error
    );
  }

  return null;
}
