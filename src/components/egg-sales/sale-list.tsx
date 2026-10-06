"use client";

import * as React from "react";
import { ShoppingBag, Eye, FileText, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  EGG_SIZE_LABELS,
  PACKAGING_LABELS,
  DEFAULT_CURRENCY_SYMBOL,
} from "@/lib/constants";
import type { EggSaleView } from "@/actions/egg-sales";

interface SaleListProps {
  sales: EggSaleView[];
}

export function SaleList({ sales }: SaleListProps) {
  const [selectedSale, setSelectedSale] = React.useState<EggSaleView | null>(null);

  if (sales.length === 0) {
    return (
      <Card className="border-border/60 shadow-xs">
        <CardContent className="py-14 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground/60">
              <ShoppingBag className="size-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                No egg sales recorded yet
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-sm mx-auto">
                Once recorded, sales invoices, itemized packaging breakdowns, and customer transaction links will appear here.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-border/60 shadow-xs overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Sale Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Items Sold</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
                <TableHead className="text-right">Discount</TableHead>
                <TableHead className="text-right">Total Amount</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.map((sale) => {
                const totalPieces = sale.items.reduce(
                  (sum, item) => sum + item.total_pieces,
                  0
                );
                const itemsCount = sale.items.length;

                return (
                  <TableRow key={sale.id}>
                    {/* Invoice */}
                    <TableCell className="font-mono text-xs font-medium text-foreground">
                      {sale.invoice_number ? (
                        <span className="flex items-center gap-1.5">
                          <FileText className="size-3 text-muted-foreground" />
                          {sale.invoice_number}
                        </span>
                      ) : (
                        <span className="text-muted-foreground italic">Auto</span>
                      )}
                    </TableCell>

                    {/* Sale Date */}
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(sale.sale_date).toLocaleDateString("en-PH", {
                        dateStyle: "medium",
                      })}
                    </TableCell>

                    {/* Customer */}
                    <TableCell>
                      <div className="text-xs font-medium text-foreground">
                        {sale.customer?.name ?? "Direct Buyer"}
                      </div>
                      {sale.customer?.contact_person && (
                        <div className="text-[11px] text-muted-foreground">
                          {sale.customer.contact_person}
                        </div>
                      )}
                    </TableCell>

                    {/* Items Sold */}
                    <TableCell>
                      <Badge variant="secondary" className="text-[11px] font-normal">
                        {itemsCount} {itemsCount === 1 ? "line" : "lines"} · {totalPieces.toLocaleString()} pcs
                      </Badge>
                    </TableCell>

                    {/* Subtotal */}
                    <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                      {DEFAULT_CURRENCY_SYMBOL}{sale.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>

                    {/* Discount */}
                    <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                      {sale.discount > 0 ? (
                        <span className="text-rose-600 dark:text-rose-400">
                          -{DEFAULT_CURRENCY_SYMBOL}{sale.discount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>

                    {/* Total Amount */}
                    <TableCell className="text-right tabular-nums text-xs font-bold text-teal-700 dark:text-teal-400">
                      {DEFAULT_CURRENCY_SYMBOL}{sale.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>

                    {/* Status */}
                    <TableCell className="text-center">
                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300/40 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] gap-1">
                        <CheckCircle2 className="size-2.5" />
                        {sale.status}
                      </Badge>
                    </TableCell>

                    {/* Action */}
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedSale(sale)}
                        className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <Eye className="mr-1 size-3.5" />
                        Details
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── Line Items Details Dialog ────────────────────────────────────── */}
      <Dialog
        open={Boolean(selectedSale)}
        onOpenChange={(open) => {
          if (!open) setSelectedSale(null);
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center justify-between">
              <span>Sale Invoice Breakdown</span>
              {selectedSale?.invoice_number && (
                <span className="font-mono text-xs font-normal text-muted-foreground">
                  {selectedSale.invoice_number}
                </span>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Customer:{" "}
              <strong className="text-foreground">
                {selectedSale?.customer?.name ?? "Direct Buyer"}
              </strong>{" "}
              · Date:{" "}
              {selectedSale &&
                new Date(selectedSale.sale_date).toLocaleDateString("en-PH", {
                  dateStyle: "medium",
                })}
            </DialogDescription>
          </DialogHeader>

          {selectedSale && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg border border-border/60 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">Egg Size</TableHead>
                      <TableHead className="text-xs">Packaging</TableHead>
                      <TableHead className="text-right text-xs">Pkg Qty</TableHead>
                      <TableHead className="text-right text-xs">Total Pcs</TableHead>
                      <TableHead className="text-right text-xs">Unit Price</TableHead>
                      <TableHead className="text-right text-xs">Line Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedSale.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-xs font-medium text-foreground">
                          {EGG_SIZE_LABELS[item.size] ?? item.size}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {PACKAGING_LABELS[item.packaging] ?? item.packaging}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums">
                          {item.package_quantity.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                          {item.total_pieces.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                          {DEFAULT_CURRENCY_SYMBOL}{item.unit_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right text-xs font-semibold tabular-nums text-foreground">
                          {DEFAULT_CURRENCY_SYMBOL}{item.line_total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Financial Summary */}
              <div className="rounded-lg bg-muted/30 p-3 space-y-1.5 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal:</span>
                  <span className="font-semibold text-foreground tabular-nums">
                    {DEFAULT_CURRENCY_SYMBOL}{selectedSale.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                {selectedSale.discount > 0 && (
                  <div className="flex justify-between text-rose-600 dark:text-rose-400">
                    <span>Discount:</span>
                    <span className="font-semibold tabular-nums">
                      -{DEFAULT_CURRENCY_SYMBOL}{selectedSale.discount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-1.5 font-bold text-sm text-foreground">
                  <span>Grand Total:</span>
                  <span className="text-teal-600 dark:text-teal-400 tabular-nums">
                    {DEFAULT_CURRENCY_SYMBOL}{selectedSale.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              {/* Notes */}
              {selectedSale.notes && (
                <div className="text-xs space-y-1">
                  <span className="font-semibold text-muted-foreground">Notes:</span>
                  <p className="text-muted-foreground bg-muted/20 p-2 rounded-md">
                    {selectedSale.notes}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
