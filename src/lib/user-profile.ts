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
 * Uses the Clerk session token and queries `public.profiles` where `id = Clerk userId`.
 * Respects PostgreSQL RLS: (auth.jwt() ->> 'sub') = profiles.id.
 *
 * If an authenticated user does not have a provisioned profile row yet,
 * it safely provisions a default CUSTOMER profile so self-registered users
 * can access their customer portal immediately.
 */
export async function getCurrentUserProfile(): Promise<UserProfile | null> {
  const { userId } = await auth();
  if (!userId) return null;

  try {
    const supabase = await createClient();
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("id, role, full_name, phone, avatar_url, is_active")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching user profile from Supabase:", error.message || error);
    }

    if (profile) {
      return profile as UserProfile;
    }

    // Auto-provision fallback: verified Clerk user without profile receives CUSTOMER role
    const clerkUser = await currentUser();
    if (clerkUser) {
      const primaryEmail = clerkUser.emailAddresses?.[0]?.emailAddress;
      const clerkFullName =
        [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim();
      // Never store an email address as a person's name
      const fullName = clerkFullName || "Customer";

      const adminClient = createAdminClient();
      const isActive = clerkUser.publicMetadata?.is_active === true;

      const newProfile: UserProfile = {
        id: userId,
        role: "CUSTOMER",
        full_name: fullName,
        phone: clerkUser.phoneNumbers?.[0]?.phoneNumber || null,
        avatar_url: clerkUser.imageUrl || null,
        is_active: isActive, // Reflects Clerk approval metadata (defaults to false until approved)
      };

      try {
        const adminClient = createAdminClient();
        await adminClient.from("profiles").upsert(
          {
            ...newProfile,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );
      } catch (upsertErr) {
        // Handled gracefully if Migration 012 is pending in DB
      }

      // Auto-link or insert into customers table
      if (primaryEmail) {
        try {
          const normalizedEmail = primaryEmail.toLowerCase().trim();
          const { data: matchingCusts } = await adminClient
            .from("customers")
            .select("id, clerk_user_id")
            .eq("email", normalizedEmail);

          const unlinkedCusts = (matchingCusts ?? []).filter((c) => !c.clerk_user_id);

          if (unlinkedCusts.length === 1) {
            await adminClient
              .from("customers")
              .update({ clerk_user_id: userId, is_active: false, updated_at: new Date().toISOString() })
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
          console.warn("Could not auto-link customer in fallback:", custErr);
        }
      }

      return newProfile;
    }
  } catch (error) {
    console.error(
      "Error fetching or provisioning user profile:",
      error instanceof Error ? error.message : error
    );
  }

  return null;
}
