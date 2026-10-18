import * as React from "react";
import { currentUser } from "@clerk/nextjs/server";
import {
  ShoppingBag,
  CreditCard,
  User,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getCustomerDashboardData } from "@/actions/customer-portal";
import {
  resolveCustomerDisplayName,
  isMeaningfulCustomerName,
} from "@/lib/customer-display";
import { getMyOrders } from "@/actions/customer-orders";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CustomerProfileForm } from "@/components/customer/customer-profile-form";
import { DEFAULT_CURRENCY_SYMBOL, PACKAGING_LABELS, EGG_SIZE_LABELS } from "@/lib/constants";

export const metadata = {
  title: "My Account & Orders — POULTRY HUB Customer Portal",
  description: "View your purchase history, payment status, and account profile.",
};

export default async function CustomerDashboardPage() {
  const [result, ordersResult] = await Promise.all([
    getCustomerDashboardData(),
    getMyOrders(),
  ]);
  const clerkUser = await currentUser();
  const primaryEmail = clerkUser?.emailAddresses?.[0]?.emailAddress ?? null;

  if (!result.success) {
    return (
      <div className="space-y-6">
        <Alert className="border-destructive/30 bg-destructive/5">
          <AlertCircle className="size-4 text-destructive" />
          <AlertTitle className="text-sm font-semibold text-destructive">
            Access Error
          </AlertTitle>
          <AlertDescription className="text-xs text-destructive/90">
            {result.error || "Unable to load customer information."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const { profile, customerRecord, purchases, payments, summary } = result.data!;
  const orders = ordersResult.success && ordersResult.data ? ordersResult.data : [];
  const activeOrders = orders.filter((o) =>
    ["PENDING", "CONFIRMED", "PREPARING", "READY"].includes(o.status)
  );

  // Derive display name from verified identity (email username used as fallback)
  const customerDisplayName = resolveCustomerDisplayName({
    profile,
    customerRecord,
    clerkUser,
    email: primaryEmail,
  });

  const formatCurrency = (amount: number) => {
    return `${DEFAULT_CURRENCY_SYMBOL}${amount.toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <div className="space-y-6">
      {/* ── Welcome Banner ────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b border-border/70 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Customer Dashboard
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Welcome, <span className="font-semibold text-foreground">{customerDisplayName}</span>! Manage your egg purchases, view order status, and track invoices.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/customer/order">
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 shadow-xs">
              <ShoppingBag className="size-3.5" />
              Place Order
            </Button>
          </Link>
          <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 py-1">
            <CheckCircle2 className="size-3.5 mr-1 text-emerald-600 dark:text-emerald-400" />
            Verified Customer
          </Badge>
        </div>
      </div>

      {/* ── Active Orders Notice Banner (if any) ────────────────────── */}
      {activeOrders.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Clock className="size-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">
                You have {activeOrders.length} active egg order{activeOrders.length > 1 ? "s" : ""} in progress
              </p>
              <p className="text-[11px] text-muted-foreground">
                Our farm staff are reviewing and preparing your egg orders.
              </p>
            </div>
          </div>
          <Link href="/customer/orders">
            <Button variant="outline" size="sm" className="text-xs h-7 text-amber-700 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10 shrink-0">
              Track Orders &rarr;
            </Button>
          </Link>
        </div>
      )}

      {/* ── Account Summary Cards ─────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Invoiced Purchases */}
        <Card className="border-border/60 shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10 text-primary shrink-0">
              <ShoppingBag className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Total Purchases</p>
              <p className="text-lg sm:text-xl font-bold tabular-nums text-foreground">
                {formatCurrency(summary.totalPurchases)}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Total Payments Made */}
        <Card className="border-border/60 shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shrink-0">
              <CreditCard className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Total Paid</p>
              <p className="text-lg sm:text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatCurrency(summary.totalPaid)}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Outstanding Balance */}
        <Card className="border-border/60 shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div
              className={`p-2 rounded-xl shrink-0 ${
                summary.outstandingBalance > 0
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              }`}
            >
              <Clock className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Remaining Balance</p>
              <p
                className={`text-lg sm:text-xl font-bold tabular-nums ${
                  summary.outstandingBalance > 0
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-emerald-600 dark:text-emerald-400"
                }`}
              >
                {formatCurrency(summary.outstandingBalance)}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Total Orders */}
        <Card className="border-border/60 shadow-xs">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 shrink-0">
              <FileText className="size-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Recorded Orders</p>
              <p className="text-lg sm:text-xl font-bold tabular-nums text-purple-600 dark:text-purple-400">
                {summary.orderCount}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Main Tabbed Content ───────────────────────────────────── */}
      <Tabs defaultValue="purchases" className="space-y-4">
        <TabsList className="bg-muted/50 p-1 border border-border/60 rounded-xl">
          <TabsTrigger value="purchases" className="text-xs font-semibold rounded-lg flex items-center gap-1.5">
            <ShoppingBag className="size-3.5" /> Purchase History ({purchases.length})
          </TabsTrigger>
          <TabsTrigger value="payments" className="text-xs font-semibold rounded-lg flex items-center gap-1.5">
            <CreditCard className="size-3.5" /> Payment Records ({payments.length})
          </TabsTrigger>
          <TabsTrigger value="profile" className="text-xs font-semibold rounded-lg flex items-center gap-1.5">
            <User className="size-3.5" /> Account Profile
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Purchase History ─────────────────────────────────── */}
        <TabsContent value="purchases" className="space-y-4">
          <Card className="border-border/60 shadow-xs">
            <CardHeader className="pb-3 border-b border-border/60">
              <CardTitle className="text-base font-semibold text-foreground">
                Recorded Purchase Orders
              </CardTitle>
              <CardDescription className="text-xs">
                Official sales records and egg deliveries linked to your customer account.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {purchases.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <div className="size-12 rounded-full bg-muted/60 text-muted-foreground flex items-center justify-center mx-auto">
                    <ShoppingBag className="size-6" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">No purchases recorded yet</p>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    When you purchase eggs from POULTRY HUB, your itemized receipts and delivery invoices will appear here automatically.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="text-xs bg-muted/30">
                        <TableHead>Invoice #</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Purchased Items</TableHead>
                        <TableHead className="text-right">Total Amount</TableHead>
                        <TableHead className="text-center">Payment Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchases.map((purchase) => (
                        <TableRow key={purchase.id} className="text-xs">
                          <TableCell className="font-mono font-medium text-foreground whitespace-nowrap">
                            {purchase.invoice_number || `ORD-${purchase.id.slice(0, 8)}`}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-muted-foreground">
                            {new Date(purchase.sale_date).toLocaleDateString("en-PH", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </TableCell>
                          <TableCell>
                            {purchase.items.length === 0 ? (
                              <span className="text-muted-foreground italic">Standard Farm Order</span>
                            ) : (
                              <div className="space-y-1">
                                {purchase.items.map((item) => (
                                  <div key={item.id} className="flex items-center gap-2 text-[11px]">
                                    <span className="font-semibold text-foreground">
                                      {item.package_quantity}× {PACKAGING_LABELS[item.packaging] || item.packaging}
                                    </span>
                                    <span className="text-muted-foreground">
                                      ({EGG_SIZE_LABELS[item.size] || item.size})
                                    </span>
                                    <span className="text-muted-foreground/60">—</span>
                                    <span className="tabular-nums font-medium text-foreground">
                                      {formatCurrency(item.line_total)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-bold text-foreground whitespace-nowrap">
                            {formatCurrency(purchase.total_amount)}
                          </TableCell>
                          <TableCell className="text-center whitespace-nowrap">
                            {purchase.payment_status === "PAID" ? (
                              <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-500/20 text-[10px]">
                                Paid
                              </Badge>
                            ) : purchase.payment_status === "PARTIAL" ? (
                              <Badge className="bg-amber-500/10 text-amber-700 border-amber-500/20 text-[10px]">
                                Partial
                              </Badge>
                            ) : purchase.payment_status === "CANCELLED" ? (
                              <Badge variant="outline" className="text-muted-foreground text-[10px]">
                                Cancelled
                              </Badge>
                            ) : (
                              <Badge className="bg-rose-500/10 text-rose-700 border-rose-500/20 text-[10px]">
                                Pending
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Payment History ──────────────────────────────────── */}
        <TabsContent value="payments" className="space-y-4">
          <Card className="border-border/60 shadow-xs">
            <CardHeader className="pb-3 border-b border-border/60">
              <CardTitle className="text-base font-semibold text-foreground">
                Payment Records &amp; Receipts
              </CardTitle>
              <CardDescription className="text-xs">
                Ledger of verified payments received by POULTRY HUB against your egg purchases.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {payments.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <div className="size-12 rounded-full bg-muted/60 text-muted-foreground flex items-center justify-center mx-auto">
                    <CreditCard className="size-6" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">No payments recorded yet</p>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Payments received via Cash, Bank Transfer, or GCash/E-Wallet will be credited here by the farm.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="text-xs bg-muted/30">
                        <TableHead>Payment Date</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Invoice Reference</TableHead>
                        <TableHead>Ref / Check #</TableHead>
                        <TableHead className="text-right">Amount Paid</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((payment) => (
                        <TableRow key={payment.id} className="text-xs">
                          <TableCell className="whitespace-nowrap font-medium text-foreground">
                            {new Date(payment.payment_date).toLocaleDateString("en-PH", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <Badge variant="secondary" className="text-[10px]">
                              {payment.payment_method.replace("_", " ")}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-muted-foreground whitespace-nowrap">
                            {payment.invoice_number || `Sale #${payment.sale_id.slice(0, 8)}`}
                          </TableCell>
                          <TableCell className="font-mono text-muted-foreground whitespace-nowrap">
                            {payment.reference_number || "—"}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                            {formatCurrency(payment.amount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: Account Profile ──────────────────────────────────── */}
        <TabsContent value="profile" className="space-y-4">
          <Card className="border-border/60 shadow-xs">
            <CardHeader className="pb-3 border-b border-border/60">
              <CardTitle className="text-base font-semibold text-foreground">
                Customer Profile &amp; Contact Details
              </CardTitle>
              <CardDescription className="text-xs">
                Update your contact and delivery information so the farm can coordinate deliveries and invoicing.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <CustomerProfileForm
                initialFullName={isMeaningfulCustomerName(customerDisplayName) ? customerDisplayName : ""}
                initialPhone={customerRecord?.phone || profile.phone}
                initialAddress={customerRecord?.address || null}
                email={primaryEmail}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
