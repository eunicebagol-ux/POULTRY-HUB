"use client";

import * as React from "react";
import { useTransition } from "react";
import { toast } from "sonner";
import {
  CreditCard,
  Smartphone,
  Building2,
  Truck,
  Store,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Loader2,
  Info,
  Upload,
  X,
  Copy,
  Check,
} from "lucide-react";
import { type OfficialGcashSettings, getOfficialGcashSettings } from "@/actions/settings";
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
  DEFAULT_CURRENCY_SYMBOL,
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
  CASH_ON_PICKUP: <Store className="size-5 text-emerald-500" />,
};

function MethodInstructions({
  method,
  estimatedTotal,
  gcashSettings,
  onCopyNumber,
  copiedNumber,
}: {
  method: CustomerPaymentMethod;
  estimatedTotal?: number;
  gcashSettings?: OfficialGcashSettings;
  onCopyNumber?: (num: string) => void;
  copiedNumber?: boolean;
}) {
  if (method === "GCASH") {
    const isConfigured = Boolean(
      gcashSettings?.account_number?.trim() && gcashSettings?.account_name?.trim()
    );

    if (isConfigured) {
      return (
        <div className="rounded-lg border-2 border-blue-500/35 bg-blue-500/5 p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider flex items-center gap-1.5">
              <Store className="size-3.5" />
              Farm&apos;s Official Receiving Account
            </span>
            <Badge className="bg-blue-600 hover:bg-blue-600 text-white text-[9px] px-2 py-0.5 font-medium">
              Send Payment Here
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-background/80 rounded-md p-2.5 border border-border/70">
            <div>
              <span className="text-[10px] font-medium text-muted-foreground block">
                Official Account Name
              </span>
              <p className="text-xs font-bold text-foreground mt-0.5 break-words">
                {gcashSettings!.account_name}
              </p>
            </div>

            <div>
              <span className="text-[10px] font-medium text-muted-foreground block">
                Official Receiving Number
              </span>
              <div className="flex items-center justify-between gap-2 mt-0.5">
                <span className="font-mono text-xs font-bold text-blue-700 dark:text-blue-300">
                  {gcashSettings!.account_number}
                </span>
                {onCopyNumber && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onCopyNumber(gcashSettings!.account_number!)}
                    className="h-6 px-2 text-[10px] gap-1 border-blue-500/30 hover:bg-blue-500/10 hover:text-blue-700 dark:hover:text-blue-300 shrink-0"
                  >
                    {copiedNumber ? (
                      <>
                        <Check className="size-3 text-emerald-600 dark:text-emerald-400" />
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="size-3 text-blue-600 dark:text-blue-400" />
                        <span>Copy Number</span>
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </div>

          {estimatedTotal !== undefined && (
            <div className="rounded-md bg-blue-500/8 border border-blue-500/20 p-2.5 space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-blue-900 dark:text-blue-200">Order Total to Send:</span>
                <span className="text-sm font-bold text-blue-700 dark:text-blue-300">
                  {DEFAULT_CURRENCY_SYMBOL}{estimatedTotal.toFixed(2)}
                </span>
              </div>
              <p className="text-[10.5px] text-blue-800/90 dark:text-blue-200/90">
                Send via GCash Express Send to the number above, then enter your details below.
              </p>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 space-y-1">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
          <AlertCircle className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>GCash payment details are not configured yet</span>
        </div>
        <p className="text-[11px] text-amber-700/90 dark:text-amber-300/90 leading-relaxed">
          The farm administrator has not configured the official GCash receiving account. You may still enter your GCash details below.
        </p>
      </div>
    );
  }

  if (method === "BANK_TRANSFER") {
    return (
      <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/5 p-3 space-y-1.5">
        <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
          <Building2 className="size-3.5" />
          Bank Transfer Verification
        </p>
        <p className="text-[11px] text-indigo-700/80 dark:text-indigo-300/80 leading-relaxed">
          Official farm bank account details are being configured by the farm administrator. If you already completed a transfer to the farm account, please provide your bank name, sender name, and reference number below.
        </p>
      </div>
    );
  }

  if (method === "CASH_ON_PICKUP") {
    return (
      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-1.5">
        <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
          <Store className="size-3.5" />
          Pay on Pick Up
        </p>
        <p className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80 leading-relaxed">
          Please pay in cash at the farm counter when picking up your eggs. Our staff will issue your official receipt directly upon receiving payment.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-1.5">
      <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
        <Truck className="size-3.5" />
        Pay on Delivery
      </p>
      <p className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80 leading-relaxed">
        Have your cash payment ready when the farm delivery personnel arrives. Our delivery staff will issue your official receipt directly.
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
        {submission.bank_name && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Bank:</span>
            <span className="font-semibold text-foreground">
              {submission.bank_name}
            </span>
          </div>
        )}
        {submission.sender_name && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">
              {submission.payment_method === "GCASH" ? "GCash Account:" : "Sender:"}
            </span>
            <span className="font-semibold text-foreground">
              {submission.sender_name}
            </span>
          </div>
        )}
        {submission.gcash_number && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">GCash Number:</span>
            <span className="font-mono font-semibold text-foreground">
              {submission.gcash_number}
            </span>
          </div>
        )}
        {submission.payment_date && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Payment date:</span>
            <span className="font-mono text-[10px] text-foreground">
              {submission.payment_date}
            </span>
          </div>
        )}
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
        {submission.receipt_url && (
          <div className="space-y-1.5 pt-1">
            <span className="text-muted-foreground block text-[11px]">Payment proof attached:</span>
            <a
              href={submission.receipt_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block rounded-md border border-border/70 overflow-hidden hover:opacity-90 transition-opacity"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={submission.receipt_url}
                alt="Receipt proof"
                className="h-16 w-auto object-cover"
              />
            </a>
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
  const [paymentDate, setPaymentDate] = React.useState(
    new Date().toISOString().split("T")[0]
  );
  const [declaredAmount, setDeclaredAmount] = React.useState(
    estimatedTotal > 0 ? estimatedTotal.toFixed(2) : ""
  );
  const [bankName, setBankName] = React.useState("");
  const [senderName, setSenderName] = React.useState("");
  const [gcashNumber, setGcashNumber] = React.useState("");
  const [gcashAccountName, setGcashAccountName] = React.useState("");
  const [receiptUrl, setReceiptUrl] = React.useState<string | null>(null);
  const [receiptFileName, setReceiptFileName] = React.useState<string | null>(null);
  const [customerNotes, setCustomerNotes] = React.useState("");
  const [formError, setFormError] = React.useState<string | null>(null);
  const [submitted, setSubmitted] = React.useState(false);
  const [gcashSettings, setGcashSettings] = React.useState<OfficialGcashSettings | undefined>();
  const [copiedNumber, setCopiedNumber] = React.useState(false);

  React.useEffect(() => {
    getOfficialGcashSettings().then((res) => {
      if (res.success && res.data) {
        setGcashSettings(res.data);
      }
    });
  }, []);

  const handleCopyNumber = (num: string) => {
    if (!num) return;
    navigator.clipboard.writeText(num.replace(/[\s-]/g, "") || num);
    setCopiedNumber(true);
    toast.success("GCash number copied to clipboard!");
    setTimeout(() => setCopiedNumber(false), 2000);
  };

  // Handle receipt file upload (convert to Base64 data URL)
  const handleReceiptFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Receipt file is too large. Max size is 5MB.");
      return;
    }

    setReceiptFileName(file.name);
    const reader = new FileReader();
    reader.onloadend = () => {
      setReceiptUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveReceipt = () => {
    setReceiptUrl(null);
    setReceiptFileName(null);
  };

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

    if (selectedMethod === "BANK_TRANSFER" && !referenceNumber.trim()) {
      setFormError("Transaction reference number is required for Bank Transfer.");
      return;
    }

    if (selectedMethod === "GCASH") {
      const cleanGcash = gcashNumber.replace(/[\s-]/g, "");
      if (!cleanGcash) {
        setFormError("GCash number is required.");
        return;
      }
      if (!/^(09|\+639)\d{9}$/.test(cleanGcash)) {
        setFormError("Please enter a valid 11-digit GCash number (e.g. 09171234567).");
        return;
      }
      if (!gcashAccountName.trim()) {
        setFormError("GCash account name is required.");
        return;
      }
    }

    if (selectedMethod === "BANK_TRANSFER") {
      if (!bankName.trim()) {
        setFormError("Bank name is required.");
        return;
      }
      if (!senderName.trim()) {
        setFormError("Sender account name is required.");
        return;
      }
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
          payment_date: paymentDate || undefined,
          bank_name: selectedMethod === "BANK_TRANSFER" ? bankName.trim() || undefined : undefined,
          sender_name:
            selectedMethod === "GCASH"
              ? gcashAccountName.trim() || undefined
              : selectedMethod === "BANK_TRANSFER"
              ? senderName.trim() || undefined
              : undefined,
          gcash_number: selectedMethod === "GCASH" ? gcashNumber.trim() || undefined : undefined,
          receipt_url: receiptUrl || undefined,
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

  const isDigital =
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
            {(
              [
                "CASH_ON_DELIVERY",
                "CASH_ON_PICKUP",
                "GCASH",
                "BANK_TRANSFER",
              ] as CustomerPaymentMethod[]
            ).map((method) => (
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
            ))}
          </div>
        </div>

        {/* Instructions */}
        {selectedMethod && (
          <MethodInstructions
            method={selectedMethod}
            estimatedTotal={estimatedTotal}
            gcashSettings={gcashSettings}
            onCopyNumber={handleCopyNumber}
            copiedNumber={copiedNumber}
          />
        )}

        {/* Bank Transfer specific fields */}
        {selectedMethod === "BANK_TRANSFER" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="post-bank-name" className="text-xs font-medium">
                Bank Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="post-bank-name"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="e.g. BDO, BPI, Landbank"
                className="h-8 text-xs"
                disabled={isPending}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="post-sender-name" className="text-xs font-medium">
                Sender Account Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="post-sender-name"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="Account holder name"
                className="h-8 text-xs"
                disabled={isPending}
              />
            </div>
          </div>
        )}

        {/* GCash specific fields */}
        {selectedMethod === "GCASH" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="post-gcash-number" className="text-xs font-medium">
                GCash Number <span className="text-destructive">*</span>
              </Label>
              <Input
                id="post-gcash-number"
                type="tel"
                value={gcashNumber}
                onChange={(e) => setGcashNumber(e.target.value)}
                placeholder="09XXXXXXXXX (11 digits)"
                maxLength={20}
                className="h-8 text-xs font-mono"
                disabled={isPending}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="post-gcash-account-name" className="text-xs font-medium">
                GCash Account Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="post-gcash-account-name"
                value={gcashAccountName}
                onChange={(e) => setGcashAccountName(e.target.value)}
                placeholder="Account holder name"
                maxLength={150}
                className="h-8 text-xs"
                disabled={isPending}
              />
            </div>
          </div>
        )}

        {/* Reference number & payment date for digital methods */}
        {isDigital && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label
                htmlFor="payment-reference-number"
                className="text-xs font-medium"
              >
                Transaction Reference{" "}
                {selectedMethod === "BANK_TRANSFER" ? (
                  <span className="text-destructive">*</span>
                ) : (
                  <span className="text-muted-foreground font-normal">(optional)</span>
                )}
              </Label>
              <Input
                id="payment-reference-number"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder={
                  selectedMethod === "BANK_TRANSFER"
                    ? "e.g. Bank trace / reference #"
                    : "e.g. 100234567890 (if paid)"
                }
                className="h-8 text-xs font-mono"
                maxLength={200}
                disabled={isPending}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="post-payment-date" className="text-xs font-medium">
                Payment Date
              </Label>
              <Input
                id="post-payment-date"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="h-8 text-xs"
                disabled={isPending}
              />
            </div>
          </div>
        )}

        {/* Declared amount */}
        {selectedMethod && (
          <div className="space-y-1.5">
            <Label htmlFor="payment-declared-amount" className="text-xs font-medium">
              Amount Sent ({DEFAULT_CURRENCY_SYMBOL}){" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <div className="relative max-w-48">
              <Input
                id="payment-declared-amount"
                type="number"
                min="0"
                step="0.01"
                value={declaredAmount}
                onChange={(e) => setDeclaredAmount(e.target.value)}
                className="h-8 text-xs font-mono"
                disabled={isPending}
              />
            </div>
          </div>
        )}

        {/* Optional Screenshot Upload for digital payments */}
        {isDigital && (
          <div className="space-y-1.5">
            <Label className="text-xs font-medium flex items-center justify-between">
              <span>Receipt Screenshot <span className="text-muted-foreground font-normal">(optional)</span></span>
              {receiptFileName && (
                <button
                  type="button"
                  onClick={handleRemoveReceipt}
                  className="text-[10px] text-destructive hover:underline flex items-center gap-0.5"
                >
                  <X className="size-3" /> Remove
                </button>
              )}
            </Label>
            {!receiptUrl ? (
              <label className="flex items-center justify-center gap-2 border border-dashed border-border/80 rounded-lg p-3 bg-background/40 hover:bg-background/80 hover:border-primary/50 cursor-pointer transition-colors text-xs text-muted-foreground">
                <Upload className="size-4 text-primary" />
                <span>Upload payment receipt / screenshot</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleReceiptFileChange}
                  className="hidden"
                />
              </label>
            ) : (
              <div className="flex items-center gap-3 bg-muted/30 rounded-lg p-2 border border-border/70">
                <div className="size-12 rounded border border-border/70 overflow-hidden shrink-0 bg-muted/30 flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={receiptUrl}
                    alt="Receipt preview"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1 text-xs">
                  <p className="font-medium text-foreground truncate">{receiptFileName}</p>
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400">Screenshot attached</p>
                </div>
              </div>
            )}
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
              (isDigital && !referenceNumber.trim())
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
