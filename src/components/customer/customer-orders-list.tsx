"use client";

import * as React from "react";
import { useTransition } from "react";
import { toast } from "sonner";
import {
  ShoppingBag,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  PackageCheck,
  AlertCircle,
  Truck,
  CreditCard,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EGG_SIZE_LABELS, PACKAGING_LABELS, DEFAULT_CURRENCY_SYMBOL, CUSTOMER_PAYMENT_STATUS_LABELS } from "@/lib/constants";
import type { CustomerOrderStatus, CustomerPaymentSubmission } from "@/types";
import type { CustomerOrderView } from "@/actions/customer-orders";
import { cancelMyOrder } from "@/actions/customer-orders";
import { getPaymentForOrder } from "@/actions/customer-payments";
import { CustomerPaymentForm } from "@/components/customer/customer-payment-form";

interface CustomerOrdersListProps {
  orders: CustomerOrderView[];
}

function formatCurrency(amount: number): string {
  return `${DEFAULT_CURRENCY_SYMBOL}${amount.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function OrderStatusBadge({ status }: { status: CustomerOrderStatus }) {
  const config: Record<
    CustomerOrderStatus,
    { label: string; className: string; icon: React.ReactNode }
  > = {
    PENDING: {
      label: "Pending Review",
      className: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
      icon: <Clock className="size-3" />,
    },
    CONFIRMED: {
      label: "Confirmed",
      className: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
      icon: <CheckCircle2 className="size-3" />,
    },
    PREPARING: {
      label: "Preparing",
      className:
        "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20",
      icon: <PackageCheck className="size-3" />,
    },
    READY: {
      label: "Ready",
      className:
        "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
      icon: <Truck className="size-3" />,
    },
    COMPLETED: {
      label: "Completed",
      className:
        "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/25",
      icon: <CheckCircle2 className="size-3" />,
    },
    CANCELLED: {
      label: "Cancelled",
      className: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20",
      icon: <XCircle className="size-3" />,
    },
  };

  const cfg = config[status] ?? config["PENDING"];

  return (
    <Badge className={`${cfg.className} text-[10px] flex items-center gap-1 w-fit`}>
      {cfg.icon}
      {cfg.label}
    </Badge>
  );
}

function OrderItemsExpandable({ order }: { order: CustomerOrderView }) {
  const [expanded, setExpanded] = React.useState(false);

  if (order.items.length === 0) {
    return <span className="text-xs text-muted-foreground italic">No items</span>;
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex items-center gap-1 text-xs text-primary hover:underline underline-offset-2"
      >
        {order.items.length} item{order.items.length !== 1 ? "s" : ""}
        {expanded ? (
          <ChevronUp className="size-3" />
        ) : (
          <ChevronDown className="size-3" />
        )}
      </button>

      {expanded && (
        <div className="mt-2 rounded-md border border-border/60 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/20 text-[10px]">
                <TableHead className="py-1.5">Size</TableHead>
                <TableHead className="py-1.5 text-center">Pkg</TableHead>
                <TableHead className="py-1.5 text-center">Qty</TableHead>
                <TableHead className="py-1.5 text-center">Pieces</TableHead>
                <TableHead className="py-1.5 text-right">Est. Price</TableHead>
                <TableHead className="py-1.5 text-right">Est. Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items.map((item) => (
                <TableRow key={item.id} className="text-[10px]">
                  <TableCell className="py-1.5 font-medium text-foreground">
                    {EGG_SIZE_LABELS[item.size]}
                  </TableCell>
                  <TableCell className="py-1.5 text-center">
                    <Badge variant="secondary" className="text-[9px]">
                      {PACKAGING_LABELS[item.packaging]}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-1.5 text-center tabular-nums">
                    {item.package_quantity}
                  </TableCell>
                  <TableCell className="py-1.5 text-center tabular-nums text-muted-foreground">
                    {item.requested_pieces.toLocaleString()}
                  </TableCell>
                  <TableCell className="py-1.5 text-right tabular-nums text-muted-foreground">
                    {formatCurrency(item.quoted_unit_price)}
                  </TableCell>
                  <TableCell className="py-1.5 text-right tabular-nums font-semibold text-foreground">
                    {formatCurrency(item.estimated_line_total)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function CancelOrderButton({
  orderId,
  orderStatus,
}: {
  orderId: string;
  orderStatus: CustomerOrderStatus;
}) {
  const [isPending, startTransition] = useTransition();
  const [confirmed, setConfirmed] = React.useState(false);

  if (orderStatus !== "PENDING") return null;

  if (!confirmed) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 text-[10px] text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => setConfirmed(true)}
      >
        Cancel Order
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-muted-foreground">Confirm cancel?</span>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        className="h-7 text-[10px]"
        disabled={isPending}
        onClick={() => {
          startTransition(async () => {
            const result = await cancelMyOrder({ order_id: orderId });
            if (result.success) {
              toast.success("Order cancelled.");
            } else {
              toast.error("Could not cancel order.", { description: result.error });
              setConfirmed(false);
            }
          });
        }}
      >
        {isPending ? <Loader2 className="size-3 animate-spin" /> : "Yes, Cancel"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 text-[10px]"
        onClick={() => setConfirmed(false)}
        disabled={isPending}
      >
        No
      </Button>
    </div>
  );
}

// ─── Payment Status inline badge ─────────────────────────────────────────────

function PaymentStatusInlineBadge({
  submission,
}: {
  submission: CustomerPaymentSubmission | null;
}) {
  if (!submission) return null;
  const cfg: Record<string, string> = {
    PENDING_SUBMISSION: "bg-muted/60 text-muted-foreground border-border/60",
    SUBMITTED: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
    VERIFIED: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
    REJECTED: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20",
    REFUNDED: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  };
  return (
    <Badge
      className={`${
        cfg[submission.status] ?? cfg["PENDING_SUBMISSION"]
      } text-[9px] w-fit`}
    >
      {CUSTOMER_PAYMENT_STATUS_LABELS[submission.status] ?? submission.status}
    </Badge>
  );
}

// ─── Pay Now expandable panel per order ──────────────────────────────────────

function PayNowPanel({
  order,
}: {
  order: CustomerOrderView;
}) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [payment, setPayment] = React.useState<CustomerPaymentSubmission | null | undefined>(
    undefined
  );

  const allowedPayStatuses: CustomerOrderStatus[] = ["CONFIRMED", "PREPARING", "READY"];
  const canPay = allowedPayStatuses.includes(order.status);
  if (!canPay) return null;

  const handleOpen = async () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (payment === undefined) {
      setLoading(true);
      try {
        const result = await getPaymentForOrder(order.id);
        setPayment(result.success ? result.data ?? null : null);
      } catch {
        setPayment(null);
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={handleOpen}
        className="flex items-center gap-1 text-[10px] text-primary hover:underline underline-offset-2"
        id={`pay-now-toggle-${order.id}`}
      >
        <CreditCard className="size-3" />
        {open ? "Hide Payment" : "Pay / View Payment"}
        {open ? <ChevronUp className="size-3" /> : <ChevronRight className="size-3" />}
      </button>

      {open && (
        <div className="mt-2">
          {loading ? (
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground py-2">
              <Loader2 className="size-3 animate-spin" />
              Loading payment info…
            </div>
          ) : (
            <CustomerPaymentForm
              orderId={order.id}
              orderStatus={order.status}
              estimatedTotal={order.estimated_total}
              existingSubmission={payment ?? null}
            />
          )}
        </div>
      )}
    </div>
  );
}

export function CustomerOrdersList({ orders }: CustomerOrdersListProps) {
  const activeOrders = orders.filter(
    (o) => o.status !== "CANCELLED" && o.status !== "COMPLETED"
  );
  const historicalOrders = orders.filter(
    (o) => o.status === "CANCELLED" || o.status === "COMPLETED"
  );

  if (orders.length === 0) {
    return (
      <div className="py-16 text-center space-y-3">
        <div className="size-14 rounded-full bg-muted/60 text-muted-foreground flex items-center justify-center mx-auto">
          <ShoppingBag className="size-7" />
        </div>
        <p className="text-sm font-semibold text-foreground">No orders yet</p>
        <p className="text-xs text-muted-foreground max-w-xs mx-auto">
          You have not placed any orders yet. Browse the product catalog to get
          started.
        </p>
      </div>
    );
  }

  const renderOrderTable = (orderList: CustomerOrderView[]) => (
    <div className="rounded-lg border border-border/60 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 text-xs">
            <TableHead>Order Date</TableHead>
            <TableHead>Items</TableHead>
            <TableHead className="text-right">Est. Total</TableHead>
            <TableHead>Requested Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Payment</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {orderList.map((order) => (
            <TableRow key={order.id} className="text-xs align-top">
              <TableCell className="font-medium text-foreground whitespace-nowrap">
                {formatDate(order.created_at)}
              </TableCell>
              <TableCell>
                <OrderItemsExpandable order={order} />
                {order.notes && (
                  <p className="text-[10px] text-muted-foreground mt-1 italic max-w-xs truncate">
                    Note: {order.notes}
                  </p>
                )}
                <PayNowPanel order={order} />
              </TableCell>
              <TableCell className="text-right tabular-nums font-bold text-foreground whitespace-nowrap">
                {formatCurrency(order.estimated_total)}
                <p className="text-[10px] text-muted-foreground font-normal">
                  (estimate)
                </p>
              </TableCell>
              <TableCell className="text-muted-foreground whitespace-nowrap">
                {order.requested_date ? formatDate(order.requested_date) : "—"}
              </TableCell>
              <TableCell>
                <div className="space-y-1.5">
                  <OrderStatusBadge status={order.status} />
                  {order.status === "COMPLETED" && order.sale_id && (
                    <p className="text-[10px] text-emerald-600 dark:text-emerald-400">
                      Invoice issued ✓
                    </p>
                  )}
                </div>
              </TableCell>
              <TableCell>
                {/* Payment column: shown lazily when Pay Now is expanded. */}
                {["PENDING", "CANCELLED", "COMPLETED"].includes(order.status) && (
                  <span className="text-[10px] text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                <CancelOrderButton orderId={order.id} orderStatus={order.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Pending / Active Orders */}
      {activeOrders.length > 0 && (
        <Card className="border-border/60 shadow-xs">
          <CardHeader className="pb-3 border-b border-border/60">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Clock className="size-4 text-amber-500" />
              Active Orders ({activeOrders.length})
            </CardTitle>
            <CardDescription className="text-xs">
              Orders awaiting confirmation or currently being prepared by the farm.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">{renderOrderTable(activeOrders)}</CardContent>
        </Card>
      )}

      {/* Alert about cancellation limitations */}
      {activeOrders.some((o) => o.status !== "PENDING") && (
        <Alert className="border-blue-500/20 bg-blue-500/5">
          <AlertCircle className="size-4 text-blue-600 dark:text-blue-400" />
          <AlertDescription className="text-xs text-blue-700 dark:text-blue-300">
            Orders that have been confirmed or are in preparation cannot be cancelled
            online. Please contact the farm directly to request changes.
          </AlertDescription>
        </Alert>
      )}

      {/* Historical Orders */}
      {historicalOrders.length > 0 && (
        <Card className="border-border/60 shadow-xs">
          <CardHeader className="pb-3 border-b border-border/60">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <ShoppingBag className="size-4 text-muted-foreground" />
              Order History ({historicalOrders.length})
            </CardTitle>
            <CardDescription className="text-xs">
              Completed and cancelled orders.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {renderOrderTable(historicalOrders)}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
