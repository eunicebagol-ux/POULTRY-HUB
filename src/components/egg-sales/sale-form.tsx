"use client";

import * as React from "react";
import { Plus, Trash2, UserPlus, AlertCircle, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  EGG_SIZES,
  EGG_SIZE_LABELS,
  PACKAGING_TYPES,
  PACKAGING_LABELS,
  PACKAGING_MULTIPLIERS,
  DEFAULT_CURRENCY_SYMBOL,
} from "@/lib/constants";
import {
  recordEggSaleSchema,
  type EggSaleItemInput,
  type RecordEggSaleInput,
} from "@/lib/validations/egg-sales";
import {
  recordEggSale,
  type CustomerOption,
  type EggStockLevel,
} from "@/actions/egg-sales";
import { CustomerDialog } from "@/components/egg-sales/customer-dialog";
import type { EggSize, PackagingType } from "@/types";

interface SaleFormProps {
  customers: CustomerOption[];
  inventory: EggStockLevel[];
  onSaleSuccess?: () => void;
}

interface FormLineItem {
  id: string; // client id for React key
  size: EggSize;
  packaging: PackagingType;
  packageQuantity: string;
  unitPrice: string;
}

const DEFAULT_LINE_ITEM: FormLineItem = {
  id: "item-1",
  size: "LARGE",
  packaging: "TRAY_30",
  packageQuantity: "1",
  unitPrice: "240",
};

export function SaleForm({ customers: initialCustomers, inventory, onSaleSuccess }: SaleFormProps) {
  const [extraCustomers, setExtraCustomers] = React.useState<CustomerOption[]>([]);
  const customers = React.useMemo(
    () => [...initialCustomers, ...extraCustomers],
    [initialCustomers, extraCustomers]
  );
  const [selectedCustomerId, setSelectedCustomerId] = React.useState<string>(
    initialCustomers.length > 0 ? initialCustomers[0].id : ""
  );
  // Auto-resolve customerId if selectedCustomerId is empty but customers exist
  const customerId = selectedCustomerId || (customers.length > 0 ? customers[0].id : "");

  const [saleDate, setSaleDate] = React.useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [invoiceNumber, setInvoiceNumber] = React.useState<string>("");
  const [discountInput, setDiscountInput] = React.useState<string>("0");
  const [notes, setNotes] = React.useState<string>("");
  const [lineItems, setLineItems] = React.useState<FormLineItem[]>([DEFAULT_LINE_ITEM]);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [isPending, setIsPending] = React.useState<boolean>(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = React.useState<boolean>(false);

  // Inventory lookup map
  const stockMap = React.useMemo(() => {
    const map = new Map<EggSize, number>();
    for (const inv of inventory) {
      map.set(inv.size, inv.stock_pieces);
    }
    return map;
  }, [inventory]);

  // ── Line item actions ──────────────────────────────────────────────────────

  function addLineItem() {
    const newItem: FormLineItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      size: "LARGE",
      packaging: "TRAY_30",
      packageQuantity: "1",
      unitPrice: "240",
    };
    setLineItems((prev) => [...prev, newItem]);
  }

  function removeLineItem(index: number) {
    if (lineItems.length <= 1) {
      toast.warning("A sale must contain at least one line item.");
      return;
    }
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  }

  function updateLineItem(
    index: number,
    field: keyof FormLineItem,
    value: string
  ) {
    setLineItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  // ── Financial Previews (Client UX only — PostgreSQL RPC is the final authority) ──

  const calculatedItems = React.useMemo(() => {
    return lineItems.map((item) => {
      const qty = parseInt(item.packageQuantity, 10) || 0;
      const price = parseFloat(item.unitPrice) || 0;
      const multiplier = PACKAGING_MULTIPLIERS[item.packaging] ?? 1;
      const totalPieces = qty * multiplier;
      const lineTotal = qty * price;
      const availablePieces = stockMap.get(item.size) ?? 0;
      const isLowStock = totalPieces > availablePieces;

      return {
        ...item,
        qty,
        price,
        totalPieces,
        lineTotal,
        availablePieces,
        isLowStock,
      };
    });
  }, [lineItems, stockMap]);

  const previewSubtotal = calculatedItems.reduce(
    (sum, item) => sum + item.lineTotal,
    0
  );
  const previewDiscount = parseFloat(discountInput) || 0;
  const previewGrandTotal = Math.max(0, previewSubtotal - previewDiscount);
  const previewTotalPieces = calculatedItems.reduce(
    (sum, item) => sum + item.totalPieces,
    0
  );

  // ── Handle Submit ──────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    if (!customerId) {
      setErrors({ customer_id: "Please select or create a customer first." });
      return;
    }

    const formattedItems: EggSaleItemInput[] = calculatedItems.map((item) => ({
      size: item.size,
      packaging: item.packaging,
      package_quantity: item.qty,
      unit_price: item.price,
    }));

    const inputData: RecordEggSaleInput = {
      customer_id: customerId,
      sale_date: saleDate,
      invoice_number: invoiceNumber.trim() || undefined,
      discount: previewDiscount,
      notes: notes.trim() || undefined,
      items: formattedItems,
    };

    const parsed = recordEggSaleSchema.safeParse(inputData);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".") || "form";
        if (!fieldErrors[key]) {
          fieldErrors[key] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }

    setIsPending(true);
    const result = await recordEggSale(parsed.data);
    setIsPending(false);

    if (!result.success) {
      toast.error("Sale recording failed", {
        description: result.error,
      });
      return;
    }

    toast.success("Egg sale recorded successfully", {
      description: `Sale total: ${DEFAULT_CURRENCY_SYMBOL}${previewGrandTotal.toLocaleString(
        undefined,
        { minimumFractionDigits: 2 }
      )} · Egg inventory deducted atomically.`,
    });

    // Reset form to defaults
    setInvoiceNumber("");
    setDiscountInput("0");
    setNotes("");
    setLineItems([
      {
        id: `item-${Date.now()}`,
        size: "LARGE",
        packaging: "TRAY_30",
        packageQuantity: "1",
        unitPrice: "240",
      },
    ]);

    if (onSaleSuccess) {
      onSaleSuccess();
    }
  }

  function handleCustomerCreated(newCustomer: CustomerOption) {
    setExtraCustomers((prev) => [...prev, newCustomer]);
    setSelectedCustomerId(newCustomer.id);
  }

  return (
    <>
      <Card className="border-border/60 shadow-xs">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <ShoppingCart className="size-4 text-teal-600" />
                Record New Egg Sale
              </CardTitle>
              <CardDescription className="text-xs">
                Creates sales invoice and atomically decrements egg inventory balances in PostgreSQL.
              </CardDescription>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCustomerModalOpen(true)}
              className="text-xs"
            >
              <UserPlus className="mr-1.5 size-3.5" />
              New Customer
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* ── Empty Customer Alert ────────────────────────────────────── */}
            {customers.length === 0 && (
              <Alert variant="destructive" className="bg-amber-50/80 border-amber-300 text-amber-900 dark:bg-amber-950/20 dark:border-amber-900/50 dark:text-amber-300">
                <AlertCircle className="size-4" />
                <AlertTitle className="text-xs font-semibold">No active customers in directory</AlertTitle>
                <AlertDescription className="text-xs mt-1">
                  You must add a customer business record before recording a sale.{" "}
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="p-0 h-auto font-semibold text-amber-900 dark:text-amber-200 underline"
                    onClick={() => setIsCustomerModalOpen(true)}
                  >
                    Click here to create a customer now.
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            {/* ── Header details: Customer, Date, Invoice # ──────────────── */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {/* Customer */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="sale-customer-select" className="text-xs">
                    Customer / Buyer <span className="text-destructive">*</span>
                  </Label>
                </div>
                <Select
                  value={customerId}
                  onValueChange={(val) => { if (val != null) setSelectedCustomerId(val); }}
                  disabled={isPending || customers.length === 0}
                >
                  <SelectTrigger id="sale-customer-select">
                    <SelectValue placeholder={customers.length === 0 ? "No customers available" : "Select customer"} />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name} {c.contact_person ? `(${c.contact_person})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors["customer_id"] && (
                  <p className="text-xs text-destructive">{errors["customer_id"]}</p>
                )}
              </div>

              {/* Sale Date */}
              <div className="space-y-1.5">
                <Label htmlFor="sale-date-input" className="text-xs">
                  Sale Date <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="sale-date-input"
                  type="date"
                  value={saleDate}
                  onChange={(e) => setSaleDate(e.target.value)}
                  disabled={isPending}
                />
                {errors["sale_date"] && (
                  <p className="text-xs text-destructive">{errors["sale_date"]}</p>
                )}
              </div>

              {/* Invoice Number */}
              <div className="space-y-1.5">
                <Label htmlFor="sale-invoice-input" className="text-xs">
                  Invoice Number <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  id="sale-invoice-input"
                  placeholder="e.g. INV-2026-001"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  disabled={isPending}
                />
                {errors["invoice_number"] && (
                  <p className="text-xs text-destructive">{errors["invoice_number"]}</p>
                )}
              </div>
            </div>

            {/* ── Line Items Builder ───────────────────────────────────────── */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                  Sale Line Items
                </h3>
                <span className="text-xs text-muted-foreground">
                  Available stock shown per size
                </span>
              </div>

              <div className="space-y-3">
                {calculatedItems.map((item, index) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-2 rounded-lg border border-border/60 bg-muted/20 p-3 sm:flex-row sm:items-center sm:gap-3"
                  >
                    {/* Size selector */}
                    <div className="flex-1 space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Egg Size</Label>
                      <Select
                        value={item.size}
                        onValueChange={(val) => { if (val != null) updateLineItem(index, "size", val); }}
                        disabled={isPending}
                      >
                        <SelectTrigger className="text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {EGG_SIZES.map((s) => {
                            const avail = stockMap.get(s) ?? 0;
                            return (
                              <SelectItem key={s} value={s} className="text-xs">
                                <span>{EGG_SIZE_LABELS[s]}</span>
                                <span className="ml-2 text-[10px] text-muted-foreground">
                                  ({avail.toLocaleString()} pcs avail)
                                </span>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Packaging selector */}
                    <div className="w-full sm:w-36 space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Packaging</Label>
                      <Select
                        value={item.packaging}
                        onValueChange={(val) => { if (val != null) updateLineItem(index, "packaging", val); }}
                        disabled={isPending}
                      >
                        <SelectTrigger className="text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PACKAGING_TYPES.map((pkg) => (
                            <SelectItem key={pkg} value={pkg} className="text-xs">
                              {PACKAGING_LABELS[pkg]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Quantity */}
                    <div className="w-full sm:w-24 space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Package Qty</Label>
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        value={item.packageQuantity}
                        onChange={(e) => updateLineItem(index, "packageQuantity", e.target.value)}
                        disabled={isPending}
                        className="text-xs text-right"
                      />
                    </div>

                    {/* Unit Price */}
                    <div className="w-full sm:w-28 space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Unit Price (₱)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) => updateLineItem(index, "unitPrice", e.target.value)}
                        disabled={isPending}
                        className="text-xs text-right"
                      />
                    </div>

                    {/* Line Preview (Pieces & Total) */}
                    <div className="flex items-center justify-between sm:flex-col sm:items-end w-full sm:w-32 pt-1 sm:pt-0">
                      <span className="text-[11px] text-muted-foreground">
                        {item.totalPieces.toLocaleString()} pcs
                      </span>
                      <span className="text-xs font-semibold tabular-nums text-foreground">
                        {DEFAULT_CURRENCY_SYMBOL}{item.lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>

                    {/* Remove button */}
                    <div className="flex justify-end sm:justify-center pt-1 sm:pt-4">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLineItem(index)}
                        disabled={isPending || lineItems.length <= 1}
                        className="size-7 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {errors["items"] && (
                <p className="text-xs text-destructive">{errors["items"]}</p>
              )}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addLineItem}
                disabled={isPending}
                className="text-xs w-full sm:w-auto"
              >
                <Plus className="mr-1.5 size-3.5" />
                Add Line Item
              </Button>
            </div>

            {/* ── Financial Summary & Notes ───────────────────────────────── */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 pt-2 border-t">
              {/* Notes */}
              <div className="space-y-1.5">
                <Label htmlFor="sale-notes-textarea" className="text-xs">
                  Sale Notes <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Textarea
                  id="sale-notes-textarea"
                  placeholder="Payment notes, delivery terms, or customer remarks…"
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={isPending}
                  className="text-xs"
                />
              </div>

              {/* Totals Preview Card */}
              <div className="rounded-xl border border-border/60 bg-muted/10 p-4 space-y-2.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Total Eggs (Pieces):</span>
                  <span className="font-semibold text-foreground tabular-nums">
                    {previewTotalPieces.toLocaleString()} pcs
                  </span>
                </div>

                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Subtotal:</span>
                  <span className="font-semibold text-foreground tabular-nums">
                    {DEFAULT_CURRENCY_SYMBOL}{previewSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Discount (₱):</span>
                  <div className="w-28">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={discountInput}
                      onChange={(e) => setDiscountInput(e.target.value)}
                      disabled={isPending}
                      className="text-xs text-right h-7"
                    />
                  </div>
                </div>

                <div className="border-t pt-2 flex justify-between items-baseline">
                  <span className="text-sm font-bold text-foreground">Grand Total:</span>
                  <span className="text-lg font-bold text-teal-600 dark:text-teal-400 tabular-nums">
                    {DEFAULT_CURRENCY_SYMBOL}{previewGrandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                <p className="text-[10px] text-muted-foreground pt-1">
                  * Totals, inventory deductions, and transaction ledger entries are enforced atomically in PostgreSQL.
                </p>
              </div>
            </div>

            {/* ── Submit Button ────────────────────────────────────────────── */}
            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="submit"
                disabled={isPending || customers.length === 0}
                className="bg-teal-600 hover:bg-teal-700 text-white min-w-36"
              >
                {isPending ? "Processing Sale…" : "Record Sale"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Quick Customer Creation Modal */}
      <CustomerDialog
        open={isCustomerModalOpen}
        onOpenChange={setIsCustomerModalOpen}
        onCustomerCreated={handleCustomerCreated}
      />
    </>
  );
}
