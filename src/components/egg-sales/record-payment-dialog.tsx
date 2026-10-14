"use client";

import * as React from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { CreditCard, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DEFAULT_CURRENCY_SYMBOL,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
} from "@/lib/constants";
import {
  recordPaymentSchema,
  type RecordPaymentInput,
} from "@/lib/validations/payments";
import { recordPayment } from "@/actions/payments";
import type { EggSaleView } from "@/actions/egg-sales";
import type { PaymentMethod } from "@/types";

interface RecordPaymentDialogProps {
  sale: EggSaleView;
  totalPaid: number;
  remainingBalance: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface FormState {
  amount: string;
  payment_method: PaymentMethod;
  payment_date: string;
  reference_number: string;
  notes: string;
}

interface FormErrors {
  amount?: string;
  payment_method?: string;
  payment_date?: string;
  reference_number?: string;
  notes?: string;
  root?: string;
}

const defaultForm = (): FormState => ({
  amount: "",
  payment_method: "CASH",
  payment_date: format(new Date(), "yyyy-MM-dd"),
  reference_number: "",
  notes: "",
});

export function RecordPaymentDialog({
  sale,
  totalPaid,
  remainingBalance,
  open,
  onOpenChange,
  onSuccess,
}: RecordPaymentDialogProps) {
  const [form, setForm] = React.useState<FormState>(defaultForm);
  const [errors, setErrors] = React.useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Reset form when dialog opens/closes
  React.useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setForm(defaultForm());
        setErrors({});
      }, 0);
    }
  }, [open]);

  const amountNum = parseFloat(form.amount);
  const validAmount = !isNaN(amountNum) && amountNum > 0;
  const wouldOverpay = validAmount && amountNum > remainingBalance;
  const previewBalance = validAmount && !wouldOverpay
    ? Math.max(0, remainingBalance - amountNum)
    : remainingBalance;

  const fmt = (n: number) =>
    `${DEFAULT_CURRENCY_SYMBOL}${n.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  const handleChange = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Build input for Zod validation
    const input: RecordPaymentInput = {
      sale_id: sale.id,
      amount: parseFloat(form.amount),
      payment_method: form.payment_method,
      payment_date: form.payment_date,
      reference_number: form.reference_number || undefined,
      notes: form.notes || undefined,
    };

    const parsed = recordPaymentSchema.safeParse(input);
    if (!parsed.success) {
      const fieldErrors: FormErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof FormErrors;
        if (field && !fieldErrors[field]) {
          fieldErrors[field] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }

    if (wouldOverpay) {
      setErrors({
        amount: `Amount exceeds remaining balance (${fmt(remainingBalance)}). Overpayment is not allowed.`,
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await recordPayment(parsed.data);
      if (!result.success) {
        setErrors({ root: result.error });
        return;
      }
      toast.success("Payment recorded successfully.");
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      setErrors({
        root: err instanceof Error ? err.message : "Failed to record payment.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <CreditCard className="size-4 text-teal-600" />
            Record Payment
          </DialogTitle>
          <DialogDescription className="text-xs">
            {sale.invoice_number && (
              <span className="font-mono">Invoice: {sale.invoice_number} · </span>
            )}
            {sale.customer?.name ?? "Direct Buyer"}
          </DialogDescription>
        </DialogHeader>

        {/* Payment Summary Banner */}
        <div className="rounded-lg bg-muted/40 border border-border/50 p-3 space-y-1 text-xs">
          <div className="flex justify-between text-muted-foreground">
            <span>Sale Total:</span>
            <span className="font-semibold text-foreground tabular-nums">
              {fmt(sale.total_amount)}
            </span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Total Paid:</span>
            <span className="font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums">
              {fmt(totalPaid)}
            </span>
          </div>
          <div className="flex justify-between border-t pt-1.5 font-semibold">
            <span className="text-muted-foreground">Remaining:</span>
            <span className="text-amber-700 dark:text-amber-400 tabular-nums">
              {fmt(remainingBalance)}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Root Error */}
          {errors.root && (
            <div className="rounded-md bg-destructive/15 p-3 text-destructive text-xs font-medium flex items-start gap-2 border border-destructive/20">
              <AlertTriangle className="size-4 mt-0.5 shrink-0" />
              <div>{errors.root}</div>
            </div>
          )}

          {/* Amount */}
          <div className="space-y-1.5">
            <Label htmlFor="payment-amount" className="text-xs font-medium">
              Payment Amount <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-xs text-muted-foreground font-semibold pointer-events-none">
                ₱
              </span>
              <Input
                id="payment-amount"
                type="number"
                step="0.01"
                min="0.01"
                max={remainingBalance}
                placeholder="0.00"
                className="pl-7 text-xs"
                value={form.amount}
                onChange={(e) => handleChange("amount", e.target.value)}
              />
            </div>
            {errors.amount ? (
              <p className="text-[11px] text-destructive">{errors.amount}</p>
            ) : wouldOverpay ? (
              <p className="text-[11px] text-destructive flex items-center gap-1">
                <AlertTriangle className="size-3" />
                Amount exceeds remaining balance. Overpayment is not allowed.
              </p>
            ) : validAmount && amountNum <= remainingBalance ? (
              <p className="text-[11px] text-muted-foreground">
                Remaining after payment:{" "}
                <span className="font-semibold text-foreground tabular-nums">
                  {fmt(previewBalance)}
                </span>{" "}
                (preview — server is authoritative)
              </p>
            ) : null}
          </div>

          {/* Payment Method */}
          <div className="space-y-1.5">
            <Label htmlFor="payment-method-trigger" className="text-xs font-medium">
              Payment Method <span className="text-destructive">*</span>
            </Label>
            <Select
              value={form.payment_method}
              onValueChange={(v) => handleChange("payment_method", v as string)}
            >
              <SelectTrigger id="payment-method-trigger" className="text-xs">
                <SelectValue placeholder="Select method" />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((method) => (
                  <SelectItem key={method} value={method} className="text-xs">
                    {PAYMENT_METHOD_LABELS[method]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.payment_method && (
              <p className="text-[11px] text-destructive">
                {errors.payment_method}
              </p>
            )}
          </div>

          {/* Payment Date */}
          <div className="space-y-1.5">
            <Label htmlFor="payment-date" className="text-xs font-medium">
              Payment Date <span className="text-destructive">*</span>
            </Label>
            <Input
              id="payment-date"
              type="date"
              className="text-xs"
              value={form.payment_date}
              onChange={(e) => handleChange("payment_date", e.target.value)}
            />
            {errors.payment_date && (
              <p className="text-[11px] text-destructive">
                {errors.payment_date}
              </p>
            )}
          </div>

          {/* Reference Number */}
          <div className="space-y-1.5">
            <Label htmlFor="payment-reference" className="text-xs font-medium">
              Reference Number{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="payment-reference"
              type="text"
              placeholder="e.g. GCash ref, cheque no., bank ref…"
              className="text-xs"
              value={form.reference_number}
              onChange={(e) => handleChange("reference_number", e.target.value)}
            />
            {errors.reference_number && (
              <p className="text-[11px] text-destructive">
                {errors.reference_number}
              </p>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="payment-notes" className="text-xs font-medium">
              Notes{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              id="payment-notes"
              placeholder="Additional payment notes…"
              className="text-xs resize-none h-16"
              value={form.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
            />
            {errors.notes && (
              <p className="text-[11px] text-destructive">{errors.notes}</p>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting || wouldOverpay || !form.amount}
              className="text-xs bg-teal-600 hover:bg-teal-700 text-white"
            >
              {isSubmitting ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              ) : (
                <CreditCard className="mr-1.5 size-3.5" />
              )}
              Record Payment
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
