"use client";

import * as React from "react";
import { PlusCircle, Pencil, Skull, Scissors, Bird } from "lucide-react";
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
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { FlockForm } from "@/components/flocks/flock-form";
import { MortalityForm } from "@/components/flocks/mortality-form";
import { CullingForm } from "@/components/flocks/culling-form";
import { EggShellColorBadge } from "@/components/flocks/egg-shell-color-badge";
import { formatDate } from "@/lib/utils";
import type { Database } from "@/types/database.types";
import type { FlockStatus } from "@/types";

type FlockRow = Database["public"]["Tables"]["flocks"]["Row"];

interface FlockListProps {
  flocks: FlockRow[];
}

// ── Status Badge ─────────────────────────────────────────────────────────────

function FlockStatusBadge({ status }: { status: FlockStatus }) {
  if (status === "ACTIVE") {
    return (
      <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300/40">
        Active
      </Badge>
    );
  }
  if (status === "QUARANTINED") {
    return (
      <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300/40">
        Quarantined
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      Retired
    </Badge>
  );
}

// ── Bird Count Bar ────────────────────────────────────────────────────────────

function BirdCountBar({
  current,
  initial,
}: {
  current: number;
  initial: number;
}) {
  const pct = initial > 0 ? Math.max(0, Math.min(100, (current / initial) * 100)) : 0;
  const color =
    pct > 75
      ? "bg-emerald-500"
      : pct > 40
      ? "bg-amber-500"
      : "bg-red-500";

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs tabular-nums">
        {current.toLocaleString()} / {initial.toLocaleString()}
      </span>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function FlockList({ flocks }: FlockListProps) {
  const [openDialog, setOpenDialog] = React.useState<
    | { type: "create" }
    | { type: "edit"; flock: FlockRow }
    | { type: "mortality"; flock: FlockRow }
    | { type: "culling"; flock: FlockRow }
    | null
  >(null);

  function closeDialog() {
    setOpenDialog(null);
  }

  // ── Empty State ──────────────────────────────────────────────────────────────
  if (flocks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
        <div className="flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Bird className="size-8" />
        </div>
        <div>
          <p className="text-base font-semibold text-foreground">No flocks yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Create the first laying hen batch to start tracking production.
          </p>
        </div>
        <Button
          id="add-first-flock-btn"
          onClick={() => setOpenDialog({ type: "create" })}
        >
          <PlusCircle className="mr-2 size-4" />
          Add First Flock
        </Button>

        <Dialog
          open={openDialog?.type === "create"}
          onOpenChange={(open) => {
            if (!open) closeDialog();
          }}
        >
          <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
            <FlockForm
              onSuccess={closeDialog}
              onCancel={closeDialog}
            />
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ── Table View ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Add Flock Button */}
      <div className="flex justify-end">
        <Button
          id="add-flock-btn"
          onClick={() => setOpenDialog({ type: "create" })}
        >
          <PlusCircle className="mr-2 size-4" />
          Add Flock
        </Button>
      </div>

      <Card className="border-border/60 shadow-xs overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Flock ID</TableHead>
                <TableHead>Breed</TableHead>
                <TableHead>Egg Color</TableHead>
                <TableHead>Acquired</TableHead>
                <TableHead>Bird Count</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flocks.map((flock) => (
                <TableRow key={flock.id}>
                  <TableCell className="font-medium">{flock.flock_identifier}</TableCell>
                  <TableCell className="text-foreground font-medium">
                    {flock.breed ?? "—"}
                  </TableCell>
                  <TableCell>
                    <EggShellColorBadge color={flock.egg_shell_color} size="sm" />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(flock.acquisition_date)}
                  </TableCell>
                  <TableCell>
                    <BirdCountBar
                      current={flock.current_bird_count}
                      initial={flock.initial_bird_count}
                    />
                  </TableCell>
                  <TableCell>
                    <FlockStatusBadge status={flock.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {/* Edit Flock */}
                      <Button
                        id={`edit-flock-${flock.id}`}
                        variant="ghost"
                        size="icon-sm"
                        title="Edit flock"
                        onClick={() =>
                          setOpenDialog({ type: "edit", flock })
                        }
                      >
                        <Pencil className="size-3.5" />
                        <span className="sr-only">Edit</span>
                      </Button>

                      {/* Record Mortality */}
                      {flock.status === "ACTIVE" && flock.current_bird_count > 0 && (
                        <Button
                          id={`record-mortality-${flock.id}`}
                          variant="ghost"
                          size="icon-sm"
                          title="Record mortality"
                          onClick={() =>
                            setOpenDialog({ type: "mortality", flock })
                          }
                        >
                          <Skull className="size-3.5 text-destructive" />
                          <span className="sr-only">Record mortality</span>
                        </Button>
                      )}

                      {/* Record Culling */}
                      {flock.status === "ACTIVE" && flock.current_bird_count > 0 && (
                        <Button
                          id={`record-culling-${flock.id}`}
                          variant="ghost"
                          size="icon-sm"
                          title="Record culling"
                          onClick={() =>
                            setOpenDialog({ type: "culling", flock })
                          }
                        >
                          <Scissors className="size-3.5 text-amber-600" />
                          <span className="sr-only">Record culling</span>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Global Dialogs based on active openDialog state */}
      <Dialog
        open={openDialog?.type === "create"}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
          <FlockForm
            onSuccess={closeDialog}
            onCancel={closeDialog}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={openDialog?.type === "edit"}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
          {openDialog?.type === "edit" && (
            <FlockForm
              flock={openDialog.flock}
              onSuccess={closeDialog}
              onCancel={closeDialog}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={openDialog?.type === "mortality"}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent className="sm:max-w-md">
          {openDialog?.type === "mortality" && (
            <MortalityForm
              flockId={openDialog.flock.id}
              flockIdentifier={openDialog.flock.flock_identifier}
              currentBirdCount={openDialog.flock.current_bird_count}
              onSuccess={closeDialog}
              onCancel={closeDialog}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={openDialog?.type === "culling"}
        onOpenChange={(open) => {
          if (!open) closeDialog();
        }}
      >
        <DialogContent className="sm:max-w-md">
          {openDialog?.type === "culling" && (
            <CullingForm
              flockId={openDialog.flock.id}
              flockIdentifier={openDialog.flock.flock_identifier}
              currentBirdCount={openDialog.flock.current_bird_count}
              onSuccess={closeDialog}
              onCancel={closeDialog}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
