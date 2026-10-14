"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import {
  ShoppingCart,
  Trash2,
  CalendarDays,
  MessageSquare,
  AlertCircle,
  Loader2,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  EGG_SIZE_LABELS,
  PACKAGING_LABELS,
  PACKAGING_MULTIPLIERS,
  DEFAULT_CURRENCY_SYMBOL,
} from "@/lib/constants";
import type { EggSize, PackagingType } from "@/types";
import { submitCustomerOrder } from "@/actions/customer-orders";

interface CartItem {
  size: EggSize;
  packaging: PackagingType;
  package_quantity: number;
  quoted_unit_price: number;
}

interface CustomerOrderFormProps {
  cart: CartItem[];
  onClearCart: () => void;
  onRemoveItem: (size: EggSize, packaging: PackagingType) => void;
}

function formatCurrency(amount: number): string {
  return `${DEFAULT_CURRENCY_SYMBOL}${amount.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function CustomerOrderForm({
  cart,
  onClearCart,
  onRemoveItem,
}: CustomerOrderFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [requestedDate, setRequestedDate] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [formError, setFormError] = React.useState<string | null>(null);
  const [submitted, setSubmitted] = React.useState(false);

  const estimatedTotal = cart.reduce(
    (sum, item) => sum + item.package_quantity * item.quoted_unit_price,
    0
  );

  const totalPieces = cart.reduce(
    (sum, item) =>
      sum + item.package_quantity * PACKAGING_MULTIPLIERS[item.packaging],
    0
  );

  if (submitted) {
    return (
      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardContent className="py-12 text-center space-y-4">
          <div className="size-14 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
            <Check className="size-7" />
          </div>
          <h2 className="text-lg font-bold text-foreground">Order Submitted!</h2>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Your order has been received and is pending review by the farm team.
            You will be notified when your order is confirmed.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
            <Button
              size="sm"
              className="text-xs"
              onClick={() => router.push("/customer/orders")}
            >
              View My Orders
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => {
                setSubmitted(false);
                onClearCart();
              }}
            >
              Place Another Order
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (cart.length === 0) {
    return (
      <Card className="border-border/60">
        <CardContent className="py-12 text-center space-y-3">
          <div className="size-12 rounded-full bg-muted/60 text-muted-foreground flex items-center justify-center mx-auto">
            <ShoppingCart className="size-6" />
          </div>
          <p className="text-sm font-semibold text-foreground">Your cart is empty</p>
          <p className="text-xs text-muted-foreground">
            Browse the product catalog and add egg sizes to your cart.
          </p>
        </CardContent>
      </Card>
    );
  }

  const handleSubmit = () => {
    if (cart.length === 0) return;
    setFormError(null);

    startTransition(async () => {
      try {
        const result = await submitCustomerOrder({
          requested_date: requestedDate || undefined,
          notes: notes.trim() || undefined,
          items: cart.map((item) => ({
            size: item.size,
            packaging: item.packaging,
            package_quantity: item.package_quantity,
            quoted_unit_price: item.quoted_unit_price,
          })),
        });

        if (!result.success) {
          setFormError(result.error);
          toast.error("Order could not be submitted.", { description: result.error });
        } else {
          setSubmitted(true);
          toast.success("Order submitted successfully!", {
            description:
              "The farm team will review and confirm your order shortly.",
          });
        }
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "An unexpected error occurred.";
        setFormError(msg);
        toast.error("Order submission failed.", { description: msg });
      }
    });
  };

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3 border-b border-border/60">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <ShoppingCart className="size-4 text-muted-foreground" />
          Order Summary
        </CardTitle>
        <CardDescription className="text-xs">
          Review your selections before submitting. Prices shown are indicative estimates
          from the farm catalog. Final pricing is confirmed by the farm at fulfillment.
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-4 space-y-5">
        {/* Line Items Table */}
        <div className="rounded-lg border border-border/60 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 text-xs">
                <TableHead>Item</TableHead>
                <TableHead className="text-center">Packaging</TableHead>
                <TableHead className="text-center">Qty</TableHead>
                <TableHead className="text-center">Pieces</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {cart.map((item) => {
                const pieces = item.package_quantity * PACKAGING_MULTIPLIERS[item.packaging];
                const lineTotal = item.package_quantity * item.quoted_unit_price;
                return (
                  <TableRow key={`${item.size}:${item.packaging}`} className="text-xs">
                    <TableCell className="font-semibold text-foreground">
                      {EGG_SIZE_LABELS[item.size]}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="text-[10px]">
                        {PACKAGING_LABELS[item.packaging]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center tabular-nums">
                      {item.package_quantity}
                    </TableCell>
                    <TableCell className="text-center tabular-nums text-muted-foreground">
                      {pieces.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatCurrency(item.quoted_unit_price)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold text-foreground">
                      {formatCurrency(lineTotal)}
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 text-muted-foreground hover:text-destructive"
                        onClick={() => onRemoveItem(item.size, item.packaging)}
                        aria-label={`Remove ${EGG_SIZE_LABELS[item.size]} from cart`}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Totals */}
        <div className="flex flex-col items-end gap-1 border-t border-border/60 pt-3">
          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <span>Total Pieces (estimate):</span>
            <span className="tabular-nums font-medium text-foreground">
              {totalPieces.toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm font-bold">
            <span className="text-muted-foreground text-xs">Estimated Total:</span>
            <span className="tabular-nums text-emerald-600 dark:text-emerald-400">
              {formatCurrency(estimatedTotal)}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1 max-w-xs text-right">
            * Estimated total from catalog prices. The farm may adjust pricing at confirmation.
          </p>
        </div>

        {/* Requested Date */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium flex items-center gap-1.5">
            <CalendarDays className="size-3.5 text-muted-foreground" />
            Requested Delivery / Pickup Date{" "}
            <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Input
            id="customer-order-requested-date"
            type="date"
            value={requestedDate}
            onChange={(e) => setRequestedDate(e.target.value)}
            min={new Date().toISOString().split("T")[0]}
            className="h-8 text-xs max-w-48"
          />
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <Label className="text-xs font-medium flex items-center gap-1.5">
            <MessageSquare className="size-3.5 text-muted-foreground" />
            Special Instructions{" "}
            <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Textarea
            id="customer-order-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Delivery address, packing preferences, contact instructions…"
            className="text-xs resize-none h-20"
            maxLength={1000}
          />
          <p className="text-[10px] text-muted-foreground text-right">
            {notes.length}/1000
          </p>
        </div>

        {/* Error Display */}
        {formError && (
          <Alert className="border-destructive/30 bg-destructive/5">
            <AlertCircle className="size-4 text-destructive" />
            <AlertDescription className="text-xs text-destructive/90">
              {formError}
            </AlertDescription>
          </Alert>
        )}

        {/* Actions */}
        <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={onClearCart}
            disabled={isPending}
          >
            Clear Cart
          </Button>
          <Button
            type="button"
            size="sm"
            className="flex-1 text-xs h-9 bg-emerald-600 hover:bg-emerald-700"
            onClick={handleSubmit}
            disabled={isPending || cart.length === 0}
            id="submit-order-btn"
          >
            {isPending ? (
              <>
                <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                Submitting…
              </>
            ) : (
              <>
                <ShoppingCart className="size-3.5 mr-1.5" />
                Submit Order ({cart.length} item{cart.length !== 1 ? "s" : ""})
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
