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
import { EGG_SIZE_LABELS, PACKAGING_MULTIPLIERS } from "@/lib/constants";
import type { EggInventoryRow } from "@/actions/egg-inventory";
import type { EggSize } from "@/types";

interface InventoryTableProps {
  inventory: EggInventoryRow[];
}

/** Derive packaging breakdown from raw piece count */
function toPackagingBreakdown(pieces: number) {
  const boxes = Math.floor(pieces / PACKAGING_MULTIPLIERS.BOX_360);
  const rem1 = pieces % PACKAGING_MULTIPLIERS.BOX_360;
  const trays = Math.floor(rem1 / PACKAGING_MULTIPLIERS.TRAY_30);
  const rem2 = rem1 % PACKAGING_MULTIPLIERS.TRAY_30;
  const cartons = Math.floor(rem2 / PACKAGING_MULTIPLIERS.CARTON_12);
  const loose = rem2 % PACKAGING_MULTIPLIERS.CARTON_12;
  return { boxes, trays, cartons, loose };
}

// Canonical display order matching EGG_SIZES constant
const SIZE_ORDER: EggSize[] = [
  "SMALL",
  "MEDIUM",
  "LARGE",
  "EXTRA_LARGE",
  "JUMBO",
  "UNGRADED",
];

export function InventoryTable({ inventory }: InventoryTableProps) {
  // Sort rows to canonical display order
  const sorted = React.useMemo(() => {
    const map = new Map(inventory.map((r) => [r.size, r]));
    return SIZE_ORDER.map(
      (size) =>
        map.get(size) ?? {
          id: size,
          size,
          stock_pieces: 0,
          updated_at: "",
        }
    );
  }, [inventory]);

  // Empty state — all sizes at zero
  const allEmpty = sorted.every((r) => r.stock_pieces === 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Stock levels by egg size — pieces are the authoritative unit
        </p>
      </div>

      <Card className="border-border/60 shadow-xs overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Size</TableHead>
                <TableHead className="text-right">Stock (pcs)</TableHead>
                <TableHead className="text-right">
                  Boxes ×360
                </TableHead>
                <TableHead className="text-right">
                  Trays ×30
                </TableHead>
                <TableHead className="text-right">
                  Cartons ×12
                </TableHead>
                <TableHead className="text-right">Loose pcs</TableHead>
                <TableHead>Last Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allEmpty ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-16 text-center"
                  >
                    <div className="flex flex-col items-center gap-3">
                      <PackageOpen className="size-10 text-muted-foreground/40" />
                      <p className="text-sm font-medium text-muted-foreground">
                        No eggs in stock yet
                      </p>
                      <p className="text-xs text-muted-foreground max-w-xs">
                        Stock is updated automatically when egg production is
                        recorded.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                sorted.map((row) => {
                  const { boxes, trays, cartons, loose } = toPackagingBreakdown(
                    row.stock_pieces
                  );
                  const isLow =
                    row.stock_pieces > 0 && row.stock_pieces < 30;

                  return (
                    <TableRow key={row.size}>
                      <TableCell className="font-semibold text-foreground">
                        {EGG_SIZE_LABELS[row.size] ?? row.size}
                      </TableCell>
                      <TableCell
                        className={`text-right tabular-nums font-bold ${
                          isLow
                            ? "text-amber-600 dark:text-amber-400"
                            : row.stock_pieces === 0
                            ? "text-muted-foreground"
                            : "text-foreground"
                        }`}
                      >
                        {row.stock_pieces.toLocaleString()}
                        {isLow && (
                          <span className="ml-1 text-[10px] font-normal text-amber-500">
                            LOW
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {boxes > 0 ? boxes : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {trays > 0 ? trays : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {cartons > 0 ? cartons : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {loose > 0 ? loose : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {row.updated_at
                          ? new Date(row.updated_at).toLocaleString("en-PH", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })
                          : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
