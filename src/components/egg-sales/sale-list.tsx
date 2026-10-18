"use client";

import * as React from "react";
import {
  ShoppingBag,
  Eye,
  FileText,
  CheckCircle2,
  Clock,
  CreditCard,
  Minus,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  EGG_SIZE_LABELS,
  PACKAGING_LABELS,
  DEFAULT_CURRENCY_SYMBOL,
} from "@/lib/constants";
import type { EggSaleView } from "@/actions/egg-sales";
import { RecordPaymentDialog } from "@/components/egg-sales/record-payment-dialog";
import { PaymentHistory } from "@/components/egg-sales/payment-history";
import { getPaymentSummaryForSale } from "@/actions/payments";

interface SaleListProps {
  sales: EggSaleView[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  `${DEFAULT_CURRENCY_SYMBOL}${n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

function PaymentStatusBadge({ status }: { status: string }) {
  const normalised = (status ?? "PENDING").toUpperCase();

  if (normalised === "PAID") {
    return (
      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300/40 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] gap-1">
        <CheckCircle2 className="size-2.5" />
        Paid
      </Badge>
    );
  }
  if (normalised === "PARTIAL") {
    return (
      <Badge className="bg-amber-100 text-amber-800 border-amber-300/40 dark:bg-amber-950 dark:text-amber-300 text-[10px] gap-1">
        <Minus className="size-2.5" />
        Partial
      </Badge>
    );
  }
  if (normalised === "CANCELLED") {
    return (
      <Badge className="bg-red-100 text-red-700 border-red-300/40 dark:bg-red-950 dark:text-red-400 text-[10px] gap-1">
        <XCircle className="size-2.5" />
        Cancelled
      </Badge>
    );
  }
  // PENDING
  return (
    <Badge className="bg-slate-100 text-slate-600 border-slate-300/40 dark:bg-slate-900 dark:text-slate-400 text-[10px] gap-1">
      <Clock className="size-2.5" />
      Pending
    </Badge>
  );
}

// ─── Sale Detail Dialog ───────────────────────────────────────────────────────

interface SaleDetailDialogProps {
  sale: EggSaleView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function SaleDetailDialog({ sale, open, onOpenChange }: SaleDetailDialogProps) {
  const [paymentRefreshToken, setPaymentRefreshToken] = React.useState(0);
  const [recordPaymentOpen, setRecordPaymentOpen] = React.useState(false);
  const [totalPaid, setTotalPaid] = React.useState(0);
  const [remainingBalance, setRemainingBalance] = React.useState(sale.total_amount);
  const [loadingSummary, setLoadingSummary] = React.useState(false);

  // Re-fetch payment summary whenever dialog opens or payment is recorded
  React.useEffect(() => {
    if (!open) return;

    const load = async () => {
      setLoadingSummary(true);
      const result = await getPaymentSummaryForSale(sale.id);
      if (result.success && result.data) {
        setTotalPaid(result.data.total_paid);
        setRemainingBalance(result.data.remaining_balance);
      }
      setLoadingSummary(false);
    };

    load();
  }, [open, sale.id, paymentRefreshToken]);

  const paymentStatus = sale.payment_status ?? "PENDING";
  const canRecordPayment =
    paymentStatus !== "PAID" && paymentStatus !== "CANCELLED";

  const handlePaymentSuccess = () => {
    setPaymentRefreshToken((t) => t + 1);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center justify-between">
              <span>Sale Invoice Breakdown</span>
              {sale.invoice_number && (
                <span className="font-mono text-xs font-normal text-muted-foreground">
                  {sale.invoice_number}
                </span>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Customer:{" "}
              <strong className="text-foreground">
                {sale.customer?.name ?? "Direct Buyer"}
              </strong>{" "}
              · Date:{" "}
              {new Date(sale.sale_date).toLocaleDateString("en-PH", {
                dateStyle: "medium",
              })}
            </DialogDescription>
          </DialogHeader>

          {/* Payment Status Summary */}
          <div className="rounded-lg bg-muted/30 border border-border/50 p-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs sm:grid-cols-4">
            <div>
              <p className="text-muted-foreground mb-0.5">Sale Total</p>
              <p className="font-bold tabular-nums text-foreground">
                {fmt(sale.total_amount)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground mb-0.5">Total Paid</p>
              <p className="font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
                {loadingSummary ? "…" : fmt(totalPaid)}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground mb-0.5">Remaining</p>
              <p className="font-bold tabular-nums text-amber-700 dark:text-amber-400">
                {loadingSummary ? "…" : fmt(Math.max(0, remainingBalance))}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground mb-0.5">Status</p>
              <PaymentStatusBadge status={paymentStatus} />
            </div>
          </div>

          {/* Record Payment Button */}
          {canRecordPayment && (
            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1.5 border-teal-600/50 text-teal-700 hover:bg-teal-50 dark:text-teal-400 dark:hover:bg-teal-950/30"
                onClick={() => setRecordPaymentOpen(true)}
              >
                <CreditCard className="size-3.5" />
                Record Payment
              </Button>
            </div>
          )}

          {/* Tabs: Line Items / Payment History */}
          <Tabs defaultValue="items" className="mt-1">
            <TabsList className="h-8">
              <TabsTrigger value="items" className="text-xs h-7">
                Line Items
              </TabsTrigger>
              <TabsTrigger value="payments" className="text-xs h-7">
                Payment History
              </TabsTrigger>
            </TabsList>

            {/* Line Items Tab */}
            <TabsContent value="items" className="mt-3 space-y-3">
              <div className="rounded-lg border border-border/60 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Egg Size</TableHead>
                      <TableHead className="text-xs">Packaging</TableHead>
                      <TableHead className="text-right text-xs">Pkg Qty</TableHead>
                      <TableHead className="text-right text-xs">Total Pcs</TableHead>
                      <TableHead className="text-right text-xs">Unit Price</TableHead>
                      <TableHead className="text-right text-xs">Line Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sale.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-xs font-medium text-foreground">
                          {EGG_SIZE_LABELS[item.size] ?? item.size}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {PACKAGING_LABELS[item.packaging] ?? item.packaging}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          {item.package_quantity.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                          {item.total_pieces.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                          {fmt(item.unit_price)}
                        </TableCell>
                        <TableCell className="text-right text-xs font-semibold tabular-nums text-foreground">
                          {fmt(item.line_total)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Financial Summary */}
              <div className="rounded-lg bg-muted/30 p-3 space-y-1.5 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal:</span>
                  <span className="font-semibold text-foreground tabular-nums">
                    {fmt(sale.subtotal)}
                  </span>
                </div>
                {sale.discount > 0 && (
                  <div className="flex justify-between text-rose-600 dark:text-rose-400">
                    <span>Discount:</span>
                    <span className="font-semibold tabular-nums">
                      -{fmt(sale.discount)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-1.5 font-bold text-sm text-foreground">
                  <span>Grand Total:</span>
                  <span className="text-teal-600 dark:text-teal-400 tabular-nums">
                    {fmt(sale.total_amount)}
                  </span>
                </div>
              </div>

              {/* Notes */}
              {sale.notes && (
                <div className="text-xs space-y-1">
                  <span className="font-semibold text-muted-foreground">Notes:</span>
                  <p className="text-muted-foreground bg-muted/20 p-2 rounded-md">
                    {sale.notes}
                  </p>
                </div>
              )}
            </TabsContent>

            {/* Payment History Tab */}
            <TabsContent value="payments" className="mt-3">
              <PaymentHistory
                saleId={sale.id}
                totalAmount={sale.total_amount}
                refreshToken={paymentRefreshToken}
              />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog */}
      {canRecordPayment && (
        <RecordPaymentDialog
          sale={sale}
          totalPaid={totalPaid}
          remainingBalance={remainingBalance}
          open={recordPaymentOpen}
          onOpenChange={setRecordPaymentOpen}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </>
  );
}

// ─── Main SaleList Component ──────────────────────────────────────────────────

export function SaleList({ sales }: SaleListProps) {
  const [selectedSale, setSelectedSale] = React.useState<EggSaleView | null>(
    null
  );
  const [recordPaymentSale, setRecordPaymentSale] =
    React.useState<EggSaleView | null>(null);
  const [paymentTotals, setPaymentTotals] = React.useState<
    Record<string, { total_paid: number; remaining_balance: number }>
  >({});

  // Fetch payment totals for all non-cancelled, non-pending-zero sales
  React.useEffect(() => {
    if (sales.length === 0) return;

    const salesToFetch = sales.filter(
      (s) => s.payment_status === "PARTIAL" || s.payment_status === "PAID"
    );

    Promise.all(
      salesToFetch.map((s) =>
        getPaymentSummaryForSale(s.id).then((result) => ({
          id: s.id,
          result,
        }))
      )
    ).then((results) => {
      const map: Record<string, { total_paid: number; remaining_balance: number }> = {};
      for (const { id, result } of results) {
        if (result.success && result.data) {
          map[id] = {
            total_paid: result.data.total_paid,
            remaining_balance: result.data.remaining_balance,
          };
        }
      }
      setPaymentTotals(map);
    });
  }, [sales]);

  if (sales.length === 0) {
    return (
      <Card className="border-border/60 shadow-xs">
        <CardContent className="py-14 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground/60">
              <ShoppingBag className="size-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                No egg sales recorded yet
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-sm mx-auto">
                Once recorded, sales invoices, itemized packaging breakdowns,
                customer transaction links, and payment history will appear here.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-border/60 shadow-xs overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Sale Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Items Sold</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Remaining</TableHead>
                <TableHead className="text-center">Payment</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.map((sale) => {
                const totalPieces = sale.items.reduce(
                  (sum, item) => sum + item.total_pieces,
                  0
                );
                const itemsCount = sale.items.length;
                const paymentStatus = sale.payment_status ?? "PENDING";
                const totals = paymentTotals[sale.id];
                const totalPaid = totals?.total_paid ?? 0;
                const remaining = totals?.remaining_balance ?? sale.total_amount;
                const canRecord =
                  paymentStatus !== "PAID" && paymentStatus !== "CANCELLED";

                return (
                  <TableRow key={sale.id}>
                    {/* Invoice */}
                    <TableCell className="font-mono text-xs font-medium text-foreground">
                      {sale.invoice_number ? (
                        <span className="flex items-center gap-1.5">
                          <FileText className="size-3 text-muted-foreground" />
                          {sale.invoice_number}
                        </span>
                      ) : (
                        <span className="text-muted-foreground italic">
                          Auto
                        </span>
                      )}
                    </TableCell>

                    {/* Sale Date */}
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(sale.sale_date).toLocaleDateString("en-PH", {
                        dateStyle: "medium",
                      })}
                    </TableCell>

                    {/* Customer */}
                    <TableCell>
                      <div className="text-xs font-medium text-foreground">
                        {sale.customer?.name ?? "Direct Buyer"}
                      </div>
                      {sale.customer?.contact_person && (
                        <div className="text-[11px] text-muted-foreground">
                          {sale.customer.contact_person}
                        </div>
                      )}
                    </TableCell>

                    {/* Items Sold */}
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className="text-[11px] font-normal"
                      >
                        {itemsCount} {itemsCount === 1 ? "line" : "lines"} ·{" "}
                        {totalPieces.toLocaleString()} pcs
                      </Badge>
                    </TableCell>

                    {/* Total Amount */}
                    <TableCell className="text-right tabular-nums text-xs font-bold text-teal-700 dark:text-teal-400">
                      {fmt(sale.total_amount)}
                    </TableCell>

                    {/* Total Paid */}
                    <TableCell className="text-right tabular-nums text-xs text-emerald-700 dark:text-emerald-400">
                      {paymentStatus === "PENDING"
                        ? "—"
                        : fmt(totalPaid)}
                    </TableCell>

                    {/* Remaining */}
                    <TableCell className="text-right tabular-nums text-xs text-amber-700 dark:text-amber-400">
                      {paymentStatus === "PAID"
                        ? <span className="text-muted-foreground">—</span>
                        : fmt(remaining)}
                    </TableCell>

                    {/* Payment Status */}
                    <TableCell className="text-center">
                      <PaymentStatusBadge status={paymentStatus} />
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canRecord && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setRecordPaymentSale(sale)}
                            className="h-7 px-2 text-xs text-teal-700 hover:text-teal-900 hover:bg-teal-50 dark:text-teal-400 dark:hover:bg-teal-950/30"
                          >
                            <CreditCard className="mr-1 size-3.5" />
                            Pay
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedSale(sale)}
                          className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <Eye className="mr-1 size-3.5" />
                          Details
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Sale Detail Dialog (with payment history) */}
      {selectedSale && (
        <SaleDetailDialog
          sale={selectedSale}
          open={Boolean(selectedSale)}
          onOpenChange={(open) => {
            if (!open) setSelectedSale(null);
          }}
        />
      )}

      {/* Inline Record Payment Dialog (from table row) */}
      {recordPaymentSale && (
        <RecordPaymentDialog
          sale={recordPaymentSale}
          totalPaid={paymentTotals[recordPaymentSale.id]?.total_paid ?? 0}
          remainingBalance={
            paymentTotals[recordPaymentSale.id]?.remaining_balance ??
            recordPaymentSale.total_amount
          }
          open={Boolean(recordPaymentSale)}
          onOpenChange={(open) => {
            if (!open) setRecordPaymentSale(null);
          }}
          onSuccess={() => {
            // Refresh the payment totals for this sale
            getPaymentSummaryForSale(recordPaymentSale.id).then((result) => {
              if (result.success && result.data) {
                setPaymentTotals((prev) => ({
                  ...prev,
                  [recordPaymentSale.id]: {
                    total_paid: result.data!.total_paid,
                    remaining_balance: result.data!.remaining_balance,
                  },
                }));
              }
            });
          }}
        />
      )}
    </>
  );
}
