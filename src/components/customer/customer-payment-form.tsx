"use client";

import * as React from "react";
import { useTransition } from "react";
import { toast } from "sonner";
import {
  CreditCard,
  Smartphone,
  Building2,
  Truck,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Loader2,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  CUSTOMER_PAYMENT_METHOD_LABELS,
  CUSTOMER_PAYMENT_METHOD_DESCRIPTIONS,
  CUSTOMER_PAYMENT_STATUS_LABELS,
  DEFAULT_CURRENCY_SYMBOL,
  DEMO_GCASH_NUMBER,
  DEMO_GCASH_NAME,
  DEMO_BANK_NAME,
  DEMO_BANK_ACCOUNT_NAME,
  DEMO_BANK_ACCOUNT_NUMBER,
} from "@/lib/constants";
import type { CustomerPaymentMethod, CustomerPaymentStatus, CustomerPaymentSubmission } from "@/types";
import { submitPaymentSubmission } from "@/actions/customer-payments";
import type { CustomerOrderStatus } from "@/types";

interface CustomerPaymentFormProps {
  orderId: string;
  orderStatus: CustomerOrderStatus;
  estimatedTotal: number;
  existingSubmission: CustomerPaymentSubmission | null;
}

function formatCurrency(amount: number): string {
  return `${DEFAULT_CURRENCY_SYMBOL}${amount.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function PaymentStatusBadge({ status }: { status: CustomerPaymentStatus }) {
  const config: Record<
    CustomerPaymentStatus,
    { label: string; className: string; icon: React.ReactNode }
  > = {
    PENDING_SUBMISSION: {
      label: "Not Submitted",
      className: "bg-muted/60 text-muted-foreground border-border/60",
      icon: <Clock className="size-3" />,
    },
    SUBMITTED: {
      label: "Awaiting Verification",
      className: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
      icon: <Clock className="size-3" />,
    },
    VERIFIED: {
      label: "Payment Verified ✓",
      className: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
      icon: <CheckCircle2 className="size-3" />,
    },
    REJECTED: {
      label: "Payment Rejected",
      className: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20",
      icon: <XCircle className="size-3" />,
    },
    REFUNDED: {
      label: "Refunded",
      className: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
      icon: <CheckCircle2 className="size-3" />,
    },
  };

  const cfg = config[status] ?? config["PENDING_SUBMISSION"];
  return (
    <Badge className={`${cfg.className} text-[10px] flex items-center gap-1 w-fit`}>
      {cfg.icon}
      {cfg.label}
    </Badge>
  );
}

const METHOD_ICONS: Record<CustomerPaymentMethod, React.ReactNode> = {
  GCASH: <Smartphone className="size-5 text-blue-500" />,
  BANK_TRANSFER: <Building2 className="size-5 text-indigo-500" />,
  CASH_ON_DELIVERY: <Truck className="size-5 text-emerald-500" />,
};

function MethodInstructions({ method }: { method: CustomerPaymentMethod }) {
  if (method === "GCASH") {
    return (
      <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 space-y-1.5">
        <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
          <Smartphone className="size-3.5" />
          GCash Demo Payment Details
        </p>
        <div className="text-[10px] text-blue-700/80 dark:text-blue-300/80 space-y-0.5">
          <p>GCash Number: <span className="font-mono font-semibold">{DEMO_GCASH_NUMBER}</span></p>
          <p>Account Name: <span className="font-semibold">{DEMO_GCASH_NAME}</span></p>
          <p className="italic text-[9px] opacity-70 pt-0.5">
            ⚠ This is a demo number only. No real money transfer is required.
          </p>
        </div>
      </div>
    );
  }

  if (method === "BANK_TRANSFER") {
    return (
      <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-3 space-y-1.5">
        <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
          <Building2 className="size-3.5" />
          Bank Transfer Demo Details
        </p>
        <div className="text-[10px] text-indigo-700/80 dark:text-indigo-300/80 space-y-0.5">
          <p>Bank: <span className="font-semibold">{DEMO_BANK_NAME}</span></p>
          <p>Account Name: <span className="font-semibold">{DEMO_BANK_ACCOUNT_NAME}</span></p>
          <p>Account Number: <span className="font-mono font-semibold">{DEMO_BANK_ACCOUNT_NUMBER}</span></p>
          <p className="italic text-[9px] opacity-70 pt-0.5">
            ⚠ This is a demo account only. No real bank transfer is required.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-1.5">
      <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
        <Truck className="size-3.5" />
        Pay on Delivery / Pickup
      </p>
      <p className="text-[10px] text-emerald-700/80 dark:text-emerald-300/80">
        Have your payment ready when the farm delivers your order or when you pick it up.
        No upfront proof needed.
      </p>
    </div>
  );
}

function ExistingSubmissionView({
  submission,
}: {
  submission: CustomerPaymentSubmission;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-foreground">Payment Submission</p>
        <PaymentStatusBadge status={submission.status} />
      </div>
      <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Method:</span>
          <span className="font-semibold text-foreground">
            {CUSTOMER_PAYMENT_METHOD_LABELS[submission.payment_method]}
          </span>
        </div>
        {submission.declared_amount && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Amount declared:</span>
            <span className="font-semibold text-foreground tabular-nums">
              {formatCurrency(submission.declared_amount)}
            </span>
          </div>
        )}
        {submission.reference_number && (
          <div className="flex items-start justify-between gap-2">
            <span className="text-muted-foreground shrink-0">Reference:</span>
            <span className="font-mono text-[10px] text-foreground break-all text-right">
              {submission.reference_number}
            </span>
          </div>
        )}
        {submission.customer_notes && (
          <div className="flex items-start justify-between gap-2">
            <span className="text-muted-foreground shrink-0">Your note:</span>
            <span className="text-foreground text-[10px] text-right">
              {submission.customer_notes}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Submitted:</span>
          <span className="text-foreground text-[10px]">
            {new Date(submission.created_at).toLocaleDateString("en-PH", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      </div>

      {/* Rejection reason shown to customer */}
      {submission.status === "REJECTED" && submission.rejection_reason && (
        <Alert className="border-rose-500/20 bg-rose-500/5">
          <XCircle className="size-4 text-rose-600 dark:text-rose-400" />
          <AlertDescription className="text-xs text-rose-700 dark:text-rose-300">
            <strong>Rejected:</strong> {submission.rejection_reason}
            <br />
            <span className="text-[10px] opacity-80">
              Please contact the farm team or submit a corrected payment.
            </span>
          </AlertDescription>
        </Alert>
      )}

      {submission.status === "VERIFIED" && (
        <Alert className="border-emerald-500/20 bg-emerald-500/5">
          <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
          <AlertDescription className="text-xs text-emerald-700 dark:text-emerald-300">
            Your payment has been verified. The farm team will fulfill your order.
          </AlertDescription>
        </Alert>
      )}

      {submission.status === "SUBMITTED" && (
        <Alert className="border-amber-500/20 bg-amber-500/5">
          <Clock className="size-4 text-amber-600 dark:text-amber-400" />
          <AlertDescription className="text-xs text-amber-700 dark:text-amber-300">
            Your payment submission is awaiting verification by the farm team.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

export function CustomerPaymentForm({
  orderId,
  orderStatus,
  estimatedTotal,
  existingSubmission,
}: CustomerPaymentFormProps) {
  const [isPending, startTransition] = useTransition();
  const [selectedMethod, setSelectedMethod] =
    React.useState<CustomerPaymentMethod | null>(null);
  const [referenceNumber, setReferenceNumber] = React.useState("");
  const [declaredAmount, setDeclaredAmount] = React.useState(
    estimatedTotal > 0 ? estimatedTotal.toFixed(2) : ""
  );
  const [customerNotes, setCustomerNotes] = React.useState("");
  const [formError, setFormError] = React.useState<string | null>(null);
  const [submitted, setSubmitted] = React.useState(false);

  // Order must be CONFIRMED or later to allow payment
  const allowedStatuses: CustomerOrderStatus[] = ["CONFIRMED", "PREPARING", "READY"];
  const canPay = allowedStatuses.includes(orderStatus);

  // Payment already exists and is not rejected — show existing view
  if (existingSubmission && existingSubmission.status !== "REJECTED") {
    return (
      <Card className="border-border/60">
        <CardHeader className="pb-3 border-b border-border/60">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <CreditCard className="size-4 text-muted-foreground" />
            Payment Status
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <ExistingSubmissionView submission={existingSubmission} />
        </CardContent>
      </Card>
    );
  }

  if (submitted) {
    return (
      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardContent className="py-10 text-center space-y-3">
          <div className="size-12 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
            <CheckCircle2 className="size-6" />
          </div>
          <h3 className="text-sm font-bold text-foreground">Payment Submitted!</h3>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto">
            Your payment has been submitted and is awaiting verification by the farm team.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!canPay) {
    return (
      <Card className="border-border/60">
        <CardContent className="py-8 text-center space-y-2">
          <Info className="size-6 text-muted-foreground mx-auto" />
          <p className="text-xs text-muted-foreground max-w-xs mx-auto">
            {orderStatus === "PENDING"
              ? "Payment options will be available after the farm confirms your order."
              : orderStatus === "CANCELLED"
              ? "This order has been cancelled."
              : orderStatus === "COMPLETED"
              ? "This order has been completed."
              : `Payment is not available for orders in ${orderStatus} status.`}
          </p>
        </CardContent>
      </Card>
    );
  }

  const handleSubmit = () => {
    if (!selectedMethod) {
      setFormError("Please select a payment method.");
      return;
    }
    setFormError(null);

    startTransition(async () => {
      try {
        const parsedAmount = parseFloat(declaredAmount);
        const result = await submitPaymentSubmission({
          order_id: orderId,
          payment_method: selectedMethod,
          declared_amount: !isNaN(parsedAmount) && parsedAmount > 0 ? parsedAmount : undefined,
          reference_number: referenceNumber.trim() || undefined,
          customer_notes: customerNotes.trim() || undefined,
        });

        if (!result.success) {
          setFormError(result.error);
          toast.error("Payment submission failed.", { description: result.error });
        } else {
          setSubmitted(true);
          toast.success("Payment submitted!", {
            description: "The farm team will verify your payment shortly.",
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
        setFormError(msg);
        toast.error("Payment submission failed.", { description: msg });
      }
    });
  };

  const requiresRef =
    selectedMethod === "GCASH" || selectedMethod === "BANK_TRANSFER";

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3 border-b border-border/60">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <CreditCard className="size-4 text-muted-foreground" />
          Submit Payment
        </CardTitle>
        <CardDescription className="text-xs">
          Choose how you would like to pay. The farm team will verify your submission before fulfilling your order.
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-4 space-y-5">
        {/* Rejected submission notice */}
        {existingSubmission?.status === "REJECTED" && (
          <Alert className="border-rose-500/20 bg-rose-500/5">
            <XCircle className="size-4 text-rose-600 dark:text-rose-400" />
            <AlertDescription className="text-xs text-rose-700 dark:text-rose-300">
              <strong>Previous submission was rejected.</strong>{" "}
              {existingSubmission.rejection_reason}
              <br />
              <span className="text-[10px]">Please submit a corrected payment below.</span>
            </AlertDescription>
          </Alert>
        )}

        {/* Order amount hint */}
        <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
          <span className="text-xs text-muted-foreground">Estimated Total</span>
          <span className="text-sm font-bold tabular-nums text-foreground">
            {formatCurrency(estimatedTotal)}
          </span>
        </div>

        {/* Payment method selector */}
        <div className="space-y-2">
          <Label className="text-xs font-medium">Payment Method</Label>
          <div className="grid grid-cols-1 gap-2">
            {(["GCASH", "BANK_TRANSFER", "CASH_ON_DELIVERY"] as CustomerPaymentMethod[]).map(
              (method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setSelectedMethod(method)}
                  id={`payment-method-${method.toLowerCase()}`}
                  className={`flex items-start gap-3 rounded-lg border p-3 text-left transition-all ${
                    selectedMethod === method
                      ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                      : "border-border/60 hover:border-border hover:bg-muted/20"
                  }`}
                >
                  <div className="mt-0.5 shrink-0">{METHOD_ICONS[method]}</div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground">
                      {CUSTOMER_PAYMENT_METHOD_LABELS[method]}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">
                      {CUSTOMER_PAYMENT_METHOD_DESCRIPTIONS[method]}
                    </p>
                  </div>
                </button>
              )
            )}
          </div>
        </div>

        {/* Instructions / demo details */}
        {selectedMethod && (
          <MethodInstructions method={selectedMethod} />
        )}

        {/* Reference number (required for GCash / Bank) */}
        {selectedMethod && selectedMethod !== "CASH_ON_DELIVERY" && (
          <div className="space-y-1.5">
            <Label
              htmlFor="payment-reference-number"
              className="text-xs font-medium"
            >
              Transaction Reference Number{" "}
              <span className="text-destructive">*</span>
            </Label>
            <Input
              id="payment-reference-number"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="e.g. GCash ref # or bank transaction ID"
              className="h-8 text-xs font-mono"
              maxLength={200}
              disabled={isPending}
            />
            <p className="text-[10px] text-muted-foreground">
              Enter the reference number from your GCash or bank app. This is
              required for verification.
            </p>
          </div>
        )}

        {/* Declared amount */}
        {selectedMethod && (
          <div className="space-y-1.5">
            <Label htmlFor="payment-declared-amount" className="text-xs font-medium">
              Amount Sent{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <div className="relative max-w-40">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                ₱
              </span>
              <Input
                id="payment-declared-amount"
                type="number"
                min="0"
                step="0.01"
                value={declaredAmount}
                onChange={(e) => setDeclaredAmount(e.target.value)}
                className="h-8 text-xs pl-5 font-mono"
                disabled={isPending}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              Informational only. The farm will confirm the authoritative amount.
            </p>
          </div>
        )}

        {/* Customer notes */}
        {selectedMethod && (
          <div className="space-y-1.5">
            <Label htmlFor="payment-customer-notes" className="text-xs font-medium">
              Additional Notes{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              id="payment-customer-notes"
              value={customerNotes}
              onChange={(e) => setCustomerNotes(e.target.value)}
              placeholder="Any additional information for the farm team…"
              className="text-xs resize-none h-16"
              maxLength={500}
              disabled={isPending}
            />
          </div>
        )}

        {/* Form error */}
        {formError && (
          <Alert className="border-destructive/30 bg-destructive/5">
            <AlertCircle className="size-4 text-destructive" />
            <AlertDescription className="text-xs text-destructive/90">
              {formError}
            </AlertDescription>
          </Alert>
        )}

        {/* Submit */}
        {selectedMethod && (
          <Button
            type="button"
            size="sm"
            className="w-full text-xs h-9"
            onClick={handleSubmit}
            disabled={
              isPending ||
              !selectedMethod ||
              (requiresRef && !referenceNumber.trim())
            }
            id="submit-payment-btn"
          >
            {isPending ? (
              <>
                <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                Submitting…
              </>
            ) : (
              <>
                <CreditCard className="size-3.5 mr-1.5" />
                Submit Payment
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
