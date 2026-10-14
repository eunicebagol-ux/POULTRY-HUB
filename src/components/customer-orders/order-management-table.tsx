"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import {
  Clock,
  CheckCircle2,
  Package,
  Truck,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  FileEdit,
  ArrowRight,
  User,
  ShoppingBag,
  CreditCard,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  EGG_SIZE_LABELS,
  PACKAGING_LABELS,
  DEFAULT_CURRENCY_SYMBOL,
  ALLOWED_STATUS_TRANSITIONS,
} from "@/lib/constants";
import type { CustomerOrderStatus, CustomerPaymentSubmission } from "@/types";
import type { CustomerOrderItemView } from "@/actions/customer-orders";
import { updateOrderStatus } from "@/actions/customer-orders";
import { PaymentVerificationPanel } from "@/components/customer-orders/payment-verification-panel";
import { getPaymentForOrder } from "@/actions/customer-payments";

export interface OrderRowData {
  id: string;
  status: CustomerOrderStatus;
  requested_date: string | null;
  sale_id: string | null;
  notes: string | null;
  admin_notes?: string | null;
  cancellation_reason?: string | null;
  created_at: string;
  updated_at: string;
  items: CustomerOrderItemView[];
  estimated_total: number;
  customer_name: string;
}

interface OrderManagementTableProps {
  initialOrders: OrderRowData[];
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

const STATUS_CONFIG: Record<
  CustomerOrderStatus,
  { label: string; className: string; icon: React.ReactNode }
> = {
  PENDING: {
    label: "Pending Review",
    className: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
    icon: <Clock className="size-3 mr-1" />,
  },
  CONFIRMED: {
    label: "Confirmed",
    className: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
    icon: <CheckCircle2 className="size-3 mr-1" />,
  },
  PREPARING: {
    label: "Preparing",
    className: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20",
    icon: <Package className="size-3 mr-1" />,
  },
  READY: {
    label: "Ready for Pickup",
    className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
    icon: <Truck className="size-3 mr-1" />,
  },
  COMPLETED: {
    label: "Completed",
    className: "bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20",
    icon: <CheckCircle2 className="size-3 mr-1" />,
  },
  CANCELLED: {
    label: "Cancelled",
    className: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20",
    icon: <XCircle className="size-3 mr-1" />,
  },
};

const ALL_STATUSES: CustomerOrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "COMPLETED",
  "CANCELLED",
];

function OrderPaymentSection({
  orderId,
  estimatedTotal,
}: {
  orderId: string;
  estimatedTotal?: number;
}) {
  const [loading, setLoading] = useState(true);
  const [submission, setSubmission] = useState<CustomerPaymentSubmission | null>(null);

  const loadPayment = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPaymentForOrder(orderId);
      if (res.success) {
        setSubmission(res.data ?? null);
      } else {
        setSubmission(null);
      }
    } catch {
      setSubmission(null);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  React.useEffect(() => {
    loadPayment();
  }, [loadPayment]);

  return (
    <div className="rounded-md border p-3 bg-muted/10 space-y-3 mt-3">
      <div className="flex items-center justify-between border-b pb-2">
        <div className="flex items-center gap-2">
          <CreditCard className="size-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">
            Customer Payment Proof & Verification
          </span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 text-[11px] text-muted-foreground hover:text-foreground"
          onClick={loadPayment}
          disabled={loading}
        >
          {loading ? <Loader2 className="size-3 animate-spin mr-1" /> : null}
          Refresh Payment
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
          <Loader2 className="size-3.5 animate-spin" />
          <span>Checking payment submission...</span>
        </div>
      ) : !submission ? (
        <div className="text-xs text-muted-foreground py-1 flex items-center gap-2">
          <AlertCircle className="size-3.5 text-muted-foreground/70" />
          <span>No customer payment has been submitted for this order yet.</span>
        </div>
      ) : (
        <PaymentVerificationPanel
          submission={submission}
          estimatedTotal={estimatedTotal}
          onSuccess={loadPayment}
        />
      )}
    </div>
  );
}

export function OrderManagementTable({ initialOrders }: OrderManagementTableProps) {
  const [orders, setOrders] = useState<OrderRowData[]>(initialOrders);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});

  // Dialog state
  const [selectedOrder, setSelectedOrder] = useState<OrderRowData | null>(null);
  const [newStatus, setNewStatus] = useState<CustomerOrderStatus>("PENDING");
  const [adminNotes, setAdminNotes] = useState<string>("");
  const [cancellationReason, setCancellationReason] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const toggleExpand = (id: string) => {
    setExpandedOrders((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const openStatusDialog = (order: OrderRowData) => {
    setSelectedOrder(order);
    setNewStatus(order.status);
    setAdminNotes(order.admin_notes || "");
    setCancellationReason(order.cancellation_reason || "");
    setErrorMsg(null);
  };

  const handleUpdateStatus = () => {
    if (!selectedOrder) return;
    setErrorMsg(null);

    if (newStatus === "CANCELLED" && !cancellationReason.trim()) {
      setErrorMsg("A cancellation reason is required when marking an order as CANCELLED.");
      return;
    }

    startTransition(async () => {
      const res = await updateOrderStatus({
        order_id: selectedOrder.id,
        status: newStatus,
        admin_notes: adminNotes.trim() || undefined,
        cancellation_reason:
          newStatus === "CANCELLED" ? cancellationReason.trim() : undefined,
      });

      if (!res.success) {
        setErrorMsg(res.error || "Failed to update order status.");
        toast.error(res.error || "Failed to update order status.");
        return;
      }

      toast.success(`Order ${selectedOrder.id.slice(0, 8)} updated to ${newStatus}.`);

      // Update local state
      setOrders((prev) =>
        prev.map((o) =>
          o.id === selectedOrder.id
            ? {
                ...o,
                status: newStatus,
                admin_notes: adminNotes.trim() || null,
                cancellation_reason:
                  newStatus === "CANCELLED" ? cancellationReason.trim() : o.cancellation_reason,
                updated_at: new Date().toISOString(),
              }
            : o
        )
      );

      setSelectedOrder(null);
    });
  };

  // Filtered orders
  const filteredOrders = orders.filter((order) => {
    const matchesStatus =
      statusFilter === "ALL" ? true : order.status === statusFilter;
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      query === "" ||
      order.customer_name.toLowerCase().includes(query) ||
      order.id.toLowerCase().includes(query) ||
      (order.notes && order.notes.toLowerCase().includes(query));
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-4">
      {/* ── Filters & Search Bar ──────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={statusFilter === "ALL" ? "default" : "outline"}
            className="text-xs h-8"
            onClick={() => setStatusFilter("ALL")}
          >
            All ({orders.length})
          </Button>
          {ALL_STATUSES.map((st) => {
            const count = orders.filter((o) => o.status === st).length;
            if (count === 0 && statusFilter !== st) return null;
            return (
              <Button
                key={st}
                size="sm"
                variant={statusFilter === st ? "default" : "outline"}
                className="text-xs h-8"
                onClick={() => setStatusFilter(st)}
              >
                {STATUS_CONFIG[st].label} ({count})
              </Button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search customer or order ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 text-xs h-8"
          />
        </div>
      </div>

      {/* ── Orders Table ──────────────────────────────────────────── */}
      <Card className="border-border/60 shadow-xs">
        <CardContent className="p-0">
          {filteredOrders.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <ShoppingBag className="size-8 mx-auto text-muted-foreground/60" />
              <p className="text-sm font-semibold text-foreground">No customer orders found</p>
              <p className="text-xs text-muted-foreground">
                {orders.length === 0
                  ? "When customers submit egg orders through the portal, they will appear here."
                  : "No orders match the selected filters."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs bg-muted/30">
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Requested Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Est. Total</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.map((order) => {
                    const isExpanded = Boolean(expandedOrders[order.id]);
                    const cfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.PENDING;

                    return (
                      <React.Fragment key={order.id}>
                        <TableRow className="text-xs hover:bg-muted/40 transition-colors">
                          <TableCell className="w-8 p-2 text-center">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-6 text-muted-foreground"
                              onClick={() => toggleExpand(order.id)}
                              aria-label={isExpanded ? "Collapse details" : "Expand details"}
                            >
                              {isExpanded ? (
                                <ChevronUp className="size-3.5" />
                              ) : (
                                <ChevronDown className="size-3.5" />
                              )}
                            </Button>
                          </TableCell>
                          <TableCell className="font-mono font-medium text-foreground whitespace-nowrap">
                            #{order.id.slice(0, 8)}
                          </TableCell>
                          <TableCell className="font-medium text-foreground whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <User className="size-3 text-muted-foreground" />
                              <span>{order.customer_name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground whitespace-nowrap">
                            {formatDate(order.created_at)}
                          </TableCell>
                          <TableCell className="text-muted-foreground whitespace-nowrap">
                            {order.requested_date ? formatDate(order.requested_date) : "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-[10px] ${cfg.className}`}>
                              {cfg.icon}
                              {cfg.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums text-foreground">
                            {formatCurrency(order.estimated_total)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-xs h-7 px-2 gap-1 text-muted-foreground hover:text-foreground"
                                onClick={() => toggleExpand(order.id)}
                                title="View itemized details and payment verification"
                              >
                                <CreditCard className="size-3" />
                                Payment
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-xs h-7 px-2.5 gap-1"
                                onClick={() => openStatusDialog(order)}
                              >
                                <FileEdit className="size-3" />
                                Update
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>

                        {/* Expandable item details row */}
                        {isExpanded && (
                          <TableRow className="bg-muted/20 border-b">
                            <TableCell colSpan={8} className="p-4 space-y-3">
                              <div className="bg-background rounded-lg border p-3 space-y-3">
                                <div className="flex items-center justify-between border-b pb-2">
                                  <span className="text-xs font-semibold text-foreground">
                                    Itemized Order Details ({order.items.length} item{order.items.length > 1 ? "s" : ""})
                                  </span>
                                  <span className="text-xs text-muted-foreground font-mono">
                                    Full ID: {order.id}
                                  </span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                  {order.items.map((item) => (
                                    <div
                                      key={item.id}
                                      className="rounded-md border bg-muted/30 p-2.5 text-xs space-y-1"
                                    >
                                      <div className="flex items-center justify-between font-semibold">
                                        <span>{EGG_SIZE_LABELS[item.size]} Egg</span>
                                        <span className="text-emerald-600 dark:text-emerald-400">
                                          {formatCurrency(item.estimated_line_total)}
                                        </span>
                                      </div>
                                      <p className="text-[11px] text-muted-foreground">
                                        {item.package_quantity} &times; {PACKAGING_LABELS[item.packaging]}
                                        {" "}({item.requested_pieces.toLocaleString()} pcs)
                                      </p>
                                      <p className="text-[10px] text-muted-foreground">
                                        @ {formatCurrency(item.quoted_unit_price)} per package
                                      </p>
                                    </div>
                                  ))}
                                </div>

                                {order.notes && (
                                  <div className="rounded-md bg-amber-500/10 border border-amber-500/20 p-2 text-xs">
                                    <span className="font-semibold text-amber-800 dark:text-amber-300">
                                      Customer Notes:{" "}
                                    </span>
                                    <span className="text-muted-foreground">{order.notes}</span>
                                  </div>
                                )}

                                {order.admin_notes && (
                                  <div className="rounded-md bg-blue-500/10 border border-blue-500/20 p-2 text-xs">
                                    <span className="font-semibold text-blue-800 dark:text-blue-300">
                                      Internal Staff Notes:{" "}
                                    </span>
                                    <span className="text-muted-foreground">{order.admin_notes}</span>
                                  </div>
                                )}

                                {order.cancellation_reason && (
                                  <div className="rounded-md bg-rose-500/10 border border-rose-500/20 p-2 text-xs">
                                    <span className="font-semibold text-rose-800 dark:text-rose-300">
                                      Cancellation Reason:{" "}
                                    </span>
                                    <span className="text-muted-foreground">
                                      {order.cancellation_reason}
                                    </span>
                                  </div>
                                )}

                                {/* Customer Payment Verification Section */}
                                <OrderPaymentSection
                                  orderId={order.id}
                                  estimatedTotal={order.estimated_total}
                                />
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Status Update Dialog ──────────────────────────────────── */}
      {selectedOrder && (
        <Dialog open={true} onOpenChange={(open) => !open && setSelectedOrder(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-bold">
                Update Order #{selectedOrder.id.slice(0, 8)}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Transition order workflow status for {selectedOrder.customer_name}.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              {errorMsg && (
                <Alert className="border-destructive/30 bg-destructive/5 p-3">
                  <AlertCircle className="size-4 text-destructive" />
                  <AlertDescription className="text-xs text-destructive">
                    {errorMsg}
                  </AlertDescription>
                </Alert>
              )}

              {/* Status Select */}
              <div className="space-y-1.5">
                <label className="font-medium text-foreground">Next Status</label>
                {ALLOWED_STATUS_TRANSITIONS[selectedOrder.status]?.length === 0 ? (
                  <div className="text-xs text-muted-foreground p-2 rounded-md bg-muted/40 border">
                    Order is in a terminal status (<strong>{selectedOrder.status}</strong>) and cannot be transitioned further.
                  </div>
                ) : (
                  <Select
                    value={newStatus}
                    onValueChange={(val) => setNewStatus(val as CustomerOrderStatus)}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from(
                        new Set([
                          selectedOrder.status,
                          ...(ALLOWED_STATUS_TRANSITIONS[selectedOrder.status] ?? []),
                        ])
                      ).map((st) => (
                        <SelectItem key={st} value={st} className="text-xs">
                          {STATUS_CONFIG[st].label} {st === selectedOrder.status ? "(Current)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Cancellation Reason (Conditional) */}
              {newStatus === "CANCELLED" && (
                <div className="space-y-1.5">
                  <label className="font-medium text-destructive">
                    Cancellation Reason <span className="text-destructive">*</span>
                  </label>
                  <Textarea
                    placeholder="Provide a mandatory reason for cancelling this order..."
                    value={cancellationReason}
                    onChange={(e) => setCancellationReason(e.target.value)}
                    className="text-xs min-h-20"
                    required
                  />
                </div>
              )}

              {/* Internal Admin Notes */}
              <div className="space-y-1.5">
                <label className="font-medium text-foreground">
                  Internal Staff Notes (Optional)
                </label>
                <Textarea
                  placeholder="Notes visible only to farm staff and administrators..."
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  className="text-xs min-h-16"
                />
              </div>

              <div className="rounded-lg bg-muted/40 p-2.5 text-[11px] text-muted-foreground space-y-1">
                <p className="font-semibold text-foreground">Fulfillment Workflow Note:</p>
                <p>
                  To complete and bill this order, record the final sale in{" "}
                  <strong className="text-foreground">Egg Sales</strong>. Order submission does not
                  deduct egg inventory; inventory is decremented when the official invoice is
                  created.
                </p>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => setSelectedOrder(null)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="text-xs bg-emerald-600 hover:bg-emerald-700"
                onClick={handleUpdateStatus}
                disabled={isPending}
              >
                {isPending ? "Updating..." : "Save Status"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
