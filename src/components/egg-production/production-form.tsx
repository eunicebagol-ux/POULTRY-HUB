"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  EGG_SIZES,
  EGG_SIZE_LABELS,
  COLLECTION_SHIFTS,
  COLLECTION_SHIFT_LABELS,
  type CollectionShift,
} from "@/lib/constants";
import {
  recordEggProductionSchema,
  type RecordEggProductionInput,
} from "@/lib/validations/egg-production";
import { recordEggProduction } from "@/actions/egg-production";
import type { EggSize } from "@/types";

export interface FlockOption {
  id: string;
  flock_identifier: string;
  current_bird_count: number;
  acquisition_date: string;
}

interface ProductionFormProps {
  flocks: FlockOption[];
  onSuccess: () => void;
  onCancel: () => void;
}

export function ProductionForm({
  flocks,
  onSuccess,
  onCancel,
}: ProductionFormProps) {
  const [flockId, setFlockId] = React.useState<string>(flocks[0]?.id ?? "");
  const [productionDate, setProductionDate] = React.useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [collectionShift, setCollectionShift] =
    React.useState<CollectionShift>("MORNING");

  // Size inputs (strings for controlled numeric input)
  const [sizeInputs, setSizeInputs] = React.useState<Record<EggSize, string>>({
    SMALL: "",
    MEDIUM: "",
    LARGE: "",
    EXTRA_LARGE: "",
    JUMBO: "",
    UNGRADED: "",
  });

  const [damagedInput, setDamagedInput] = React.useState<string>("");
  const [crackedInput, setCrackedInput] = React.useState<string>("");
  const [notes, setNotes] = React.useState<string>("");

  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [isPending, setIsPending] = React.useState(false);

  const selectedFlock = React.useMemo(
    () => flocks.find((f) => f.id === flockId),
    [flocks, flockId]
  );

  // Live total calculations
  const parsedSizes = React.useMemo(() => {
    const res: Record<EggSize, number> = {
      SMALL: 0,
      MEDIUM: 0,
      LARGE: 0,
      EXTRA_LARGE: 0,
      JUMBO: 0,
      UNGRADED: 0,
    };
    for (const size of EGG_SIZES) {
      const val = parseInt(sizeInputs[size] || "0", 10);
      res[size] = isNaN(val) || val < 0 ? 0 : val;
    }
    return res;
  }, [sizeInputs]);

  const goodEggsTotal = React.useMemo(() => {
    return Object.values(parsedSizes).reduce((acc, v) => acc + v, 0);
  }, [parsedSizes]);

  const parsedDamaged = React.useMemo(() => {
    const val = parseInt(damagedInput || "0", 10);
    return isNaN(val) || val < 0 ? 0 : val;
  }, [damagedInput]);

  const parsedCracked = React.useMemo(() => {
    const val = parseInt(crackedInput || "0", 10);
    return isNaN(val) || val < 0 ? 0 : val;
  }, [crackedInput]);

  const grandTotal = goodEggsTotal + parsedDamaged + parsedCracked;

  function handleSizeChange(size: EggSize, value: string) {
    setSizeInputs((prev) => ({ ...prev, [size]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    const inputData: RecordEggProductionInput = {
      flock_id: flockId,
      production_date: productionDate,
      collection_shift: collectionShift,
      sizes: parsedSizes,
      damaged_eggs: parsedDamaged,
      cracked_eggs: parsedCracked,
      notes: notes.trim() || undefined,
    };

    const parsed = recordEggProductionSchema.safeParse(inputData);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".");
        if (!fieldErrors[key]) {
          fieldErrors[key] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }

    setIsPending(true);
    const result = await recordEggProduction(parsed.data);
    setIsPending(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success("Egg production recorded successfully.");
    onSuccess();
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Record Egg Production</DialogTitle>
        <DialogDescription>
          Log daily egg collection for an active flock. Intact eggs will be
          automatically allocated to inventory by size.
        </DialogDescription>
      </DialogHeader>

      <form id="egg-production-form" onSubmit={handleSubmit} className="space-y-4 py-2">
        {/* Flock, Date, Shift */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="flock_id">
              Active Flock <span className="text-destructive">*</span>
            </Label>
            <Select value={flockId} onValueChange={(val) => setFlockId(val ?? "")}>
              <SelectTrigger id="flock_id" className="w-full">
                <SelectValue placeholder="Select flock">
                  {selectedFlock
                    ? `${selectedFlock.flock_identifier} (${selectedFlock.current_bird_count} birds)`
                    : "Select flock"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {flocks.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.flock_identifier} ({f.current_bird_count} birds)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors["flock_id"] && (
              <p className="text-xs text-destructive">{errors["flock_id"]}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="production_date">
              Date <span className="text-destructive">*</span>
            </Label>
            <Input
              id="production_date"
              type="date"
              value={productionDate}
              min={selectedFlock?.acquisition_date}
              onChange={(e) => setProductionDate(e.target.value)}
            />
            {errors["production_date"] && (
              <p className="text-xs text-destructive">{errors["production_date"]}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="collection_shift">
              Shift <span className="text-destructive">*</span>
            </Label>
            <Select
              value={collectionShift}
              onValueChange={(val) =>
                setCollectionShift((val ?? "MORNING") as CollectionShift)
              }
            >
              <SelectTrigger id="collection_shift" className="w-full">
                <SelectValue placeholder="Select shift" />
              </SelectTrigger>
              <SelectContent>
                {COLLECTION_SHIFTS.map((shift) => (
                  <SelectItem key={shift} value={shift}>
                    {COLLECTION_SHIFT_LABELS[shift]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors["collection_shift"] && (
              <p className="text-xs text-destructive">{errors["collection_shift"]}</p>
            )}
          </div>
        </div>

        {/* Sized Egg Quantities Grid */}
        <div className="space-y-2 rounded-lg border border-border/70 p-3 bg-muted/20">
          <div className="flex items-center justify-between pb-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Egg Sizing Breakdown (Pieces)
            </p>
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              Good Eggs: {goodEggsTotal.toLocaleString()}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {EGG_SIZES.map((size) => (
              <div key={size} className="space-y-1">
                <Label htmlFor={`size-${size}`} className="text-xs text-muted-foreground">
                  {EGG_SIZE_LABELS[size]}
                </Label>
                <Input
                  id={`size-${size}`}
                  type="number"
                  min={0}
                  placeholder="0"
                  className="h-8 text-sm"
                  value={sizeInputs[size]}
                  onChange={(e) => handleSizeChange(size, e.target.value)}
                />
              </div>
            ))}
          </div>
          {errors["sizes"] && (
            <p className="text-xs text-destructive">{errors["sizes"]}</p>
          )}
        </div>

        {/* Quality Controls: Damaged & Cracked */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="damaged_eggs">Damaged Eggs (Waste)</Label>
            <Input
              id="damaged_eggs"
              type="number"
              min={0}
              placeholder="0"
              value={damagedInput}
              onChange={(e) => setDamagedInput(e.target.value)}
            />
            {errors["damaged_eggs"] && (
              <p className="text-xs text-destructive">{errors["damaged_eggs"]}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cracked_eggs">Cracked Eggs (Discard)</Label>
            <Input
              id="cracked_eggs"
              type="number"
              min={0}
              placeholder="0"
              value={crackedInput}
              onChange={(e) => setCrackedInput(e.target.value)}
            />
            {errors["cracked_eggs"] && (
              <p className="text-xs text-destructive">{errors["cracked_eggs"]}</p>
            )}
          </div>
        </div>

        {/* Summary Card */}
        <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-50/50 p-2.5 dark:bg-emerald-950/20">
          <span className="text-xs font-medium text-foreground">Total Collected</span>
          <span className="text-base font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
            {grandTotal.toLocaleString()} eggs
          </span>
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <Label htmlFor="prod_notes">Notes</Label>
          <Textarea
            id="prod_notes"
            rows={2}
            placeholder="Optional collection notes (e.g. weather conditions, feed intake)..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          {errors["notes"] && (
            <p className="text-xs text-destructive">{errors["notes"]}</p>
          )}
        </div>
      </form>

      <DialogFooter>
        <DialogClose render={<Button variant="outline" type="button" onClick={onCancel} />}>
          Cancel
        </DialogClose>
        <Button
          type="submit"
          form="egg-production-form"
          disabled={isPending || grandTotal <= 0}
        >
          {isPending ? "Recording..." : "Save Production"}
        </Button>
      </DialogFooter>
    </>
  );
}
