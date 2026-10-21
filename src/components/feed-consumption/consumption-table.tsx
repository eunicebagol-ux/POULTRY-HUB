"use client";

import * as React from "react";
import { AlertCircle, UtensilsCrossed } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import type { FeedConsumptionView } from "@/actions/feed-consumption";

interface ConsumptionTableProps {
  records: FeedConsumptionView[];
  errorMessage?: string | null;
}

export function ConsumptionTable({ records, errorMessage }: ConsumptionTableProps) {
  const isEmpty = records.length === 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Feed consumption records (Kilograms are the authoritative unit)
        </p>
      </div>

      <Card className="border-border/60 shadow-xs overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-6">Date</TableHead>
                  <TableHead>Flock</TableHead>
                  <TableHead>Feed Type</TableHead>
                  <TableHead className="text-right">Quantity (kg)</TableHead>
                  <TableHead>Recorded By</TableHead>
                  <TableHead className="w-[30%]">Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {errorMessage ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-12 text-center text-destructive"
                    >
                      <div className="flex flex-col items-center gap-2">
                        <AlertCircle className="size-8 text-destructive" />
                        <p className="text-sm font-semibold">
                          Failed to load feed consumption records
                        </p>
                        <p className="text-xs text-muted-foreground max-w-md">
                          {errorMessage}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : isEmpty ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-16 text-center"
                    >
                      <div className="flex flex-col items-center gap-3">
                        <UtensilsCrossed className="size-10 text-muted-foreground/40" />
                        <p className="text-sm font-medium text-muted-foreground">
                          No feed consumption recorded yet
                        </p>
                        <p className="text-xs text-muted-foreground/80 max-w-sm">
                          Use the &quot;Record Consumption&quot; button above to record daily flock feed usage.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  records.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="pl-6 text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                        {formatDate(row.consumption_date)}
                      </TableCell>
                      <TableCell className="font-medium text-xs whitespace-nowrap">
                        {row.flock?.flock_identifier || "—"}
                      </TableCell>
                      <TableCell className="text-xs font-medium">
                        {row.feed_type}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-semibold text-xs">
                        {row.quantity_kg.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {row.creator?.full_name?.trim() || "System"}
                      </TableCell>
                      <TableCell
                        className="text-xs text-muted-foreground max-w-[220px] truncate"
                        title={row.notes || ""}
                      >
                        {row.notes || "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
