import * as React from "react";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { Egg, ShieldCheck, LogOut } from "lucide-react";
import Link from "next/link";
import { getCurrentUserProfile } from "@/lib/user-profile";
import { getCustomerDisplayName } from "@/actions/customer-portal";
import { Button } from "@/components/ui/button";

import { CustomerNav } from "@/components/customer/customer-nav";

export const metadata = {
  title: "Customer Portal — POULTRY HUB",
  description: "View your purchase history, payment status, and account profile.",
};

export default async function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const profile = await getCurrentUserProfile();

  // Security Guard: Farm staff and admins are strictly separated from customer portal
  if (profile && (profile.role === "STAFF" || profile.role === "ADMIN")) {
    redirect("/dashboard");
  }

  // Handle pending, suspended, or unprovisioned customer accounts
  if (!profile || !profile.is_active) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
        <div className="max-w-md w-full bg-card rounded-2xl border border-border p-6 text-center space-y-4 shadow-lg">
          <div className="size-12 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
            <Egg className="size-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Account Pending Approval
          </h1>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Your customer account is currently pending administrative verification or has been deactivated. Once an administrator approves your account, you will be able to access the customer portal.
          </p>
          <div className="pt-2">
            <Link href="/sign-in">
              <Button variant="outline" size="sm" className="text-xs">
                <LogOut className="size-3.5 mr-1.5" /> Sign Out
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const displayName = await getCustomerDisplayName();

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/50 dark:bg-slate-950/50 text-foreground font-sans antialiased">
      {/* ── Top Header ────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 w-full border-b border-border/70 bg-background/95 backdrop-blur-md">
        <div className="container mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Brand & Portal Badge */}
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md ring-1 ring-emerald-400/30">
              <Egg className="size-5" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-bold tracking-tight text-foreground text-sm sm:text-base leading-none">
                  POULTRY HUB
                </span>
                <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/20">
                  Customer Portal
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground mt-0.5 hidden sm:inline">
                Direct Buyer Account &amp; Purchase History
              </span>
            </div>
          </div>

          {/* User Section & Clerk UserButton */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-semibold text-foreground leading-tight">
                {displayName}
              </p>
              <div className="flex items-center justify-end gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                <ShieldCheck className="size-3" /> Verified Buyer
              </div>
            </div>
            <div className="ring-1 ring-border rounded-full p-0.5 bg-background shadow-xs">
              <UserButton
                appearance={{
                  elements: {
                    avatarBox: "size-8 rounded-full ring-2 ring-emerald-600/30",
                  },
                }}
              />
            </div>
          </div>
        </div>
      </header>
      <CustomerNav />

      {/* ── Main Content Area ─────────────────────────────────────── */}
      <main className="flex-1 container mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
        {children}
      </main>

      {/* ── Public Footer ─────────────────────────────────────────── */}
      <footer className="border-t border-border/50 py-6 text-center text-xs text-muted-foreground bg-background/50">
        <div className="container mx-auto max-w-6xl px-4">
          <p>&copy; {new Date().getFullYear()} POULTRY HUB — Egg Production &amp; Farm Sales System</p>
        </div>
      </footer>
    </div>
  );
}
