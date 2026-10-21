"use client";

import { History } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/utils";
import type { FeedTransactionView } from "@/actions/feed-inventory";

interface TransactionLedgerProps {
  transactions: FeedTransactionView[];
}

export function TransactionLedger({ transactions }: TransactionLedgerProps) {
  const isEmpty = transactions.length === 0;

  return (
    <Card className="border-border/60 shadow-xs">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <History className="size-4" />
          Transaction History
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="pl-6">Date</TableHead>
                <TableHead>Feed Type</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Quantity (kg)</TableHead>
                <TableHead>User</TableHead>
                <TableHead className="w-[30%]">Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isEmpty ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-12 text-center text-sm text-muted-foreground"
                  >
                    No transactions found
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((tx) => {
                  const isPositive = tx.quantity_kg > 0;
                  const isConsumption = tx.transaction_type === "CONSUMPTION";
                  return (
                    <TableRow key={tx.id}>
                      <TableCell className="pl-6 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                        {formatDateTime(tx.created_at)}
                      </TableCell>
                      <TableCell className="font-medium text-xs">
                        {tx.feed_type}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={`h-5 text-[10px] ${
                            tx.transaction_type === "STOCK_RECEIVED"
                              ? "bg-blue-500/10 text-blue-700 dark:text-blue-400"
                              : isConsumption
                              ? "bg-orange-500/10 text-orange-700 dark:text-orange-400"
                              : "bg-muted"
                          }`}
                        >
                          {tx.transaction_type.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className={`text-right tabular-nums font-medium ${
                          isPositive ? "text-green-600 dark:text-green-500" : ""
                        }`}
                      >
                        {isPositive ? "+" : ""}
                        {tx.quantity_kg.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {tx.creator?.full_name?.trim() || "System"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate" title={tx.notes || ""}>
                        {tx.notes || "—"}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
