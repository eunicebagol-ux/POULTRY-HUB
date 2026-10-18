import * as React from "react";
import { redirect } from "next/navigation";
import { ClipboardList, Clock, CheckCircle2, Package, Truck, AlertCircle } from "lucide-react";
import { getCurrentUserProfile } from "@/lib/user-profile";
import { getAllOrders } from "@/actions/customer-orders";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { OrderManagementTable } from "@/components/customer-orders/order-management-table";

export const metadata = {
  title: "Customer Egg Orders — POULTRY HUB",
  description:
    "Review, approve, prepare, and fulfill direct customer egg purchase orders.",
};

export default async function CustomerOrdersPage() {
  const profile = await getCurrentUserProfile();

  if (!profile || !profile.is_active) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Customer Orders
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Your account is pending activation. Please contact an administrator.
          </p>
        </div>
      </div>
    );
  }

  // Security: Customers must not access the staff order management console
  if (profile.role === "CUSTOMER") {
    redirect("/customer/dashboard");
  }

  const result = await getAllOrders();
  const orders = result.success && result.data ? result.data : [];

  const pendingCount = orders.filter((o) => o.status === "PENDING").length;
  const inProgressCount = orders.filter((o) =>
    ["CONFIRMED", "PREPARING"].includes(o.status)
  ).length;
  const readyCount = orders.filter((o) => o.status === "READY").length;
  const completedCount = orders.filter((o) => o.status === "COMPLETED").length;

  return (
    <div className="space-y-6">
      {/* ── Page Header ────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ClipboardList className="size-6 text-emerald-600" />
            Customer Egg Orders
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Review incoming customer requests, coordinate packing, and update fulfillment status.
          </p>
        </div>
      </div>

      {/* ── Migration Notice Banner if table not found ────────────── */}
      {!result.success && (
        <Alert className="border-amber-500/30 bg-amber-500/5">
          <AlertCircle className="size-4 text-amber-600 dark:text-amber-400" />
          <AlertTitle className="text-xs font-semibold text-amber-800 dark:text-amber-300">
            Database Migration Notice
          </AlertTitle>
          <AlertDescription className="text-xs text-amber-700/90 dark:text-amber-400/90">
            {result.error?.includes("does not exist") || result.error?.includes("42P01")
              ? "Customer orders table (Migration 014) is not yet applied to the database. Showing offline empty state."
              : result.error}
          </AlertDescription>
        </Alert>
      )}

      {/* ── Summary Stat Cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="border-border/60 shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0">
              <Clock className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Pending Review</p>
              <p className="text-xl font-bold tabular-nums text-foreground">
                {pendingCount}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shrink-0">
              <Package className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">In Progress</p>
              <p className="text-xl font-bold tabular-nums text-foreground">
                {inProgressCount}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
              <Truck className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Ready for Pickup</p>
              <p className="text-xl font-bold tabular-nums text-foreground">
                {readyCount}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-slate-500/10 text-slate-600 dark:text-slate-400 shrink-0">
              <CheckCircle2 className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Completed</p>
              <p className="text-xl font-bold tabular-nums text-foreground">
                {completedCount}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Interactive Order Management Table ─────────────────────── */}
      <OrderManagementTable initialOrders={orders} />
    </div>
  );
}
