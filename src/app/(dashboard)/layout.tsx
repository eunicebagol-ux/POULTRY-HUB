import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/user-profile";
import { AppShell } from "@/components/layout/app-shell";
import { ProfilePendingBanner } from "@/components/layout/profile-pending-banner";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  // Guard: Must be authenticated via Clerk
  if (!userId) {
    redirect("/sign-in");
  }

  // Resolve profile from Supabase profiles table
  const profile = await getCurrentUserProfile();

  // Security Guard: Customers are strictly isolated from farm operations
  if (profile && profile.role === "CUSTOMER") {
    redirect("/customer/dashboard");
  }

  // Profile exists and is active — normal operation
  if (profile && profile.is_active) {
    return (
      <AppShell userRole={profile.role} userName={profile.full_name}>
        {children}
      </AppShell>
    );
  }

  // Authenticated via Clerk but profile is not yet provisioned or is inactive.
  // Show the real dashboard shell with safe read-only defaults so the user
  // can see the actual UI (with honest zero/empty data states).
  // - Role defaults to STAFF: no admin nav items are exposed.
  // - All Supabase queries return empty results naturally (no data yet).
  // - Mutations remain gated by the existing profile/role authorization layer.
  const clerkUser = await currentUser();
  const displayName = clerkUser
    ? [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim() ||
      clerkUser.emailAddresses?.[0]?.emailAddress ||
      "Farm User"
    : "Farm User";

  const isInactive = Boolean(profile && !profile.is_active);

  return (
    <AppShell userRole="STAFF" userName={displayName}>
      <ProfilePendingBanner isInactive={isInactive} />
      {children}
    </AppShell>
  );
}
