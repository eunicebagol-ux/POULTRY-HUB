import { Users, UserCheck, UserX, Building2, Banknote } from "lucide-react";
import { getCurrentUserProfile } from "@/lib/user-profile";
import { getCustomers } from "@/actions/customers";
import { getCustomerBalanceSummaries } from "@/actions/payments";
import { CustomerTable } from "@/components/customers/customer-table";
import { CustomerDialog } from "@/components/customers/customer-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { DEFAULT_CURRENCY_SYMBOL } from "@/lib/constants";

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
  const [result, balanceResult] = await Promise.all([
    getCustomers(),
    isAdmin ? getCustomerBalanceSummaries() : Promise.resolve({ success: false as const, error: "" }),
  ]);
  const customers = result.success ? result.data ?? [] : [];
  const balanceSummaries = isAdmin && balanceResult.success ? balanceResult.data ?? [] : [];

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

      {/* Outstanding Balances — ADMIN only */}
      {isAdmin && balanceSummaries.length > 0 && (
        <section className="space-y-3 mt-6">
          <div>
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Banknote className="size-4 text-amber-600" />
              Outstanding Customer Balances
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Calculated from actual non-cancelled sales and recorded payments.
              Visible to Administrators only.
            </p>
          </div>

          <Card className="border-border/60 shadow-xs overflow-hidden">
            <CardContent className="p-0">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left p-3 font-medium text-muted-foreground">Customer</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Total Purchases</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Total Paid</th>
                    <th className="text-right p-3 font-medium text-muted-foreground">Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {balanceSummaries.map((b) => (
                    <tr key={b.customer_id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="p-3 font-medium text-foreground">{b.customer_name}</td>
                      <td className="p-3 text-right tabular-nums text-muted-foreground">
                        {DEFAULT_CURRENCY_SYMBOL}{b.total_sales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-right tabular-nums text-emerald-700 dark:text-emerald-400">
                        {DEFAULT_CURRENCY_SYMBOL}{b.total_paid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-right tabular-nums font-semibold">
                        <span className={b.outstanding_balance > 0 ? "text-amber-700 dark:text-amber-400" : "text-teal-600 dark:text-teal-400"}>
                          {DEFAULT_CURRENCY_SYMBOL}{b.outstanding_balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
