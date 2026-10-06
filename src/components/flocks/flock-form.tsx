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
  createFlockSchema,
  updateFlockSchema,
  type CreateFlockInput,
  type UpdateFlockInput,
} from "@/lib/validations/flocks";
import { createFlock, updateFlock } from "@/actions/flocks";
import type { Database } from "@/types/database.types";
import type { FlockStatus } from "@/types";

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
  const [breed, setBreed] = React.useState(flock?.breed ?? "");
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
        breed: breed.trim() || undefined,
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
            : "Create a new laying hen batch. Bird count is tracked from initial count and updated automatically."}
        </DialogDescription>
      </DialogHeader>

      <form id="flock-form" onSubmit={handleSubmit} className="space-y-4 py-2">
        <div className="space-y-1.5">
          <Label htmlFor="flock_identifier">
            Flock Identifier <span className="text-destructive">*</span>
          </Label>
          <Input
            id="flock_identifier"
            placeholder="e.g. BATCH-2026-A"
            value={flockIdentifier}
            onChange={(e) => setFlockIdentifier(e.target.value)}
          />
          {errors.flock_identifier && (
            <p className="text-xs text-destructive">{errors.flock_identifier}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="breed">Breed</Label>
          <Input
            id="breed"
            placeholder="e.g. Lohmann Brown, Hy-Line"
            value={breed}
            onChange={(e) => setBreed(e.target.value)}
          />
          {errors.breed && (
            <p className="text-xs text-destructive">{errors.breed}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
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

        <div className="space-y-1.5">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            rows={3}
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
