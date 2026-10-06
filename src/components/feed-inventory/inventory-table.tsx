"use client";

import * as React from "react";
import { PackageOpen } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import { DEFAULT_CURRENCY_SYMBOL } from "@/lib/constants";
import type { FeedInventoryView } from "@/actions/feed-inventory";

interface InventoryTableProps {
  inventory: FeedInventoryView[];
}

export function InventoryTable({ inventory }: InventoryTableProps) {
  const isEmpty = inventory.length === 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Feed stock by type (Kilograms are the authoritative unit)
        </p>
      </div>

      <Card className="border-border/60 shadow-xs overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Feed Type</TableHead>
                <TableHead className="text-right">Current Stock (kg)</TableHead>
                <TableHead className="text-right">Cost / kg</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isEmpty ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-16 text-center"
                  >
                    <div className="flex flex-col items-center gap-3">
                      <PackageOpen className="size-10 text-muted-foreground/40" />
                      <p className="text-sm font-medium text-muted-foreground">
                        No feed in stock yet
                      </p>
                      <p className="text-xs text-muted-foreground/80 max-w-sm">
                        Feed stock will appear here when an administrator records a stock intake.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                inventory.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">
                      {row.feed_type}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">
                      {row.current_stock_kg.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {DEFAULT_CURRENCY_SYMBOL}
                      {row.cost_per_kg.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell>
                      {row.current_stock_kg <= 0 ? (
                        <Badge variant="destructive" className="h-5 text-[10px]">Out of Stock</Badge>
                      ) : (
                        <Badge variant="secondary" className="h-5 text-[10px] bg-green-500/10 text-green-700 dark:text-green-400">
                          In Stock
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground tabular-nums">
                      {row.updated_at
                        ? formatDateTime(row.updated_at)
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
