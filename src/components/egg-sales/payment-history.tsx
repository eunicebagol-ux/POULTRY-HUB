"use client";

import * as React from "react";
import { Banknote, Loader2, ReceiptText } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DEFAULT_CURRENCY_SYMBOL,
  PAYMENT_METHOD_LABELS,
} from "@/lib/constants";
import { getPaymentsForSale } from "@/actions/payments";
import type { PaymentRecordView } from "@/types";

interface PaymentHistoryProps {
  saleId: string;
  totalAmount: number;
  refreshToken?: number; // increment to force refresh after a payment
}

export function PaymentHistory({
  saleId,
  totalAmount,
  refreshToken = 0,
}: PaymentHistoryProps) {
  const [payments, setPayments] = React.useState<PaymentRecordView[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    
    const load = async () => {
      setIsLoading(true);
      setError(null);
      const result = await getPaymentsForSale(saleId);
      if (cancelled) return;
      if (result.success) {
        setPayments(result.data ?? []);
      } else {
        setError(result.error);
      }
      setIsLoading(false);
    };
    
    load();

    return () => {
      cancelled = true;
    };
  }, [saleId, refreshToken]);

  const fmt = (n: number) =>
    `${DEFAULT_CURRENCY_SYMBOL}${n.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const balance = totalAmount - totalPaid;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        Loading payment history…
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-xs text-destructive py-2">
        Failed to load payments: {error}
      </p>
    );
  }

  if (payments.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <div className="flex size-9 items-center justify-center rounded-xl bg-muted text-muted-foreground/50">
          <ReceiptText className="size-4" />
        </div>
        <p className="text-xs text-muted-foreground">
          No payments have been recorded for this sale yet.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border/60 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Date</TableHead>
              <TableHead className="text-xs">Method</TableHead>
              <TableHead className="text-right text-xs">Amount</TableHead>
              <TableHead className="text-xs">Reference</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((payment) => (
              <TableRow key={payment.id}>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(payment.payment_date).toLocaleDateString("en-PH", {
                    dateStyle: "medium",
                  })}
                </TableCell>
                <TableCell className="text-xs font-medium text-foreground">
                  {PAYMENT_METHOD_LABELS[payment.payment_method] ??
                    payment.payment_method}
                </TableCell>
                <TableCell className="text-right text-xs font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
                  {fmt(payment.amount)}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground font-mono">
                  {payment.reference_number ?? (
                    <span className="italic text-muted-foreground/50">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Payment Totals */}
      <div className="rounded-lg bg-muted/30 border border-border/40 p-3 space-y-1.5 text-xs">
        <div className="flex justify-between text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Banknote className="size-3.5" />
            Total Paid:
          </span>
          <span className="font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
            {fmt(totalPaid)}
          </span>
        </div>
        <div className="flex justify-between border-t pt-1.5 font-bold text-sm">
          <span className="text-muted-foreground">Balance:</span>
          <span
            className={
              balance <= 0
                ? "text-teal-600 dark:text-teal-400 tabular-nums"
                : "text-amber-700 dark:text-amber-400 tabular-nums"
            }
          >
            {fmt(Math.max(0, balance))}
          </span>
        </div>
      </div>
    </div>
  );
}
