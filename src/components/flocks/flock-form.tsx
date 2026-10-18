"use client";

import * as React from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Check } from "lucide-react";
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
  createFlockSchema,
  updateFlockSchema,
  type CreateFlockInput,
  type UpdateFlockInput,
} from "@/lib/validations/flocks";
import { createFlock, updateFlock } from "@/actions/flocks";
import {
  CHICKEN_BREEDS,
  CHICKEN_BREED_DETAILS,
  BREED_DEFAULT_EGG_COLORS,
} from "@/lib/constants";
import { EggShellColorBadge } from "@/components/flocks/egg-shell-color-badge";
import type { Database } from "@/types/database.types";
import type { ChickenBreed, FlockStatus } from "@/types";

type FlockRow = Database["public"]["Tables"]["flocks"]["Row"];

interface FlockFormProps {
  flock?: FlockRow;
  onSuccess: () => void;
  onCancel: () => void;
}

export function FlockForm({ flock, onSuccess, onCancel }: FlockFormProps) {
  const isEditing = Boolean(flock);

  // Form states
  const [flockIdentifier, setFlockIdentifier] = React.useState(
    flock?.flock_identifier ?? ""
  );

  // Selected chicken breed
  const [breed, setBreed] = React.useState<string>(flock?.breed ?? "");

  const [acquisitionDate, setAcquisitionDate] = React.useState(
    flock?.acquisition_date ?? new Date().toISOString().split("T")[0]
  );
  const [initialBirdCount, setInitialBirdCount] = React.useState<string>(
    flock ? String(flock.initial_bird_count) : ""
  );
  const [status, setStatus] = React.useState<FlockStatus>(
    flock?.status ?? "ACTIVE"
  );
  const [notes, setNotes] = React.useState(flock?.notes ?? "");

  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [isPending, setIsPending] = React.useState(false);

  // Derived egg color — shown on each breed card; sent to DB by the server action.
  const derivedEggColor = breed
    ? (BREED_DEFAULT_EGG_COLORS[breed as ChickenBreed] ?? "Brown")
    : null;

  // Handle breed selection
  function handleSelectBreed(selectedBreed: ChickenBreed) {
    setBreed(selectedBreed);

    if (errors.breed) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.breed;
        return next;
      });
    }
  }

  // ── Handle Submit ──────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    if (isEditing) {
      const updateData: UpdateFlockInput = {
        id: flock!.id,
        flock_identifier: flockIdentifier.trim(),
        breed: breed.trim() || undefined,
        acquisition_date: acquisitionDate,
        status,
        notes: notes.trim() || undefined,
      };

      const parsed = updateFlockSchema.safeParse(updateData);
      if (!parsed.success) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
          const key = issue.path[0] as string;
          if (!fieldErrors[key]) {
            fieldErrors[key] = issue.message;
          }
        }
        setErrors(fieldErrors);
        return;
      }

      setIsPending(true);
      const result = await updateFlock(parsed.data);
      setIsPending(false);

      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Flock updated successfully.");
      onSuccess();
    } else {
      const parsedCount = parseInt(initialBirdCount, 10);
      const createData: CreateFlockInput = {
        flock_identifier: flockIdentifier.trim(),
        breed: breed.trim(),
        acquisition_date: acquisitionDate,
        initial_bird_count: isNaN(parsedCount) ? (undefined as unknown as number) : parsedCount,
        notes: notes.trim() || undefined,
      };

      const parsed = createFlockSchema.safeParse(createData);
      if (!parsed.success) {
        const fieldErrors: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
          const key = issue.path[0] as string;
          if (!fieldErrors[key]) {
            fieldErrors[key] = issue.message;
          }
        }
        setErrors(fieldErrors);
        return;
      }

      setIsPending(true);
      const result = await createFlock(parsed.data);
      setIsPending(false);

      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success("Flock created successfully.");
      onSuccess();
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEditing ? "Edit Flock" : "Add New Flock"}</DialogTitle>
        <DialogDescription>
          {isEditing
            ? "Update flock details and status. Bird counts are adjusted only through mortality and culling records."
            : "Create a new laying hen batch. The egg shell color is automatically set from the selected breed."}
        </DialogDescription>
      </DialogHeader>

      <form id="flock-form" onSubmit={handleSubmit} className="space-y-4 py-2">
        {/* Flock Identifier */}
        <div className="space-y-1.5">
          <Label htmlFor="flock_identifier">
            Flock Identifier <span className="text-destructive">*</span>
          </Label>
          <Input
            id="flock_identifier"
            placeholder="e.g. BATCH-2026-A"
            value={flockIdentifier}
            onChange={(e) => {
              setFlockIdentifier(e.target.value);
              if (errors.flock_identifier) {
                setErrors((prev) => {
                  const next = { ...prev };
                  delete next.flock_identifier;
                  return next;
                });
              }
            }}
          />
          {errors.flock_identifier && (
            <p className="text-xs text-destructive">{errors.flock_identifier}</p>
          )}
        </div>

        {/* ── Breed Selection (4 Clickable Cards) ────────────────────────── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">
              Chicken Breed <span className="text-destructive">*</span>
            </Label>
            {breed && derivedEggColor && (
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                Egg color:&nbsp;
                <EggShellColorBadge color={derivedEggColor} size="sm" />
              </span>
            )}
          </div>

          <div
            role="radiogroup"
            aria-label="Chicken Breed Selection"
            className="grid grid-cols-1 sm:grid-cols-2 gap-3"
          >
            {CHICKEN_BREEDS.map((breedId) => {
              const info = CHICKEN_BREED_DETAILS[breedId];
              const isSelected = breed === breedId;

              return (
                <div
                  key={breedId}
                  role="radio"
                  id={`breed-card-${breedId.toLowerCase().replace(/\s+/g, "-")}`}
                  aria-checked={isSelected}
                  aria-label={`${info.name}, typically produces ${info.typicalEggColor} eggs`}
                  tabIndex={0}
                  onClick={() => handleSelectBreed(breedId)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleSelectBreed(breedId);
                    }
                  }}
                  className={`relative flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer select-none text-left focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                    isSelected
                      ? "border-emerald-600 bg-emerald-50/70 dark:bg-emerald-950/30 ring-2 ring-emerald-500/20 shadow-xs"
                      : "border-border/70 hover:border-emerald-300 dark:hover:border-emerald-800 bg-card hover:bg-muted/40"
                  }`}
                >
                  <Image
                    src={info.image}
                    alt={info.name}
                    width={64}
                    height={64}
                    className="size-16 rounded-lg object-cover border border-border/60 shrink-0 bg-muted"
                  />
                  <div className="flex-1 min-w-0 pr-5">
                    <p className="font-semibold text-sm text-foreground truncate">
                      {info.name}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                      <span>Egg:</span>
                      <EggShellColorBadge color={info.typicalEggColor} size="sm" />
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">
                      {info.description}
                    </p>
                  </div>

                  {/* Top-right indicator */}
                  <div className="absolute top-2.5 right-2.5">
                    {isSelected ? (
                      <div className="flex size-5 items-center justify-center rounded-full bg-emerald-600 text-white shadow-xs">
                        <Check className="size-3.5 stroke-[3]" />
                      </div>
                    ) : (
                      <div className="size-5 rounded-full border-2 border-muted-foreground/30" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {errors.breed && (
            <p className="text-xs text-destructive">{errors.breed}</p>
          )}
        </div>

        {/* Acquisition Date and Initial Bird Count / Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="acquisition_date">
              Acquisition Date <span className="text-destructive">*</span>
            </Label>
            <Input
              id="acquisition_date"
              type="date"
              value={acquisitionDate}
              onChange={(e) => setAcquisitionDate(e.target.value)}
            />
            {errors.acquisition_date && (
              <p className="text-xs text-destructive">{errors.acquisition_date}</p>
            )}
          </div>

          {!isEditing ? (
            <div className="space-y-1.5">
              <Label htmlFor="initial_bird_count">
                Initial Bird Count <span className="text-destructive">*</span>
              </Label>
              <Input
                id="initial_bird_count"
                type="number"
                min={1}
                placeholder="e.g. 500"
                value={initialBirdCount}
                onChange={(e) => setInitialBirdCount(e.target.value)}
              />
              {errors.initial_bird_count && (
                <p className="text-xs text-destructive">{errors.initial_bird_count}</p>
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="edit_status">
                Status <span className="text-destructive">*</span>
              </Label>
              <Select
                value={status}
                onValueChange={(val) => setStatus(val as FlockStatus)}
              >
                <SelectTrigger id="edit_status" className="w-full">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Active</SelectItem>
                  <SelectItem value="RETIRED">Retired</SelectItem>
                  <SelectItem value="QUARANTINED">Quarantined</SelectItem>
                </SelectContent>
              </Select>
              {errors.status && (
                <p className="text-xs text-destructive">{errors.status}</p>
              )}
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="space-y-1.5">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            rows={2}
            placeholder="Optional notes about this flock batch..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          {errors.notes && (
            <p className="text-xs text-destructive">{errors.notes}</p>
          )}
        </div>
      </form>

      <DialogFooter>
        <DialogClose render={<Button variant="outline" type="button" onClick={onCancel} />}>
          Cancel
        </DialogClose>
        <Button
          type="submit"
          form="flock-form"
          disabled={isPending}
        >
          {isPending ? (isEditing ? "Saving..." : "Creating...") : (isEditing ? "Save Changes" : "Create Flock")}
        </Button>
      </DialogFooter>
    </>
  );
}
