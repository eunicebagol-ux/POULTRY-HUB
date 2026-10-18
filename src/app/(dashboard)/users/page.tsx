import Link from "next/link";
import {
  UserCheck,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  UserX,
  Users,
  AlertTriangle,
} from "lucide-react";
import { clerkClient } from "@clerk/nextjs/server";
import { getCurrentUserProfile } from "@/lib/user-profile";
import { getUsers } from "@/actions/users";
import { UserTable, type UserManagementRow } from "@/components/users/user-table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = {
  title: "User Management — POULTRY HUB",
  description: "Manage farm user accounts, assign roles, and control active status.",
};

export default async function UsersPage() {
  const profile = await getCurrentUserProfile();

  // Strict Server-Side Authorization Guard: Active ADMIN only
  if (!profile || !profile.is_active || profile.role !== "ADMIN") {
    return (
      <div className="mx-auto max-w-md py-12 text-center space-y-4">
        <Card className="border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20">
          <CardHeader>
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900 text-amber-600 dark:text-amber-400 mb-2">
              <ShieldAlert className="size-6" />
            </div>
            <CardTitle className="text-base font-bold text-foreground">
              Access Restricted
            </CardTitle>
            <CardDescription className="text-xs">
              User account and role management requires an active ADMIN account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/dashboard"
              className={cn(
                buttonVariants({ size: "sm" }),
                "bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-50 dark:text-slate-900"
              )}
            >
              Return to Dashboard
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Fetch users from database
  const result = await getUsers();

  if (!result.success) {
    return (
      <div className="space-y-6 max-w-5xl">
        <div className="flex items-center gap-2 border-b pb-4">
          <UserCheck className="size-6 text-muted-foreground" />
          <h1 className="text-2xl font-semibold tracking-tight">
            User Management
          </h1>
        </div>
        <Alert className="border-destructive/30 bg-destructive/5">
          <AlertTriangle className="size-4 text-destructive" />
          <AlertTitle className="text-sm font-semibold text-destructive">
            Failed to load user directory
          </AlertTitle>
          <AlertDescription className="text-xs text-destructive/90">
            {result.error || "An unexpected error occurred while fetching user accounts."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const users = result.data ?? [];

  // Safely enrich with Clerk email addresses server-side
  const emailMap: Record<string, string> = {};
  try {
    const client = await clerkClient();
    const clerkResponse = await client.users.getUserList({ limit: 100 });
    if (clerkResponse?.data) {
      for (const u of clerkResponse.data) {
        const primary =
          u.emailAddresses?.find((e) => e.id === u.primaryEmailAddressId)?.emailAddress ||
          u.emailAddresses?.[0]?.emailAddress;
        if (primary) {
          emailMap[u.id] = primary;
        }
      }
    }
  } catch (err) {
    console.warn(
      "Could not query Clerk users for email mapping:",
      err instanceof Error ? err.message : err
    );
  }

  const enrichedUsers: UserManagementRow[] = users.map((u) => ({
    ...u,
    email: emailMap[u.id] ?? null,
  }));

  // Overview KPIs
  const totalCount = enrichedUsers.length;
  const activeCount = enrichedUsers.filter((u) => u.is_active).length;
  const adminCount = enrichedUsers.filter(
    (u) => u.role === "ADMIN" && u.is_active
  ).length;
  const inactiveCount = enrichedUsers.filter(
    (u) => !u.is_active && u.role !== "CUSTOMER"
  ).length;
  const pendingCustomerCount = enrichedUsers.filter(
    (u) => u.role === "CUSTOMER" && !u.is_active
  ).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between border-b border-border/60 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <UserCheck className="size-5" />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              User Management
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Manage farm staff accounts, assign administrative privileges, control account status, and approve self-registered customer accounts.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs bg-muted/40 border border-border/60 rounded-md px-3 py-1.5 text-muted-foreground self-start md:self-auto">
          <ShieldCheck className="size-3.5 text-primary shrink-0" />
          <span>Role-Based Access Control (RBAC) Active</span>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Accounts */}
        <Card className="border-border/60 shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-md bg-primary/10 text-primary shrink-0">
              <Users className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">
                Total Accounts
              </p>
              <p className="text-xl font-bold tabular-nums text-foreground">
                {totalCount}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Active Users */}
        <Card className="border-border/60 shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
              <CheckCircle2 className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">
                Active Staff
              </p>
              <p className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {activeCount}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Administrators */}
        <Card className="border-border/60 shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 shrink-0">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">
                Administrators
              </p>
              <p className="text-xl font-bold tabular-nums text-purple-600 dark:text-purple-400">
                {adminCount}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Inactive Staff */}
        <Card className="border-border/60 shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
              <UserX className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">
                Inactive Staff
              </p>
              <p className="text-xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
                {inactiveCount}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Pending Customers */}
        <Card
          className={cn(
            "border-border/60 shadow-xs",
            pendingCustomerCount > 0 && "border-orange-400/50 bg-orange-50/40 dark:bg-orange-950/10"
          )}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div
              className={cn(
                "p-2 rounded-md shrink-0",
                pendingCustomerCount > 0
                  ? "bg-orange-500/15 text-orange-600 dark:text-orange-400"
                  : "bg-muted/40 text-muted-foreground"
              )}
            >
              <UserCheck className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">
                Pending Approval
              </p>
              <p
                className={cn(
                  "text-xl font-bold tabular-nums",
                  pendingCustomerCount > 0
                    ? "text-orange-600 dark:text-orange-400"
                    : "text-foreground"
                )}
              >
                {pendingCustomerCount}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main User Directory Table */}
      <UserTable users={enrichedUsers} currentUserId={profile.id} />
    </div>
  );
}
