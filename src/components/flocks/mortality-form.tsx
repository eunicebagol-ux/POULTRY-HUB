"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  recordMortalitySchema,
  type RecordMortalityInput,
} from "@/lib/validations/flocks";
import { recordMortality } from "@/actions/flocks";

interface MortalityFormProps {
  flockId: string;
  flockIdentifier: string;
  currentBirdCount: number;
  onSuccess: () => void;
  onCancel: () => void;
}

export function MortalityForm({
  flockId,
  flockIdentifier,
  currentBirdCount,
  onSuccess,
  onCancel,
}: MortalityFormProps) {
  const [quantity, setQuantity] = React.useState<string>("");
  const [eventDate, setEventDate] = React.useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [reason, setReason] = React.useState<string>("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [isPending, setIsPending] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    const parsedQty = parseInt(quantity, 10);
    const inputData: RecordMortalityInput = {
      flock_id: flockId,
      quantity: isNaN(parsedQty) ? (undefined as unknown as number) : parsedQty,
      event_date: eventDate,
      reason: reason.trim() || undefined,
    };

    const parsed = recordMortalitySchema.safeParse(inputData);
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
    const result = await recordMortality(parsed.data);
    setIsPending(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success("Mortality event recorded successfully.");
    onSuccess();
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Record Mortality</DialogTitle>
        <DialogDescription>
          Record bird deaths for <span className="font-semibold">{flockIdentifier}</span>.
          Current bird count: <span className="font-semibold">{currentBirdCount}</span>.
          The count will be updated automatically via RPC.
        </DialogDescription>
      </DialogHeader>

      <form id="mortality-form" onSubmit={handleSubmit} className="space-y-4 py-2">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="mortality_quantity">
              Birds Died <span className="text-destructive">*</span>
            </Label>
            <Input
              id="mortality_quantity"
              type="number"
              min={1}
              max={currentBirdCount}
              placeholder="e.g. 5"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
            {errors.quantity && (
              <p className="text-xs text-destructive">{errors.quantity}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="mortality_event_date">
              Event Date <span className="text-destructive">*</span>
            </Label>
            <Input
              id="mortality_event_date"
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
            />
            {errors.event_date && (
              <p className="text-xs text-destructive">{errors.event_date}</p>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="mortality_reason">Reason / Cause</Label>
          <Textarea
            id="mortality_reason"
            rows={3}
            placeholder="e.g. Respiratory disease, heat stress..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          {errors.reason && (
            <p className="text-xs text-destructive">{errors.reason}</p>
          )}
        </div>
      </form>

      <DialogFooter>
        <DialogClose render={<Button variant="outline" type="button" onClick={onCancel} />}>
          Cancel
        </DialogClose>
        <Button
          type="submit"
          form="mortality-form"
          variant="destructive"
          disabled={isPending}
        >
          {isPending ? "Recording..." : "Record Mortality"}
        </Button>
      </DialogFooter>
    </>
  );
}
