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
  Truck,
  Store,
  MapPin,
  Clock,
  Info,
  Wallet,
  Smartphone,
  Building2,
  Upload,
  X,
  Copy,
  ChevronDown,
} from "lucide-react";
import { cn } from "cn";
import { type OfficialGcashSettings, getOfficialGcashSettings } from "@/actions/settings";
import { getActiveBankTransferAccounts } from "@/actions/bank-transfer-accounts";
import {
  SUPPORTED_BANK_OPTIONS,
  type SupportedBankOption,
} from "@/lib/validations/bank-transfer-accounts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  CUSTOMER_PAYMENT_METHOD_LABELS,
} from "@/lib/constants";
import type { EggSize, PackagingType, FulfillmentMethod, CustomerPaymentMethod, EggType } from "@/types";
import { submitCustomerOrder } from "@/actions/customer-orders";

// ─── Butuan City Barangays (verified list) ─────────────────────────────────────

export const BUTUAN_BARANGAYS: string[] = [
  "Agao",
  "Agusan Pequeño",
  "Ambago",
  "Amparo",
  "Ampayon",
  "Anticala",
  "Antongalon",
  "Aupagan",
  "Baan Km. 3",
  "Babag",
  "Bading",
  "Bancasi",
  "Banza",
  "Baobaoan",
  "Basag",
  "Bayanihan",
  "Bilay",
  "Bit-os",
  "Bitan-agan",
  "Bobon",
  "Bonbon",
  "Bugabus",
  "Bugsukan",
  "Buhangin",
  "Cabcabon",
  "Camayahan",
  "Catalan",
  "Chapels Village",
  "Dagohoy",
  "De Oro",
  "Doongan",
  "Dulag",
  "Dumalagan",
  "Florida",
  "Golden Ribbon",
  "Holy Redeemer",
  "Humabon",
  "Imadejas",
  "Jose Rizal",
  "Kinamlutan",
  "Lakandula",
  "Langihan",
  "Libertad",
  "Limaha",
  "Los Angeles",
  "Lumbocan",
  "Maguinda",
  "Mahay",
  "Mahogany",
  "Maibu",
  "Mandamo",
  "Manila de Bugabus",
  "Maon",
  "Masao",
  "Maug",
  "New Society Village",
  "Nong-nong",
  "Obrero",
  "Ong Yiu",
  "Pakna-an",
  "Pangabugan",
  "Pagatpatan",
  "Pianing",
  "Pigdaulan",
  "Pinamanculan",
  "Port Area",
  "Rajah Soliman",
  "Salvacion",
  "San Ignacio",
  "San Mateo",
  "San Vicente",
  "Silongan",
  "Sumile",
  "Sumilihon",
  "Tagabaca",
  "Taligaman",
  "Taguibo",
  "Tandang Sora",
  "Tiniwisan",
  "Tungao",
  "Urduja",
  "Villa Kananga",
];

// ─── Pickup time options ────────────────────────────────────────────────────

const PICKUP_TIME_OPTIONS = [
  "7:00 AM – 8:00 AM",
  "8:00 AM – 9:00 AM",
  "9:00 AM – 10:00 AM",
  "10:00 AM – 11:00 AM",
  "11:00 AM – 12:00 PM",
  "1:00 PM – 2:00 PM",
  "2:00 PM – 3:00 PM",
  "3:00 PM – 4:00 PM",
  "4:00 PM – 5:00 PM",
];

// ─── Types ──────────────────────────────────────────────────────────────────

interface CartItem {
  size: EggSize;
  packaging: PackagingType;
  package_quantity: number;
  quoted_unit_price: number;
  egg_type?: EggType;
}

interface CustomerOrderFormProps {
  cart: CartItem[];
  onClearCart: () => void;
  onRemoveItem: (size: EggSize, packaging: PackagingType, egg_type?: EggType) => void;
  officialGcashSettings?: OfficialGcashSettings;
  activeBankAccounts?: import("@/types").BankTransferAccountView[];
}

function formatCurrency(amount: number): string {
  return `${DEFAULT_CURRENCY_SYMBOL}${amount.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// ─── Fulfillment option tab button ────────────────────────────────────────────

function FulfillmentTab({
  method,
  selected,
  onSelect,
  icon,
  label,
  description,
}: {
  method: FulfillmentMethod;
  selected: boolean;
  onSelect: (m: FulfillmentMethod) => void;
  icon: React.ReactNode;
  label: string;
  description: string;
}) {
  return (
    <button
      type="button"
      id={`fulfillment-tab-${method.toLowerCase()}`}
      onClick={() => onSelect(method)}
      className={[
        "flex-1 flex flex-col items-center gap-2 rounded-xl border-2 p-4 text-center transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
        selected
          ? "border-emerald-500 bg-emerald-500/8 shadow-sm"
          : "border-border/60 bg-card hover:border-emerald-400/50 hover:bg-emerald-500/5",
      ].join(" ")}
    >
      <div
        className={[
          "size-10 rounded-full flex items-center justify-center transition-colors",
          selected
            ? "bg-emerald-500 text-white"
            : "bg-muted text-muted-foreground",
        ].join(" ")}
      >
        {icon}
      </div>
      <span
        className={[
          "text-sm font-semibold",
          selected ? "text-emerald-700 dark:text-emerald-400" : "text-foreground",
        ].join(" ")}
      >
        {label}
      </span>
      <span className="text-[10px] text-muted-foreground leading-snug">{description}</span>
    </button>
  );
}

// ─── Field error helper ───────────────────────────────────────────────────────

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-[10px] text-destructive mt-1">{message}</p>;
}

// ─── Main component ────────────────────────────────────────────────────────────

export function CustomerOrderForm({
  cart,
  onClearCart,
  onRemoveItem,
  officialGcashSettings,
  activeBankAccounts,
}: CustomerOrderFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fulfillmentMethod, setFulfillmentMethod] =
    React.useState<FulfillmentMethod | null>(null);

  // Official Farm GCash receiving details (from prop or fetched)
  const [fetchedGcashSettings, setFetchedGcashSettings] = React.useState<OfficialGcashSettings | undefined>();
  const [copiedNumber, setCopiedNumber] = React.useState(false);

  React.useEffect(() => {
    if (!officialGcashSettings) {
      getOfficialGcashSettings().then((res) => {
        if (res.success && res.data) {
          setFetchedGcashSettings(res.data);
        }
      });
    }
  }, [officialGcashSettings]);

  const gcashSettings = officialGcashSettings ?? fetchedGcashSettings;

  const handleCopyGcashNumber = (num: string) => {
    if (!num) return;
    navigator.clipboard.writeText(num.replace(/[\s-]/g, "") || num);
    setCopiedNumber(true);
    toast.success("GCash number copied to clipboard!");
    setTimeout(() => setCopiedNumber(false), 2000);
  };

  // Official Farm Bank receiving accounts (from prop or fetched)
  const [fetchedBankAccounts, setFetchedBankAccounts] =
    React.useState<import("@/types").BankTransferAccountView[] | undefined>();
  const [selectedReceivingAccountId, setSelectedReceivingAccountId] =
    React.useState<string>("");
  const [copiedBankAccountId, setCopiedBankAccountId] =
    React.useState<string | null>(null);

  // Sender Bank details
  const [senderBankSelect, setSenderBankSelect] =
    React.useState<SupportedBankOption>("BDO");
  const [customSenderBankName, setCustomSenderBankName] = React.useState("");

  React.useEffect(() => {
    if (!activeBankAccounts) {
      getActiveBankTransferAccounts().then((res) => {
        if (res.success && res.data) {
          setFetchedBankAccounts(res.data);
        }
      });
    }
  }, [activeBankAccounts]);

  const bankAccounts = React.useMemo(
    () => activeBankAccounts ?? fetchedBankAccounts ?? [],
    [activeBankAccounts, fetchedBankAccounts]
  );

  const [expandedBankAccountId, setExpandedBankAccountId] =
    React.useState<string | null>(null);

  const handleToggleBank = (accountId: string) => {
    if (expandedBankAccountId === accountId) {
      // Clicking the currently expanded bank collapses it
      setExpandedBankAccountId(null);
    } else {
      // Expand the newly selected bank, collapse any previously expanded bank, and mark it selected
      setExpandedBankAccountId(accountId);
      setSelectedReceivingAccountId(accountId);
      setFieldErrors((err) => ({ ...err, payment_bank_account: "" }));
    }
  };

  const handleCopyBankAccountNumber = (accId: string, accNum: string) => {
    if (!accNum) return;
    navigator.clipboard.writeText(accNum.replace(/[\s-]/g, "") || accNum);
    setCopiedBankAccountId(accId);
    toast.success("Bank account number copied to clipboard!");
    setTimeout(() => setCopiedBankAccountId(null), 2000);
  };

  // Delivery fields
  const [deliveryBarangay, setDeliveryBarangay] = React.useState("");
  const [deliveryAddress, setDeliveryAddress] = React.useState("");
  const [requestedDate, setRequestedDate] = React.useState("");

  // Pickup fields
  const [pickupDate, setPickupDate] = React.useState("");
  const [pickupTime, setPickupTime] = React.useState("");

  // Shared
  const [paymentMethod, setPaymentMethod] =
    React.useState<CustomerPaymentMethod | "">("");
  const [notes, setNotes] = React.useState("");
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [submitted, setSubmitted] = React.useState(false);

  // Real Payment Form fields for GCash & Bank Transfer
  const [paymentReference, setPaymentReference] = React.useState("");
  const [paymentDate, setPaymentDate] = React.useState(
    new Date().toISOString().split("T")[0]
  );
  // Empty string means user hasn't typed yet; fall back to estimated total
  const [paymentAmount, setPaymentAmount] = React.useState("");
  const [paymentSenderName, setPaymentSenderName] = React.useState("");
  const [paymentGcashNumber, setPaymentGcashNumber] = React.useState("");
  const [paymentGcashAccountName, setPaymentGcashAccountName] = React.useState("");
  const [paymentNotes, setPaymentNotes] = React.useState("");
  const [receiptUrl, setReceiptUrl] = React.useState<string | null>(null);
  const [receiptFileName, setReceiptFileName] = React.useState<string | null>(null);

  const estimatedTotal = cart.reduce(
    (sum, item) => sum + item.package_quantity * item.quoted_unit_price,
    0
  );

  // Derived amount displayed in amount fields: user's typed value or the estimated total
  const effectivePaymentAmount =
    paymentAmount || (estimatedTotal > 0 ? estimatedTotal.toFixed(2) : "");

  const totalPieces = cart.reduce(
    (sum, item) =>
      sum + item.package_quantity * PACKAGING_MULTIPLIERS[item.packaging],
    0
  );

  const today = new Date().toISOString().split("T")[0];


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

  // Reset fulfillment-specific fields when switching method
  // Automatically clears payment method if it becomes invalid under new fulfillment method
  const handleMethodChange = (method: FulfillmentMethod) => {
    setFulfillmentMethod(method);

    if (
      (method === "PICKUP" && paymentMethod === "CASH_ON_DELIVERY") ||
      (method === "DELIVERY" && paymentMethod === "CASH_ON_PICKUP")
    ) {
      setPaymentMethod("");
    }

    setFieldErrors({});
    setFormError(null);
  };

  // ── Success state ─────────────────────────────────────────────────────────

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
                setFulfillmentMethod(null);
                setDeliveryBarangay("");
                setDeliveryAddress("");
                setRequestedDate("");
                setPickupDate("");
                setPickupTime("");
                setPaymentMethod("");
                setPaymentReference("");
                setPaymentSenderName("");
                setPaymentGcashNumber("");
                setPaymentGcashAccountName("");
                setPaymentNotes("");
                setSelectedReceivingAccountId("");
                setExpandedBankAccountId(null);
                setReceiptUrl(null);
                setReceiptFileName(null);
                setNotes("");
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

  // ── Empty cart state ──────────────────────────────────────────────────────

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

  // ── Validate form locally before submitting ───────────────────────────────

  const validateLocally = (): boolean => {
    const errors: Record<string, string> = {};

    if (!fulfillmentMethod) {
      errors.fulfillment_method = "Please select a fulfillment option.";
    }

    if (fulfillmentMethod === "DELIVERY") {
      if (!deliveryBarangay.trim()) {
        errors.delivery_barangay = "Please select a barangay.";
      }
      if (!deliveryAddress.trim()) {
        errors.delivery_address = "Please enter your delivery address.";
      }
      if (!requestedDate) {
        errors.requested_date = "Please select a requested delivery date.";
      }
    }

    if (fulfillmentMethod === "PICKUP") {
      if (!pickupDate) {
        errors.requested_date = "Please select a pickup date.";
      }
      if (!pickupTime) {
        errors.pickup_time = "Please select a preferred pickup time.";
      }
    }

    if (!paymentMethod) {
      errors.payment_method = "Please select a payment method.";
    } else {
      if (fulfillmentMethod === "DELIVERY" && paymentMethod === "CASH_ON_PICKUP") {
        errors.payment_method = "Cash on Pick Up is only available for Pick Up orders.";
      }
      if (fulfillmentMethod === "PICKUP" && paymentMethod === "CASH_ON_DELIVERY") {
        errors.payment_method = "Cash on Delivery is only available for Delivery orders.";
      }

      if (paymentMethod === "GCASH") {
        const cleanGcash = paymentGcashNumber.replace(/[\s-]/g, "");
        if (!cleanGcash) {
          errors.payment_gcash_number = "GCash number is required.";
        } else if (!/^(09|\+639)\d{9}$/.test(cleanGcash)) {
          errors.payment_gcash_number =
            "Please enter a valid 11-digit GCash number (e.g. 09171234567).";
        }
        if (!paymentGcashAccountName.trim()) {
          errors.payment_gcash_account_name = "GCash account name is required.";
        }
      }

      if (paymentMethod === "BANK_TRANSFER") {
        if (bankAccounts.length === 0) {
          errors.payment_method =
            "Bank Transfer is currently unavailable because no active receiving bank accounts are configured. Please select another payment method.";
        } else if (!selectedReceivingAccountId) {
          errors.payment_bank_account = "Please select a receiving bank account.";
        }

        const effectiveSenderBank =
          senderBankSelect === "Other"
            ? customSenderBankName.trim()
            : senderBankSelect;

        if (!effectiveSenderBank || effectiveSenderBank.length < 2) {
          errors.payment_bank_name =
            senderBankSelect === "Other"
              ? "Please enter your custom bank name (at least 2 characters)."
              : "Sender bank name is required.";
        }
        if (!paymentSenderName.trim()) {
          errors.payment_sender_name = "Sender account name is required.";
        }
        if (!paymentReference.trim()) {
          errors.payment_reference = "Transaction reference number is required.";
        }
        if (!paymentDate) {
          errors.payment_date = "Payment date is required.";
        }
        const amt = parseFloat(effectivePaymentAmount);
        if (!effectivePaymentAmount || isNaN(amt) || amt <= 0) {
          errors.payment_amount = "A valid amount transferred is required.";
        }
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ── Submit handler ────────────────────────────────────────────────────────

  const handleSubmit = () => {
    if (cart.length === 0 || !fulfillmentMethod || !paymentMethod) return;
    if (!validateLocally()) return;

    setFormError(null);

    startTransition(async () => {
      try {
        const parsedAmount = parseFloat(effectivePaymentAmount);
        const result = await submitCustomerOrder({
          fulfillment_method: fulfillmentMethod,
          payment_method: paymentMethod,
          requested_date:
            fulfillmentMethod === "DELIVERY" ? requestedDate : pickupDate,
          delivery_barangay:
            fulfillmentMethod === "DELIVERY" ? deliveryBarangay : undefined,
          delivery_address:
            fulfillmentMethod === "DELIVERY" ? deliveryAddress : undefined,
          pickup_time:
            fulfillmentMethod === "PICKUP" ? pickupTime : undefined,
          notes: notes.trim() || undefined,
          payment_reference:
            paymentMethod === "GCASH" || paymentMethod === "BANK_TRANSFER"
              ? paymentReference.trim() || undefined
              : undefined,
          payment_date:
            paymentMethod === "GCASH" || paymentMethod === "BANK_TRANSFER"
              ? paymentDate || undefined
              : undefined,
          payment_amount:
            (paymentMethod === "GCASH" || paymentMethod === "BANK_TRANSFER") &&
            !isNaN(parsedAmount) &&
            parsedAmount > 0
              ? parsedAmount
              : undefined,
          payment_bank_name:
            paymentMethod === "BANK_TRANSFER"
              ? (senderBankSelect === "Other"
                  ? customSenderBankName.trim()
                  : senderBankSelect) || undefined
              : undefined,
          payment_bank_transfer_account_id:
            paymentMethod === "BANK_TRANSFER"
              ? selectedReceivingAccountId || undefined
              : undefined,
          payment_sender_name:
            paymentMethod === "BANK_TRANSFER"
              ? paymentSenderName.trim() || undefined
              : undefined,
          payment_gcash_number:
            paymentMethod === "GCASH"
              ? paymentGcashNumber.trim() || undefined
              : undefined,
          payment_gcash_account_name:
            paymentMethod === "GCASH"
              ? paymentGcashAccountName.trim() || undefined
              : undefined,
          payment_receipt_url:
            paymentMethod === "GCASH" || paymentMethod === "BANK_TRANSFER"
              ? receiptUrl || undefined
              : undefined,
          payment_notes:
            paymentMethod === "GCASH" || paymentMethod === "BANK_TRANSFER"
              ? paymentNotes.trim() || undefined
              : undefined,
          items: cart.map((item) => ({
            size: item.size,
            packaging: item.packaging,
            egg_type: item.egg_type ?? "WHITE",
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
          Review your selections, choose how you want to receive your order, then
          submit. Prices shown are indicative estimates confirmed at fulfillment.
        </CardDescription>
      </CardHeader>

      <CardContent className="pt-4 space-y-6">
        {/* ── Line Items Table ────────────────────────────────────────── */}
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
                  <TableRow
                    key={`${item.size}:${item.packaging}:${item.egg_type ?? "WHITE"}`}
                    className="text-xs"
                  >
                    <TableCell className="font-semibold text-foreground">
                      <div className="flex flex-col">
                        <span>{EGG_SIZE_LABELS[item.size]}</span>
                        <span className="text-[10px] font-normal text-muted-foreground">
                          {item.egg_type === "BROWN" ? "Brown Egg" : "White Egg"}
                        </span>
                      </div>
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
                        onClick={() => onRemoveItem(item.size, item.packaging, item.egg_type)}
                        aria-label={`Remove ${EGG_SIZE_LABELS[item.size]} (${item.egg_type === "BROWN" ? "Brown" : "White"}) from cart`}
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

        {/* ── Totals ──────────────────────────────────────────────────── */}
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
            * Estimated total from catalog prices. The farm may adjust pricing at
            confirmation.
          </p>
        </div>

        {/* ── Fulfillment Method Selection ────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center gap-1.5">
            <Label className="text-xs font-semibold text-foreground">
              How would you like to receive your order?
            </Label>
            <span className="text-destructive text-xs">*</span>
          </div>
          <div className="flex gap-3">
            <FulfillmentTab
              method="DELIVERY"
              selected={fulfillmentMethod === "DELIVERY"}
              onSelect={handleMethodChange}
              icon={<Truck className="size-5" />}
              label="Delivery"
              description="Deliver to my address in Butuan City"
            />
            <FulfillmentTab
              method="PICKUP"
              selected={fulfillmentMethod === "PICKUP"}
              onSelect={handleMethodChange}
              icon={<Store className="size-5" />}
              label="Pick Up"
              description="I'll pick up from the farm"
            />
          </div>
          <FieldError message={fieldErrors.fulfillment_method} />
        </div>

        {/* ── DELIVERY Fields ─────────────────────────────────────────── */}
        {fulfillmentMethod === "DELIVERY" && (
          <div className="space-y-4 rounded-xl border border-emerald-500/20 bg-emerald-500/4 p-4">
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
              <Truck className="size-3.5" />
              Delivery Details
            </p>

            {/* Barangay */}
            <div className="space-y-1.5">
              <Label
                htmlFor="delivery-barangay"
                className="text-xs font-medium flex items-center gap-1.5"
              >
                <MapPin className="size-3.5 text-muted-foreground" />
                Barangay{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Select
                value={deliveryBarangay}
                onValueChange={(v) => {
                  setDeliveryBarangay(v ?? "");
                  setFieldErrors((e) => ({ ...e, delivery_barangay: "" }));
                }}
              >
                <SelectTrigger
                  id="delivery-barangay"
                  className="h-8 text-xs"
                  aria-describedby={
                    fieldErrors.delivery_barangay
                      ? "delivery-barangay-error"
                      : undefined
                  }
                >
                  <SelectValue placeholder="Select your barangay…" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  {BUTUAN_BARANGAYS.map((b) => (
                    <SelectItem key={b} value={b} className="text-xs">
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError
                message={fieldErrors.delivery_barangay}
              />
            </div>

            {/* Specific address */}
            <div className="space-y-1.5">
              <Label
                htmlFor="delivery-address"
                className="text-xs font-medium flex items-center gap-1.5"
              >
                <MapPin className="size-3.5 text-muted-foreground" />
                Specific Address{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="delivery-address"
                value={deliveryAddress}
                onChange={(e) => {
                  setDeliveryAddress(e.target.value);
                  setFieldErrors((err) => ({ ...err, delivery_address: "" }));
                }}
                placeholder="House number, street, purok, subdivision, or landmark…"
                className="h-8 text-xs"
                maxLength={500}
                aria-describedby={
                  fieldErrors.delivery_address
                    ? "delivery-address-error"
                    : undefined
                }
              />
              <FieldError message={fieldErrors.delivery_address} />
            </div>

            {/* Requested delivery date */}
            <div className="space-y-1.5">
              <Label
                htmlFor="delivery-date"
                className="text-xs font-medium flex items-center gap-1.5"
              >
                <CalendarDays className="size-3.5 text-muted-foreground" />
                Requested Delivery Date{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="delivery-date"
                type="date"
                value={requestedDate}
                onChange={(e) => {
                  setRequestedDate(e.target.value);
                  setFieldErrors((err) => ({ ...err, requested_date: "" }));
                }}
                min={today}
                className="h-8 text-xs max-w-48"
              />
              <FieldError message={fieldErrors.requested_date} />
            </div>

            {/* Delivery instructions (optional) */}
            <div className="space-y-1.5">
              <Label
                htmlFor="delivery-notes"
                className="text-xs font-medium flex items-center gap-1.5"
              >
                <MessageSquare className="size-3.5 text-muted-foreground" />
                Additional Instructions{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Textarea
                id="delivery-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Gate code, specific contact person, preferred time of day…"
                className="text-xs resize-none h-16"
                maxLength={1000}
              />
              <p className="text-[10px] text-muted-foreground text-right">
                {notes.length}/1000
              </p>
            </div>
          </div>
        )}

        {/* ── PICKUP Fields ───────────────────────────────────────────── */}
        {fulfillmentMethod === "PICKUP" && (
          <div className="space-y-4 rounded-xl border border-blue-500/20 bg-blue-500/4 p-4">
            <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
              <Store className="size-3.5" />
              Pick Up Details
            </p>

            {/* Pickup date */}
            <div className="space-y-1.5">
              <Label
                htmlFor="pickup-date"
                className="text-xs font-medium flex items-center gap-1.5"
              >
                <CalendarDays className="size-3.5 text-muted-foreground" />
                Pickup Date{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="pickup-date"
                type="date"
                value={pickupDate}
                onChange={(e) => {
                  setPickupDate(e.target.value);
                  setFieldErrors((err) => ({ ...err, requested_date: "" }));
                }}
                min={today}
                className="h-8 text-xs max-w-48"
              />
              <FieldError message={fieldErrors.requested_date} />
            </div>

            {/* Preferred pickup time */}
            <div className="space-y-1.5">
              <Label
                htmlFor="pickup-time"
                className="text-xs font-medium flex items-center gap-1.5"
              >
                <Clock className="size-3.5 text-muted-foreground" />
                Preferred Pickup Time{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Select
                value={pickupTime}
                onValueChange={(v) => {
                  setPickupTime(v ?? "");
                  setFieldErrors((e) => ({ ...e, pickup_time: "" }));
                }}
              >
                <SelectTrigger
                  id="pickup-time"
                  className="h-8 text-xs max-w-56"
                >
                  <SelectValue placeholder="Select a time slot…" />
                </SelectTrigger>
                <SelectContent>
                  {PICKUP_TIME_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t} className="text-xs">
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError message={fieldErrors.pickup_time} />

              {/* Staff confirmation note */}
              <div className="flex items-start gap-1.5 mt-2 rounded-lg bg-blue-500/8 border border-blue-500/20 p-2.5">
                <Info className="size-3.5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <p className="text-[10px] text-blue-700 dark:text-blue-300 leading-snug">
                  Your requested pickup time is subject to staff confirmation.
                  The farm team will contact you if your preferred slot is
                  unavailable.
                </p>
              </div>
            </div>

            {/* Pickup instructions (optional) */}
            <div className="space-y-1.5">
              <Label
                htmlFor="pickup-notes"
                className="text-xs font-medium flex items-center gap-1.5"
              >
                <MessageSquare className="size-3.5 text-muted-foreground" />
                Pickup Instructions{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Textarea
                id="pickup-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any special instructions for your pickup…"
                className="text-xs resize-none h-16"
                maxLength={1000}
              />
              <p className="text-[10px] text-muted-foreground text-right">
                {notes.length}/1000
              </p>
            </div>
          </div>
        )}

        {/* ── Payment Method Dropdown Selector ────────────────────────── */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center gap-1.5">
            <Label
              htmlFor="payment-method-selector"
              className="text-xs font-semibold text-foreground flex items-center gap-1.5"
            >
              <Wallet className="size-3.5 text-muted-foreground" />
              Payment Method
            </Label>
            <span className="text-destructive text-xs">*</span>
          </div>

          <Select
            value={paymentMethod}
            onValueChange={(val) => {
              setPaymentMethod(val as CustomerPaymentMethod);
              setFieldErrors((err) => ({
                ...err,
                payment_method: "",
                payment_reference: "",
                payment_date: "",
                payment_amount: "",
                payment_bank_name: "",
                payment_sender_name: "",
              }));
            }}
          >
            <SelectTrigger
              id="payment-method-selector"
              className="w-full h-11 text-xs border border-border/70 rounded-lg px-3.5 bg-background hover:border-emerald-500/70 hover:bg-emerald-500/5 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-colors cursor-pointer flex items-center justify-between"
              aria-describedby={
                fieldErrors.payment_method ? "payment-method-error" : undefined
              }
            >
              <div className="flex items-center gap-2.5 truncate">
                {paymentMethod === "CASH_ON_DELIVERY" && (
                  <Truck className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                )}
                {paymentMethod === "CASH_ON_PICKUP" && (
                  <Store className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                )}
                {paymentMethod === "GCASH" && (
                  <Smartphone className="size-4 text-blue-500 shrink-0" />
                )}
                {paymentMethod === "BANK_TRANSFER" && (
                  <Building2 className="size-4 text-indigo-500 shrink-0" />
                )}
                {!paymentMethod && (
                  <Wallet className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                )}
                <span className="truncate">
                  {paymentMethod
                    ? CUSTOMER_PAYMENT_METHOD_LABELS[paymentMethod]
                    : "Select payment method"}
                </span>
              </div>
            </SelectTrigger>

            <SelectContent className="w-[var(--anchor-width)] min-w-[280px] p-1 rounded-lg border border-border/70 shadow-lg bg-popover">
              {fulfillmentMethod === "PICKUP" ? (
                <SelectItem
                  value="CASH_ON_PICKUP"
                  className="text-xs py-2.5 px-3 rounded-md cursor-pointer hover:bg-emerald-500/10 focus:bg-emerald-500/10 focus:text-foreground"
                >
                  <div className="flex items-center gap-2.5">
                    <Store className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="font-medium">Cash on Pick Up</span>
                  </div>
                </SelectItem>
              ) : (
                <SelectItem
                  value="CASH_ON_DELIVERY"
                  className="text-xs py-2.5 px-3 rounded-md cursor-pointer hover:bg-emerald-500/10 focus:bg-emerald-500/10 focus:text-foreground"
                >
                  <div className="flex items-center gap-2.5">
                    <Truck className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="font-medium">Cash on Delivery</span>
                  </div>
                </SelectItem>
              )}
              <SelectItem
                value="GCASH"
                className="text-xs py-2.5 px-3 rounded-md cursor-pointer hover:bg-blue-500/10 focus:bg-blue-500/10 focus:text-foreground"
              >
                <div className="flex items-center gap-2.5">
                  <Smartphone className="size-4 text-blue-500 shrink-0" />
                  <span className="font-medium">GCash</span>
                </div>
              </SelectItem>
              <SelectItem
                value="BANK_TRANSFER"
                className="text-xs py-2.5 px-3 rounded-md cursor-pointer hover:bg-indigo-500/10 focus:bg-indigo-500/10 focus:text-foreground"
              >
                <div className="flex items-center gap-2.5">
                  <Building2 className="size-4 text-indigo-500 shrink-0" />
                  <span className="font-medium">Bank Transfer</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>

          <FieldError message={fieldErrors.payment_method} />

          {/* ── Cash on Delivery Instructions ─────────────────────────── */}
          {paymentMethod === "CASH_ON_DELIVERY" && (
            <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3.5 space-y-1.5 transition-all">
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                <Truck className="size-3.5" />
                Cash on Delivery Instructions
              </p>
              <p className="text-[11px] text-emerald-700/90 dark:text-emerald-300/90 leading-relaxed">
                Please prepare the exact or near-exact cash amount of{" "}
                <strong className="text-foreground">
                  {DEFAULT_CURRENCY_SYMBOL}{estimatedTotal.toFixed(2)}
                </strong>{" "}
                upon receiving your delivery. Our delivery personnel will collect the payment and issue your receipt directly.
              </p>
            </div>
          )}

          {/* ── Cash on Pick Up Instructions ──────────────────────────── */}
          {paymentMethod === "CASH_ON_PICKUP" && (
            <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/5 p-3.5 space-y-1.5 transition-all">
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                <Store className="size-3.5" />
                Cash on Pick Up Instructions
              </p>
              <p className="text-[11px] text-emerald-700/90 dark:text-emerald-300/90 leading-relaxed">
                Please prepare the cash amount of{" "}
                <strong className="text-foreground">
                  {DEFAULT_CURRENCY_SYMBOL}{estimatedTotal.toFixed(2)}
                </strong>{" "}
                when picking up your order at the farm counter. Our counter team will verify your items and hand over your official receipt.
              </p>
            </div>
          )}

          {/* ── GCash Payment Details Form ─────────────────────────────── */}
          {paymentMethod === "GCASH" && (
            <div className="rounded-xl border border-blue-500/25 bg-blue-500/5 p-4 space-y-4 transition-all">
              <div className="flex items-center justify-between pb-1.5 border-b border-blue-500/20">
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                  <Smartphone className="size-4" />
                  GCash Payment Instructions & Details
                </p>
                <Badge variant="outline" className="text-[10px] border-blue-500/30 text-blue-700 dark:text-blue-300 bg-blue-500/10">
                  Express Send
                </Badge>
              </div>

              {/* ── 1. Farm's Official Receiving Account Card ─────────── */}
              {gcashSettings?.account_number?.trim() && gcashSettings?.account_name?.trim() ? (
                <div className="rounded-lg border-2 border-blue-500/35 bg-background/95 p-3.5 space-y-3 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Store className="size-3.5" />
                      Farm&apos;s Official Receiving Account
                    </span>
                    <Badge className="bg-blue-600 hover:bg-blue-600 text-white text-[9px] px-2 py-0.5 font-medium">
                      Send Payment Here
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-muted/40 rounded-md p-2.5 border border-border/70">
                    <div>
                      <span className="text-[10px] font-medium text-muted-foreground block">
                        Official Account Name
                      </span>
                      <p className="text-xs font-bold text-foreground mt-0.5 break-words">
                        {gcashSettings.account_name}
                      </p>
                    </div>

                    <div>
                      <span className="text-[10px] font-medium text-muted-foreground block">
                        Official Receiving Number
                      </span>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <span className="font-mono text-xs font-bold text-blue-700 dark:text-blue-300">
                          {gcashSettings.account_number}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopyGcashNumber(gcashSettings.account_number!)}
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
                      </div>
                    </div>
                  </div>

                  {/* Order Total to send & Step-by-step instructions */}
                  <div className="rounded-md bg-blue-500/8 border border-blue-500/20 p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-blue-900 dark:text-blue-200">
                        Order Total to Send:
                      </span>
                      <span className="text-sm font-bold text-blue-700 dark:text-blue-300">
                        {DEFAULT_CURRENCY_SYMBOL}{estimatedTotal.toFixed(2)}
                      </span>
                    </div>

                    <div className="pt-1.5 border-t border-blue-500/15 text-[10.5px] text-blue-800/90 dark:text-blue-200/90 leading-relaxed">
                      <p className="font-semibold text-blue-900 dark:text-blue-100 flex items-center gap-1 mb-1">
                        <Info className="size-3 shrink-0" /> How to Pay via GCash:
                      </p>
                      <ol className="list-decimal list-inside space-y-0.5 pl-0.5">
                        <li>Open your <strong>GCash app</strong> and tap <strong>Send Money &rarr; Express Send</strong>.</li>
                        <li>Send exactly <strong>{DEFAULT_CURRENCY_SYMBOL}{estimatedTotal.toFixed(2)}</strong> to <strong>{gcashSettings.account_number}</strong> ({gcashSettings.account_name}).</li>
                        <li>Enter your sender details below and submit your order. You may provide your reference number or screenshot now or after payment.</li>
                      </ol>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
                    <AlertCircle className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                    <span>GCash payment details are not configured yet</span>
                  </div>
                  <p className="text-[11px] text-amber-700/90 dark:text-amber-300/90 leading-relaxed">
                    The farm administrator has not configured the official GCash receiving account. You may still enter your GCash details below to place your order, and staff will coordinate payment with you.
                  </p>
                </div>
              )}

              {/* ── 2. Customer's Sender Details Section ────────────────── */}
              <div className="pt-2 border-t border-blue-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <Smartphone className="size-3.5 text-blue-600 dark:text-blue-400" />
                    Your GCash Account Details (Sender Information)
                  </p>
                  <span className="text-[10px] text-muted-foreground">
                    Required for payment matching
                  </span>
                </div>

                {/* GCash Number and Account Name (Required) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="gcash-number" className="text-xs font-medium">
                      Your GCash Number <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="gcash-number"
                      type="tel"
                      value={paymentGcashNumber}
                      onChange={(e) => {
                        setPaymentGcashNumber(e.target.value);
                        setFieldErrors((err) => ({ ...err, payment_gcash_number: "" }));
                      }}
                      placeholder="09XXXXXXXXX (11 digits)"
                      maxLength={20}
                      className="h-8 text-xs font-mono"
                    />
                    <FieldError message={fieldErrors.payment_gcash_number} />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="gcash-account-name" className="text-xs font-medium">
                      Your GCash Account Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="gcash-account-name"
                      value={paymentGcashAccountName}
                      onChange={(e) => {
                        setPaymentGcashAccountName(e.target.value);
                        setFieldErrors((err) => ({ ...err, payment_gcash_account_name: "" }));
                      }}
                      placeholder="Account holder name"
                      maxLength={150}
                      className="h-8 text-xs"
                    />
                    <FieldError message={fieldErrors.payment_gcash_account_name} />
                  </div>
                </div>

                {/* Transaction Reference (Optional) & Payment Date */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="gcash-reference" className="text-xs font-medium">
                      Transaction Reference <span className="text-muted-foreground font-normal">(optional)</span>
                    </Label>
                    <Input
                      id="gcash-reference"
                      value={paymentReference}
                      onChange={(e) => {
                        setPaymentReference(e.target.value);
                        setFieldErrors((err) => ({ ...err, payment_reference: "" }));
                      }}
                      placeholder="e.g. 100234567890 (if paid)"
                      className="h-8 text-xs font-mono"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      Leave blank if you have not made payment yet.
                    </p>
                    <FieldError message={fieldErrors.payment_reference} />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="gcash-date" className="text-xs font-medium">
                      Payment Date <span className="text-muted-foreground font-normal">(optional)</span>
                    </Label>
                    <Input
                      id="gcash-date"
                      type="date"
                      value={paymentDate}
                      onChange={(e) => {
                        setPaymentDate(e.target.value);
                        setFieldErrors((err) => ({ ...err, payment_date: "" }));
                      }}
                      max={today}
                      className="h-8 text-xs"
                    />
                    <FieldError message={fieldErrors.payment_date} />
                  </div>
                </div>

                {/* Amount Paid */}
                <div className="space-y-1">
                  <Label htmlFor="gcash-amount" className="text-xs font-medium">
                    Amount ({DEFAULT_CURRENCY_SYMBOL}) <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <Input
                    id="gcash-amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={effectivePaymentAmount}
                    onChange={(e) => {
                      setPaymentAmount(e.target.value);
                      setFieldErrors((err) => ({ ...err, payment_amount: "" }));
                    }}
                    placeholder="0.00"
                    className="h-8 text-xs font-mono"
                  />
                  <FieldError message={fieldErrors.payment_amount} />
                </div>

                {/* Optional Screenshot Upload */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium flex items-center justify-between">
                    <span>Payment Screenshot <span className="text-muted-foreground font-normal">(optional)</span></span>
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
                    <label className="flex items-center justify-center gap-2 border border-dashed border-blue-500/30 rounded-lg p-3 bg-background/40 hover:bg-background/80 hover:border-blue-500/50 cursor-pointer transition-colors text-xs text-muted-foreground">
                      <Upload className="size-4 text-blue-500" />
                      <span>Upload GCash receipt / screenshot</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={handleReceiptFileChange}
                        className="hidden"
                      />
                    </label>
                  ) : (
                    <div className="flex items-center gap-3 bg-background/60 rounded-lg p-2 border border-blue-500/20">
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

                {/* Optional Notes */}
                <div className="space-y-1">
                  <Label htmlFor="gcash-notes" className="text-xs font-medium">
                    Payment Notes <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <Textarea
                    id="gcash-notes"
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    placeholder="Sender name, last 4 digits of number, etc."
                    className="text-xs h-16 resize-none"
                    maxLength={500}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Bank Transfer Details Form ─────────────────────────────── */}
          {paymentMethod === "BANK_TRANSFER" && (
            <div className="rounded-xl border border-indigo-500/25 bg-indigo-500/5 p-4 space-y-4 transition-all">
              <div className="flex items-center justify-between pb-1.5 border-b border-indigo-500/20">
                <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                  <Building2 className="size-4" />
                  Bank Transfer Payment
                </p>
                <Badge variant="outline" className="text-[10px] border-indigo-500/30 text-indigo-700 dark:text-indigo-300 bg-indigo-500/10">
                  Verification Required
                </Badge>
              </div>

              {/* No active accounts warning */}
              {bankAccounts.length === 0 ? (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-800 dark:text-amber-300">
                    <AlertCircle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                    <span>Bank Transfer Currently Unavailable</span>
                  </div>
                  <p className="text-xs text-amber-700/90 dark:text-amber-300/90 leading-relaxed">
                    The farm administrator has not configured any active bank receiving accounts.
                    Please choose another payment method above (such as Cash on Delivery, Cash on Pick Up, or GCash) to place your order.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* ── A. Select Receiving Bank (Single-Expandable Accordion) ── */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-[11px] font-bold text-indigo-900 dark:text-indigo-200 uppercase tracking-wider flex items-center gap-1.5">
                        <Building2 className="size-3.5 text-indigo-600 dark:text-indigo-400" />
                        POULTRY HUB Receiving Bank Account
                      </Label>
                      <Badge className="bg-indigo-600 hover:bg-indigo-600 text-white text-[9px] px-2 py-0.5 font-medium">
                        Transfer Payment Here
                      </Badge>
                    </div>

                    <p className="text-[11px] text-muted-foreground">
                      {bankAccounts.length === 1
                        ? "Select the farm's official receiving bank account below to view deposit details:"
                        : "Select which official POULTRY HUB receiving bank account you are transferring to:"}
                    </p>

                    <div className="flex flex-col gap-2.5" role="region" aria-label="Available receiving bank accounts">
                      {bankAccounts.map((account) => {
                        const isExpanded = expandedBankAccountId === account.id;
                        const isSelected = selectedReceivingAccountId === account.id;

                        return (
                          <div
                            key={account.id}
                            className={cn(
                              "rounded-xl border transition-all duration-200 overflow-hidden",
                              isSelected
                                ? "border-indigo-600 dark:border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/30 ring-2 ring-indigo-500/30 shadow-xs"
                                : "border-border/70 bg-card hover:border-indigo-400/50 hover:bg-indigo-50/15 dark:hover:bg-indigo-950/20"
                            )}
                          >
                            {/* Bank Header / Accordion Trigger */}
                            <button
                              type="button"
                              id={`receiving-bank-${account.id}`}
                              aria-expanded={isExpanded}
                              aria-controls={`receiving-bank-panel-${account.id}`}
                              aria-label={`${account.bank_name}${isSelected ? " (Selected)" : ""}`}
                              onClick={() => handleToggleBank(account.id)}
                              className="w-full flex items-center justify-between p-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 cursor-pointer select-none"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div
                                  className={cn(
                                    "size-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                                    isSelected
                                      ? "bg-indigo-600 text-white shadow-xs"
                                      : "bg-muted text-muted-foreground"
                                  )}
                                >
                                  <Building2 className="size-4" />
                                </div>
                                <div className="min-w-0 flex items-center gap-2">
                                  <span className="text-sm font-bold text-foreground truncate">
                                    {account.bank_name}
                                  </span>
                                  {isSelected && (
                                    <Badge className="bg-indigo-600 text-white dark:bg-indigo-500 text-[10px] h-4.5 px-2 font-medium shrink-0 flex items-center gap-1 shadow-xs">
                                      <Check className="size-3" />
                                      <span>Selected</span>
                                    </Badge>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                <ChevronDown
                                  className={cn(
                                    "size-4 text-muted-foreground transition-transform duration-200",
                                    isExpanded && "rotate-180 text-indigo-600 dark:text-indigo-400"
                                  )}
                                  aria-hidden="true"
                                />
                              </div>
                            </button>

                            {/* Expanded Bank Details */}
                            {isExpanded && (
                              <div
                                id={`receiving-bank-panel-${account.id}`}
                                role="region"
                                aria-labelledby={`receiving-bank-${account.id}`}
                                className="px-3.5 pb-3.5 pt-0 border-t border-border/40 animate-in fade-in-50 duration-200 space-y-3"
                              >
                                <div className="pt-2.5">
                                  <p className="text-xs text-muted-foreground">
                                    Account Holder:{" "}
                                    <strong className="text-foreground font-semibold">
                                      {account.account_holder_name}
                                    </strong>
                                  </p>
                                </div>

                                {/* Account Number & Copy Button */}
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-background/95 rounded-lg p-2.5 border border-border/70 shadow-2xs">
                                  <div>
                                    <span className="text-[10px] uppercase font-semibold tracking-wider text-muted-foreground block">
                                      Account Number
                                    </span>
                                    <span className="font-mono text-xs sm:text-sm font-bold text-indigo-700 dark:text-indigo-300 tracking-wider">
                                      {account.account_number}
                                    </span>
                                  </div>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    id={`copy-acc-btn-${account.id}`}
                                    aria-label={`Copy account number for ${account.bank_name}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCopyBankAccountNumber(account.id, account.account_number);
                                    }}
                                    className="h-7 px-2.5 text-[11px] gap-1.5 border-indigo-500/30 hover:bg-indigo-500/10 hover:text-indigo-700 dark:hover:text-indigo-300 shrink-0 font-medium self-start sm:self-auto cursor-pointer"
                                  >
                                    {copiedBankAccountId === account.id ? (
                                      <>
                                        <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                          Copied!
                                        </span>
                                      </>
                                    ) : (
                                      <>
                                        <Copy className="size-3.5 text-indigo-600 dark:text-indigo-400" />
                                        <span>Copy Account Number</span>
                                      </>
                                    )}
                                  </Button>
                                </div>

                                {/* Optional Instructions */}
                                {account.instructions && (
                                  <div className="text-[11px] text-muted-foreground bg-muted/40 p-2.5 rounded-lg border border-border/40 leading-relaxed">
                                    <strong className="font-semibold text-foreground">Instructions:</strong>{" "}
                                    {account.instructions}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <FieldError message={fieldErrors.payment_bank_account} />
                  </div>

                  {/* ── B. Payment Amount ── */}
                  <div className="rounded-md bg-indigo-500/8 border border-indigo-500/20 p-2.5 space-y-1">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-indigo-900 dark:text-indigo-200">Required Order Total:</span>
                      <span className="text-sm font-bold text-indigo-700 dark:text-indigo-300">
                        {DEFAULT_CURRENCY_SYMBOL}{estimatedTotal.toFixed(2)}
                      </span>
                    </div>
                    <p className="text-[10.5px] text-indigo-800/90 dark:text-indigo-200/90 leading-snug">
                      Transfer this exact amount to the selected receiving bank account above before submitting your details below.
                    </p>
                  </div>

                  {/* ── C. Customer Sender Information ── */}
                  <div className="pt-2 border-t border-indigo-500/20 space-y-3">
                    <div>
                      <p className="text-xs font-bold text-foreground">
                        Your Sender Account Details
                      </p>
                      <p className="text-[10.5px] text-muted-foreground mt-0.5">
                        Provide the bank account information you transferred from so our staff can match and verify your payment.
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Sending Bank Selection */}
                      <div className="space-y-1">
                        <Label htmlFor="sender-bank-select" className="text-xs font-medium">
                          Your Bank (Sender) <span className="text-destructive">*</span>
                        </Label>
                        <Select
                          value={senderBankSelect}
                          onValueChange={(val) => {
                            setSenderBankSelect(val as SupportedBankOption);
                            setFieldErrors((err) => ({ ...err, payment_bank_name: "" }));
                          }}
                        >
                          <SelectTrigger id="sender-bank-select" className="h-8 text-xs">
                            <SelectValue placeholder="Select your bank" />
                          </SelectTrigger>
                          <SelectContent>
                            {SUPPORTED_BANK_OPTIONS.map((opt) => (
                              <SelectItem key={opt} value={opt} className="text-xs">
                                {opt}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FieldError message={fieldErrors.payment_bank_name} />
                      </div>

                      {/* Custom Bank Name if "Other" */}
                      {senderBankSelect === "Other" ? (
                        <div className="space-y-1">
                          <Label htmlFor="custom-sender-bank-name" className="text-xs font-medium">
                            Custom Bank Name <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id="custom-sender-bank-name"
                            value={customSenderBankName}
                            onChange={(e) => {
                              setCustomSenderBankName(e.target.value);
                              setFieldErrors((err) => ({ ...err, payment_bank_name: "" }));
                            }}
                            placeholder="e.g. Maya Bank, GoTyme, CIMB"
                            maxLength={100}
                            className="h-8 text-xs"
                          />
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <Label htmlFor="sender-name" className="text-xs font-medium">
                            Sender Account Holder Name <span className="text-destructive">*</span>
                          </Label>
                          <Input
                            id="sender-name"
                            value={paymentSenderName}
                            onChange={(e) => {
                              setPaymentSenderName(e.target.value);
                              setFieldErrors((err) => ({ ...err, payment_sender_name: "" }));
                            }}
                            placeholder="Full name on your bank account"
                            className="h-8 text-xs"
                          />
                          <FieldError message={fieldErrors.payment_sender_name} />
                        </div>
                      )}
                    </div>

                    {senderBankSelect === "Other" && (
                      <div className="space-y-1">
                        <Label htmlFor="sender-name-other" className="text-xs font-medium">
                          Sender Account Holder Name <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="sender-name-other"
                          value={paymentSenderName}
                          onChange={(e) => {
                            setPaymentSenderName(e.target.value);
                            setFieldErrors((err) => ({ ...err, payment_sender_name: "" }));
                          }}
                          placeholder="Full name on your bank account"
                          className="h-8 text-xs"
                        />
                        <FieldError message={fieldErrors.payment_sender_name} />
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Reference Number */}
                      <div className="space-y-1">
                        <Label htmlFor="bank-reference" className="text-xs font-medium">
                          Transaction Reference Number <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="bank-reference"
                          value={paymentReference}
                          onChange={(e) => {
                            setPaymentReference(e.target.value);
                            setFieldErrors((err) => ({ ...err, payment_reference: "" }));
                          }}
                          placeholder="Bank trace / reference number"
                          className="h-8 text-xs font-mono"
                        />
                        <FieldError message={fieldErrors.payment_reference} />
                      </div>

                      {/* Payment Date */}
                      <div className="space-y-1">
                        <Label htmlFor="bank-date" className="text-xs font-medium">
                          Transfer Date <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id="bank-date"
                          type="date"
                          value={paymentDate}
                          onChange={(e) => {
                            setPaymentDate(e.target.value);
                            setFieldErrors((err) => ({ ...err, payment_date: "" }));
                          }}
                          max={today}
                          className="h-8 text-xs"
                        />
                        <FieldError message={fieldErrors.payment_date} />
                      </div>
                    </div>

                    {/* Amount Transferred */}
                    <div className="space-y-1">
                      <Label htmlFor="bank-amount" className="text-xs font-medium">
                        Amount Transferred ({DEFAULT_CURRENCY_SYMBOL}) <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="bank-amount"
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={effectivePaymentAmount}
                        onChange={(e) => {
                          setPaymentAmount(e.target.value);
                          setFieldErrors((err) => ({ ...err, payment_amount: "" }));
                        }}
                        placeholder="0.00"
                        className="h-8 text-xs font-mono"
                      />
                      <FieldError message={fieldErrors.payment_amount} />
                    </div>

                    {/* ── D. Proof of Payment (Receipt Upload) ── */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium flex items-center justify-between">
                        <span>Transfer Receipt / Deposit Slip <span className="text-muted-foreground font-normal">(optional screenshot)</span></span>
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
                        <label className="flex items-center justify-center gap-2 border border-dashed border-indigo-500/30 rounded-lg p-3 bg-background/40 hover:bg-background/80 hover:border-indigo-500/50 cursor-pointer transition-colors text-xs text-muted-foreground">
                          <Upload className="size-4 text-indigo-500" />
                          <span>Upload deposit slip or transfer receipt screenshot</span>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            onChange={handleReceiptFileChange}
                            className="hidden"
                          />
                        </label>
                      ) : (
                        <div className="flex items-center gap-3 bg-background/60 rounded-lg p-2 border border-indigo-500/20">
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

                    {/* Optional Notes */}
                    <div className="space-y-1">
                      <Label htmlFor="bank-notes" className="text-xs font-medium">
                        Payment Notes <span className="text-muted-foreground font-normal">(optional)</span>
                      </Label>
                      <Textarea
                        id="bank-notes"
                        value={paymentNotes}
                        onChange={(e) => setPaymentNotes(e.target.value)}
                        placeholder="Branch, transfer remarks, or additional notes for staff…"
                        className="text-xs h-16 resize-none"
                        maxLength={500}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Error Display ──────────────────────────────────────────── */}
        {formError && (
          <Alert className="border-destructive/30 bg-destructive/5">
            <AlertCircle className="size-4 text-destructive" />
            <AlertDescription className="text-xs text-destructive/90">
              {formError}
            </AlertDescription>
          </Alert>
        )}

        {/* ── Actions ────────────────────────────────────────────────── */}
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
