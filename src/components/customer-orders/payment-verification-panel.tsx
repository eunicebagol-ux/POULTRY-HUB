"use client";

import * as React from "react";
import { useTransition } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Smartphone,
  Building2,
  Truck,
  Store,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Calendar,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  CUSTOMER_PAYMENT_METHOD_LABELS,
  CUSTOMER_PAYMENT_STATUS_LABELS,
  DEFAULT_CURRENCY_SYMBOL,
} from "@/lib/constants";
import type {
  CustomerPaymentMethod,
  CustomerPaymentStatus,
  CustomerPaymentSubmission,
} from "@/types";
import { verifyPaymentSubmission } from "@/actions/customer-payments";

interface PaymentVerificationPanelProps {
  submission: CustomerPaymentSubmission;
  estimatedTotal?: number;
  onSuccess?: () => void;
}

function formatCurrency(amount: number): string {
  return `${DEFAULT_CURRENCY_SYMBOL}${amount.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const METHOD_ICONS: Record<CustomerPaymentMethod, React.ReactNode> = {
  GCASH: <Smartphone className="size-3.5 text-blue-500" />,
  BANK_TRANSFER: <Building2 className="size-3.5 text-indigo-500" />,
  CASH_ON_DELIVERY: <Truck className="size-3.5 text-emerald-500" />,
  CASH_ON_PICKUP: <Store className="size-3.5 text-emerald-500" />,
};

function PaymentStatusBadge({ status }: { status: CustomerPaymentStatus }) {
  const config: Record<
    CustomerPaymentStatus,
    { className: string; icon: React.ReactNode }
  > = {
    PENDING_SUBMISSION: {
      className: "bg-muted/60 text-muted-foreground border-border/60",
      icon: <Clock className="size-3" />,
    },
    SUBMITTED: {
      className:
        "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
      icon: <Clock className="size-3" />,
    },
    VERIFIED: {
      className:
        "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
      icon: <CheckCircle2 className="size-3" />,
    },
    REJECTED: {
      className:
        "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20",
      icon: <XCircle className="size-3" />,
    },
    REFUNDED: {
      className:
        "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
      icon: <CheckCircle2 className="size-3" />,
    },
  };

  const cfg = config[status] ?? config["PENDING_SUBMISSION"];
  return (
    <Badge
      className={`${cfg.className} text-[10px] flex items-center gap-1 w-fit`}
    >
      {cfg.icon}
      {CUSTOMER_PAYMENT_STATUS_LABELS[status]}
    </Badge>
  );
}

export function PaymentVerificationPanel({
  submission,
  estimatedTotal,
  onSuccess,
}: PaymentVerificationPanelProps) {
  const [isPending, startTransition] = useTransition();
  const [dialogAction, setDialogAction] = React.useState<
    "VERIFY" | "REJECT" | null
  >(null);
  const [rejectionReason, setRejectionReason] = React.useState("");
  const [verificationNotes, setVerificationNotes] = React.useState("");
  const [actionError, setActionError] = React.useState<string | null>(null);

  const handleAction = (action: "VERIFY" | "REJECT") => {
    setActionError(null);

    if (action === "REJECT" && !rejectionReason.trim()) {
      setActionError("A rejection reason is required.");
      return;
    }

    startTransition(async () => {
      const result = await verifyPaymentSubmission({
        submission_id: submission.id,
        action,
        verification_notes: verificationNotes.trim() || undefined,
        rejection_reason: rejectionReason.trim() || undefined,
      });

      if (result.success) {
        toast.success(
          action === "VERIFY"
            ? "Payment verified successfully."
            : "Payment submission rejected.",
          {
            description:
              action === "VERIFY"
                ? "The customer's payment has been confirmed."
                : "The customer will be notified to resubmit.",
          }
        );
        setDialogAction(null);
        setRejectionReason("");
        setVerificationNotes("");
        onSuccess?.();
      } else {
        setActionError(result.error);
        toast.error("Action failed.", { description: result.error });
      }
    });
  };

  const isActionable = submission.status === "SUBMITTED";
  const hasAmountMismatch =
    submission.declared_amount !== null &&
    submission.declared_amount !== undefined &&
    estimatedTotal !== undefined &&
    Math.abs(submission.declared_amount - estimatedTotal) > 0.01;

  return (
    <>
      {/* Compact inline view of the submission */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            {METHOD_ICONS[submission.payment_method]}
            <span className="text-xs font-medium text-foreground">
              {CUSTOMER_PAYMENT_METHOD_LABELS[submission.payment_method]}
            </span>
          </div>
          <PaymentStatusBadge status={submission.status} />
        </div>

        {/* Cash warning banner for staff */}
        {(submission.payment_method === "CASH_ON_DELIVERY" ||
          submission.payment_method === "CASH_ON_PICKUP") &&
          isActionable && (
            <Alert className="border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200 py-1.5 px-2.5">
              <AlertCircle className="size-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
              <AlertDescription className="text-[11px] leading-snug">
                <strong>Cash Payment:</strong> Physical cash must be received and counted before verifying.
              </AlertDescription>
            </Alert>
          )}

        {/* Amounts */}
        <div className="space-y-0.5">
          {submission.declared_amount !== null && submission.declared_amount !== undefined && (
            <p className="text-[10px] text-muted-foreground">
              Customer Declared:{" "}
              <span className="font-semibold tabular-nums text-foreground">
                {formatCurrency(submission.declared_amount)}
              </span>{" "}
              <span className="text-[9px] text-muted-foreground/80">(informational)</span>
            </p>
          )}

          {estimatedTotal !== undefined && (
            <p className="text-[10px] text-muted-foreground">
              Order Estimated Total:{" "}
              <span className="font-semibold tabular-nums text-foreground">
                {formatCurrency(estimatedTotal)}
              </span>
            </p>
          )}

          {hasAmountMismatch && (
            <p className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
              ⚠️ Amount mismatch: Declared {formatCurrency(submission.declared_amount!)} vs Order Total {formatCurrency(estimatedTotal!)}
            </p>
          )}
        </div>

        {submission.bank_name && (
          <p className="text-[10px] text-muted-foreground">
            Bank: <span className="font-medium text-foreground">{submission.bank_name}</span>
          </p>
        )}

        {submission.sender_name && (
          <p className="text-[10px] text-muted-foreground">
            {submission.payment_method === "GCASH" ? "GCash Account" : "Sender"}:{" "}
            <span className="font-medium text-foreground">{submission.sender_name}</span>
          </p>
        )}

        {submission.gcash_number && (
          <p className="text-[10px] text-muted-foreground">
            GCash Number:{" "}
            <span className="font-mono font-medium text-foreground">{submission.gcash_number}</span>
          </p>
        )}

        {submission.payment_date && (
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Calendar className="size-3 shrink-0" />
            <span>
              Date: <span className="font-medium text-foreground">{submission.payment_date}</span>
            </span>
          </p>
        )}

        {submission.reference_number && (
          <p className="text-[10px] text-muted-foreground">
            Ref:{" "}
            <span className="font-mono text-foreground break-all">
              {submission.reference_number}
            </span>
          </p>
        )}

        {submission.receipt_url && (
          <div className="pt-1">
            <p className="text-[10px] text-muted-foreground font-medium mb-1">Receipt Screenshot:</p>
            <a
              href={submission.receipt_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block relative group rounded border border-border/80 overflow-hidden hover:opacity-90 transition-opacity"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={submission.receipt_url}
                alt="Payment Receipt"
                className="max-h-24 max-w-[180px] object-contain bg-black/5 dark:bg-white/5 rounded"
              />
              <span className="flex items-center gap-1 text-[9px] text-primary hover:underline mt-0.5">
                <ExternalLink className="size-2.5" /> View full image
              </span>
            </a>
          </div>
        )}

        {submission.customer_notes && (
          <p className="text-[10px] text-muted-foreground italic">
            Note: {submission.customer_notes}
          </p>
        )}

        <p className="text-[10px] text-muted-foreground">
          Submitted: {formatDate(submission.created_at)}
        </p>

        {/* Rejection reason (visible to staff) */}
        {submission.status === "REJECTED" && submission.rejection_reason && (
          <p className="text-[10px] text-rose-600 dark:text-rose-400">
            Rejected: {submission.rejection_reason}
          </p>
        )}

        {/* Staff action buttons — only if SUBMITTED */}
        {isActionable && (
          <div className="flex gap-1.5 pt-1">
            <Button
              type="button"
              size="sm"
              className="h-7 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => {
                setDialogAction("VERIFY");
                setActionError(null);
              }}
              disabled={isPending}
              id={`verify-payment-btn-${submission.id}`}
            >
              <CheckCircle2 className="size-3 mr-1" />
              Verify
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-[10px] text-rose-600 dark:text-rose-400 border-rose-500/30 hover:bg-rose-500/10"
              onClick={() => {
                setDialogAction("REJECT");
                setActionError(null);
              }}
              disabled={isPending}
              id={`reject-payment-btn-${submission.id}`}
            >
              <XCircle className="size-3 mr-1" />
              Reject
            </Button>
          </div>
        )}
      </div>

      {/* Verify dialog */}
      <Dialog
        open={dialogAction === "VERIFY"}
        onOpenChange={(open) => !open && setDialogAction(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
              Verify Payment
            </DialogTitle>
            <DialogDescription className="text-xs">
              Confirm that you have received and verified this payment.
              The customer will see their payment as verified.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-1">
            {/* Cash warning alert */}
            {(submission.payment_method === "CASH_ON_DELIVERY" ||
              submission.payment_method === "CASH_ON_PICKUP") && (
              <Alert className="border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200">
                <AlertCircle className="size-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <AlertDescription className="text-xs">
                  <strong>Physical Cash Warning:</strong> Cash must be physically collected and counted before verifying this payment submission.
                </AlertDescription>
              </Alert>
            )}

            {/* Summary */}
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Method:</span>
                <span className="font-semibold">
                  {CUSTOMER_PAYMENT_METHOD_LABELS[submission.payment_method]}
                </span>
              </div>
              {submission.bank_name && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Bank Name:</span>
                  <span className="font-medium text-foreground">{submission.bank_name}</span>
                </div>
              )}
              {submission.sender_name && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    {submission.payment_method === "GCASH" ? "GCash Account:" : "Sender Name:"}
                  </span>
                  <span className="font-medium text-foreground">{submission.sender_name}</span>
                </div>
              )}
              {submission.gcash_number && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">GCash Number:</span>
                  <span className="font-mono font-medium text-foreground">{submission.gcash_number}</span>
                </div>
              )}
              {submission.payment_date && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Payment Date:</span>
                  <span className="font-medium text-foreground">{submission.payment_date}</span>
                </div>
              )}
              {submission.reference_number && (
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground shrink-0">Ref:</span>
                  <span className="font-mono text-[10px] break-all text-right">
                    {submission.reference_number}
                  </span>
                </div>
              )}
              {submission.receipt_url && (
                <div className="pt-1 border-t border-border/40">
                  <div className="text-muted-foreground mb-1">Receipt Screenshot:</div>
                  <a
                    href={submission.receipt_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline text-[11px]"
                  >
                    <ExternalLink className="size-3" /> View uploaded proof of payment
                  </a>
                </div>
              )}
              {submission.declared_amount !== null && submission.declared_amount !== undefined && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer Declared:</span>
                  <span className="font-semibold tabular-nums">
                    {formatCurrency(submission.declared_amount)}
                  </span>
                </div>
              )}
              {estimatedTotal !== undefined && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Order Estimated Total:</span>
                  <span className="font-semibold tabular-nums">
                    {formatCurrency(estimatedTotal)}
                  </span>
                </div>
              )}
              {hasAmountMismatch && (
                <div className="rounded bg-amber-500/10 p-1.5 text-[11px] text-amber-700 dark:text-amber-300 font-medium">
                  ⚠️ Note: Declared amount differs from the estimated order total.
                </div>
              )}
              <div className="pt-1.5 border-t border-border/40 text-[10px] text-muted-foreground">
                Verification confirms proof of payment. Official invoice & revenue ledger entries are created during Egg Sales order fulfillment.
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="verify-notes" className="text-xs">
                Verification Notes{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <Textarea
                id="verify-notes"
                value={verificationNotes}
                onChange={(e) => setVerificationNotes(e.target.value)}
                placeholder="Internal notes about this verification…"
                className="text-xs resize-none h-16"
                maxLength={500}
                disabled={isPending}
              />
            </div>

            {actionError && (
              <Alert className="border-destructive/30 bg-destructive/5">
                <AlertCircle className="size-4 text-destructive" />
                <AlertDescription className="text-xs text-destructive/90">
                  {actionError}
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => setDialogAction(null)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => handleAction("VERIFY")}
              disabled={isPending}
              id="confirm-verify-btn"
            >
              {isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="size-3.5 mr-1.5" />
                  Confirm Verification
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog
        open={dialogAction === "REJECT"}
        onOpenChange={(open) => !open && setDialogAction(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <XCircle className="size-4 text-rose-600 dark:text-rose-400" />
              Reject Payment Submission
            </DialogTitle>
            <DialogDescription className="text-xs">
              Provide a reason for rejection. The customer will see this reason
              and may resubmit.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="rejection-reason" className="text-xs">
                Rejection Reason <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="rejection-reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g. Reference number not found, amount incorrect, screenshot unclear…"
                className="text-xs resize-none h-20"
                maxLength={500}
                disabled={isPending}
              />
              <p className="text-[10px] text-muted-foreground text-right">
                {rejectionReason.length}/500
              </p>
            </div>

            {actionError && (
              <Alert className="border-destructive/30 bg-destructive/5">
                <AlertCircle className="size-4 text-destructive" />
                <AlertDescription className="text-xs text-destructive/90">
                  {actionError}
                </AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => setDialogAction(null)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="text-xs"
              onClick={() => handleAction("REJECT")}
              disabled={isPending || !rejectionReason.trim()}
              id="confirm-reject-btn"
            >
              {isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <>
                  <XCircle className="size-3.5 mr-1.5" />
                  Reject Payment
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
