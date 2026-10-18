import Link from "next/link";
import { redirect } from "next/navigation";
import { ShoppingCart } from "lucide-react";
import { getCurrentUserProfile } from "@/lib/user-profile";
import { getMyOrders } from "@/actions/customer-orders";
import { CustomerOrdersList } from "@/components/customer/customer-orders-list";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const metadata = {
  title: "My Orders — POULTRY HUB Customer Portal",
  description: "View the status of your egg purchase requests and order history.",
};

export default async function CustomerOrdersPage() {
  // ── Auth guard ──────────────────────────────────────────────────────────────
  const profile = await getCurrentUserProfile();

  if (!profile || !profile.is_active) {
    redirect("/customer/dashboard");
  }

  if (profile.role !== "CUSTOMER") {
    redirect("/egg-sales");
  }

  // ── Fetch orders ────────────────────────────────────────────────────────────
  const ordersResult = await getMyOrders();

  return (
    <div className="space-y-6">
      {/* ── Page Header ────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between border-b border-border/70 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            My Orders
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Track the status of your egg purchase requests. Contact the farm team
            for questions about confirmed or in-progress orders.
          </p>
        </div>
        <Link href="/customer/order">
          <Button size="sm" className="text-xs h-8 shrink-0">
            <ShoppingCart className="size-3.5 mr-1.5" />
            Place New Order
          </Button>
        </Link>
      </div>

      {/* ── Error state ────────────────────────────────────────────── */}
      {!ordersResult.success && (
        <Alert className="border-destructive/30 bg-destructive/5">
          <AlertDescription className="text-xs text-destructive/90">
            {ordersResult.error}
          </AlertDescription>
        </Alert>
      )}

      {/* ── Orders list ────────────────────────────────────────────── */}
      <CustomerOrdersList
        orders={ordersResult.success ? (ordersResult.data ?? []) : []}
      />
    </div>
  );
}
