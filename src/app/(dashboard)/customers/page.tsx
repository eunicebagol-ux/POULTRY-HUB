import { Users, UserCheck, UserX, Building2 } from "lucide-react";
import { getCurrentUserProfile } from "@/lib/user-profile";
import { getCustomers } from "@/actions/customers";
import { CustomerTable } from "@/components/customers/customer-table";
import { CustomerDialog } from "@/components/customers/customer-dialog";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = {
  title: "Customer Directory — POULTRY HUB",
  description: "Manage egg buyers, contact details, and customer status.",
};

export default async function CustomersPage() {
  const profile = await getCurrentUserProfile();

  if (!profile || !profile.is_active) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 border-b pb-4">
          <Users className="size-6 text-muted-foreground" />
          <h1 className="text-2xl font-semibold tracking-tight">
            Customer Directory
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Your account is pending activation. Please contact an administrator.
        </p>
      </div>
    );
  }

  const isAdmin = profile.role === "ADMIN";
  const result = await getCustomers();
  const customers = result.success ? result.data ?? [] : [];

  const totalCount = customers.length;
  const activeCount = customers.filter((c) => c.is_active).length;
  const inactiveCount = totalCount - activeCount;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="size-6 text-muted-foreground" />
            <h1 className="text-2xl font-semibold tracking-tight">
              Customer Directory
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Manage egg buyers, contact information, and active purchasing status.
          </p>
        </div>
        <CustomerDialog triggerButton={true} />
      </div>

      {/* KPI Overview */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-border/60 shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-md bg-primary/10 text-primary">
              <Building2 className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">
                Total Customers
              </p>
              <p className="text-xl font-bold tabular-nums">{totalCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-md bg-green-500/10 text-green-700 dark:text-green-400">
              <UserCheck className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">
                Active Buyers
              </p>
              <p className="text-xl font-bold tabular-nums text-green-700 dark:text-green-400">
                {activeCount}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-md bg-muted text-muted-foreground">
              <UserX className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">
                Inactive
              </p>
              <p className="text-xl font-bold tabular-nums text-muted-foreground">
                {inactiveCount}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Customer Table */}
      <CustomerTable customers={customers} isAdmin={isAdmin} />
    </div>
  );
}
