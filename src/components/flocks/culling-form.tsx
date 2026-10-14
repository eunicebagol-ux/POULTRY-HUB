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
  recordCullingSchema,
  type RecordCullingInput,
} from "@/lib/validations/flocks";
import { recordCulling } from "@/actions/flocks";

interface CullingFormProps {
  flockId: string;
  flockIdentifier: string;
  currentBirdCount: number;
  onSuccess: () => void;
  onCancel: () => void;
}

export function CullingForm({
  flockId,
  flockIdentifier,
  currentBirdCount,
  onSuccess,
  onCancel,
}: CullingFormProps) {
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
    const inputData: RecordCullingInput = {
      flock_id: flockId,
      quantity: isNaN(parsedQty) ? (undefined as unknown as number) : parsedQty,
      event_date: eventDate,
      reason: reason.trim() || undefined,
    };

    const parsed = recordCullingSchema.safeParse(inputData);
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
    const result = await recordCulling(parsed.data);
    setIsPending(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success("Culling event recorded successfully.");
    onSuccess();
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Record Culling</DialogTitle>
        <DialogDescription>
          Record birds removed from <span className="font-semibold">{flockIdentifier}</span>.
          Current bird count: <span className="font-semibold">{currentBirdCount}</span>.
          The count will be updated automatically via RPC.
        </DialogDescription>
      </DialogHeader>

      <form id="culling-form" onSubmit={handleSubmit} className="space-y-4 py-2">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="culling_quantity">
              Birds Culled <span className="text-destructive">*</span>
            </Label>
            <Input
              id="culling_quantity"
              type="number"
              min={1}
              max={currentBirdCount}
              placeholder="e.g. 10"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
            {errors.quantity && (
              <p className="text-xs text-destructive">{errors.quantity}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="culling_event_date">
              Event Date <span className="text-destructive">*</span>
            </Label>
            <Input
              id="culling_event_date"
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
          <Label htmlFor="culling_reason">Reason</Label>
          <Textarea
            id="culling_reason"
            rows={3}
            placeholder="e.g. Low productivity, disease, selective culling..."
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
          form="culling-form"
          disabled={isPending}
          className="bg-amber-600 text-white hover:bg-amber-700"
        >
          {isPending ? "Recording..." : "Record Culling"}
        </Button>
      </DialogFooter>
    </>
  );
}
