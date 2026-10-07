import { Truck, CheckCircle2, XCircle, Building2 } from "lucide-react";
import { getCurrentUserProfile } from "@/lib/user-profile";
import { getSuppliers } from "@/actions/suppliers";
import { SupplierTable } from "@/components/suppliers/supplier-table";
import { SupplierDialog } from "@/components/suppliers/supplier-dialog";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = {
  title: "Supplier Directory — POULTRY HUB",
  description: "Manage farm vendors, feed mills, medication suppliers, and equipment partners.",
};

export default async function SuppliersPage() {
  const profile = await getCurrentUserProfile();

  if (!profile || !profile.is_active) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2 border-b pb-4">
          <Truck className="size-6 text-muted-foreground" />
          <h1 className="text-2xl font-semibold tracking-tight">
            Supplier Directory
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Your account is pending activation. Please contact an administrator.
        </p>
      </div>
    );
  }

  const isAdmin = profile.role === "ADMIN";
  const result = await getSuppliers();
  const suppliers = result.success ? result.data ?? [] : [];

  const totalCount = suppliers.length;
  const activeCount = suppliers.filter((s) => s.is_active).length;
  const inactiveCount = totalCount - activeCount;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Truck className="size-6 text-muted-foreground" />
            <h1 className="text-2xl font-semibold tracking-tight">
              Supplier Directory
            </h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Manage farm vendors, feed suppliers, equipment providers, and procurement contacts.
          </p>
        </div>
        <SupplierDialog triggerButton={true} />
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
                Total Suppliers
              </p>
              <p className="text-xl font-bold tabular-nums">{totalCount}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-md bg-green-500/10 text-green-700 dark:text-green-400">
              <CheckCircle2 className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">
                Active Vendors
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
              <XCircle className="size-5" />
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

      {/* Main Supplier Table */}
      <SupplierTable suppliers={suppliers} isAdmin={isAdmin} />
    </div>
  );
}
