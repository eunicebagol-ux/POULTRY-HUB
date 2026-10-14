"use client";

import * as React from "react";
import { ArrowUp, ArrowDown, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { EGG_SIZE_LABELS } from "@/lib/constants";
import type { EggInventoryTransactionRow } from "@/actions/egg-inventory";
import type { EggTransactionType } from "@/types/database.types";

interface TransactionLedgerProps {
  transactions: EggInventoryTransactionRow[];
}

// ─── Type metadata ────────────────────────────────────────────────────────────

const TX_LABELS: Record<EggTransactionType, string> = {
  PRODUCTION: "Production",
  SALE: "Sale",
  ADJUSTMENT: "Adjustment",
  CORRECTION: "Correction",
};

const TX_COLORS: Record<
  EggTransactionType,
  { badge: string; icon: string }
> = {
  PRODUCTION:
    {
      badge:
        "bg-emerald-100 text-emerald-800 border-emerald-300/40 dark:bg-emerald-950 dark:text-emerald-300",
      icon: "text-emerald-600",
    },
  SALE:
    {
      badge:
        "bg-rose-100 text-rose-800 border-rose-300/40 dark:bg-rose-950 dark:text-rose-300",
      icon: "text-rose-600",
    },
  ADJUSTMENT:
    {
      badge:
        "bg-blue-100 text-blue-800 border-blue-300/40 dark:bg-blue-950 dark:text-blue-300",
      icon: "text-blue-600",
    },
  CORRECTION:
    {
      badge:
        "bg-purple-100 text-purple-800 border-purple-300/40 dark:bg-purple-950 dark:text-purple-300",
      icon: "text-purple-600",
    },
};

function TransactionTypeIcon({ type, quantity }: { type: EggTransactionType; quantity: number }) {
  const colors = TX_COLORS[type];
  if (quantity > 0) return <ArrowUp className={`size-3 ${colors.icon}`} />;
  if (quantity < 0) return <ArrowDown className={`size-3 ${colors.icon}`} />;
  return <Minus className="size-3 text-muted-foreground" />;
}

export function TransactionLedger({ transactions }: TransactionLedgerProps) {
  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
        <p className="text-sm font-medium text-muted-foreground">
          No inventory transactions yet
        </p>
        <p className="text-xs text-muted-foreground max-w-xs">
          Transactions are created automatically when egg production is recorded
          or sales are processed.
        </p>
      </div>
    );
  }

  return (
    <Card className="border-border/60 shadow-xs overflow-hidden">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date & Time</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Size</TableHead>
              <TableHead className="text-right">Qty (pcs)</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map((tx) => {
              const colors = TX_COLORS[tx.transaction_type];
              const isPositive = tx.quantity > 0;

              return (
                <TableRow key={tx.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(tx.created_at).toLocaleString("en-PH", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </TableCell>
                  <TableCell>
                    <Badge className={`text-[11px] ${colors.badge}`}>
                      <TransactionTypeIcon
                        type={tx.transaction_type}
                        quantity={tx.quantity}
                      />
                      <span className="ml-1">
                        {TX_LABELS[tx.transaction_type]}
                      </span>
                    </Badge>
                  </TableCell>
                  <TableCell className="font-medium text-foreground">
                    {EGG_SIZE_LABELS[tx.size] ?? tx.size}
                  </TableCell>
                  <TableCell
                    className={`text-right tabular-nums font-semibold ${
                      isPositive
                        ? "text-emerald-700 dark:text-emerald-400"
                        : tx.quantity < 0
                        ? "text-rose-700 dark:text-rose-400"
                        : "text-muted-foreground"
                    }`}
                  >
                    {isPositive ? "+" : ""}
                    {tx.quantity.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[280px] truncate">
                    {tx.notes || "—"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
