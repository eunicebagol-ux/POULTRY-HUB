import { createClient } from "@/lib/supabase/server";
import { auth } from "@clerk/nextjs/server";
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
 * Returns null if the user is unauthenticated, has no provisioned profile row,
 * or if a database query error occurs.
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
      return null;
    }

    if (profile) {
      return profile as UserProfile;
    }
  } catch (error) {
    console.error(
      "Error fetching user profile from Supabase:",
      error instanceof Error ? error.message : error
    );
  }

  return null;
}
