"use client";

import * as React from "react";
import { PlusCircle, Egg, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ProductionForm, type FlockOption } from "@/components/egg-production/production-form";
import { formatDate } from "@/lib/utils";
import {
  COLLECTION_SHIFT_LABELS,
  EGG_SIZE_LABELS,
  type CollectionShift,
} from "@/lib/constants";
import type { EggSize } from "@/types";

export interface ProductionRecordItem {
  id: string;
  flock_id: string;
  production_date: string;
  collection_shift: string | null;
  total_eggs: number;
  good_eggs: number;
  damaged_eggs: number;
  cracked_eggs: number;
  notes: string | null;
  created_at: string;
  flock: {
    id: string;
    flock_identifier: string;
  } | null;
  sizes: {
    size: EggSize;
    quantity: number;
  }[];
}

interface ProductionListProps {
  records: ProductionRecordItem[];
  flocks: FlockOption[];
}

export function ProductionList({ records, flocks }: ProductionListProps) {
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);

  function handleClose() {
    setIsDialogOpen(false);
  }

  // ── Empty State ────────────────────────────────────────────────────────────
  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
        <div className="flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Egg className="size-8 text-amber-500" />
        </div>
        <div>
          <p className="text-base font-semibold text-foreground">
            No egg production records yet
          </p>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            {flocks.length > 0
              ? "Start logging daily egg collections for your active flocks."
              : "Create an active flock first to begin recording egg production."}
          </p>
        </div>
        {flocks.length > 0 && (
          <Button
            id="add-first-production-btn"
            onClick={() => setIsDialogOpen(true)}
          >
            <PlusCircle className="mr-2 size-4" />
            Record First Production
          </Button>
        )}

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="sm:max-w-xl">
            <ProductionForm
              flocks={flocks}
              onSuccess={handleClose}
              onCancel={handleClose}
            />
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ── Table View ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Showing <span className="font-semibold text-foreground">{records.length}</span> recorded collections
        </p>
        <Button
          id="record-production-btn"
          disabled={flocks.length === 0}
          onClick={() => setIsDialogOpen(true)}
        >
          <PlusCircle className="mr-2 size-4" />
          Record Production
        </Button>
      </div>

      <Card className="border-border/60 shadow-xs overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date &amp; Shift</TableHead>
                <TableHead>Flock</TableHead>
                <TableHead>Total Eggs</TableHead>
                <TableHead>Good (Stocked)</TableHead>
                <TableHead>Size Breakdown</TableHead>
                <TableHead>Waste (Damaged / Cracked)</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((rec) => {
                const shiftLabel = rec.collection_shift
                  ? COLLECTION_SHIFT_LABELS[rec.collection_shift as CollectionShift] ||
                    rec.collection_shift
                  : "Standard";

                return (
                  <TableRow key={rec.id}>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium text-foreground">
                          {formatDate(rec.production_date)}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="size-3" />
                          {shiftLabel}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {rec.flock?.flock_identifier ?? "—"}
                    </TableCell>
                    <TableCell className="tabular-nums font-bold text-foreground">
                      {rec.total_eggs.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300/40">
                        {rec.good_eggs.toLocaleString()} pcs
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {rec.sizes && rec.sizes.length > 0 ? (
                          rec.sizes
                            .filter((s) => s.quantity > 0)
                            .map((s) => (
                              <span
                                key={s.size}
                                className="inline-flex items-center gap-1 rounded bg-muted/80 px-1.5 py-0.5 text-[11px] font-medium tabular-nums"
                              >
                                <span className="text-muted-foreground">
                                  {EGG_SIZE_LABELS[s.size] || s.size}:
                                </span>
                                <span>{s.quantity}</span>
                              </span>
                            ))
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {rec.damaged_eggs > 0 || rec.cracked_eggs > 0 ? (
                        <span className="text-xs tabular-nums text-amber-700 dark:text-amber-400">
                          {rec.damaged_eggs > 0 && `${rec.damaged_eggs} dmg`}
                          {rec.damaged_eggs > 0 && rec.cracked_eggs > 0 && ", "}
                          {rec.cracked_eggs > 0 && `${rec.cracked_eggs} crk`}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                      {rec.notes || "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-xl">
          <ProductionForm
            flocks={flocks}
            onSuccess={handleClose}
            onCancel={handleClose}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
