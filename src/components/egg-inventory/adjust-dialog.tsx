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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { EGG_SIZES, EGG_SIZE_LABELS } from "@/lib/constants";
import { adjustEggInventorySchema } from "@/lib/validations/egg-inventory";
import { adjustEggInventory } from "@/actions/egg-inventory";
import type { EggSize } from "@/types";

interface AdjustDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** If provided, pre-selects this size in the form */
  defaultSize?: EggSize;
}

interface AdjustFormProps {
  defaultSize?: EggSize;
  onClose: () => void;
}

function AdjustForm({ defaultSize, onClose }: AdjustFormProps) {
  const [size, setSize] = React.useState<EggSize>(defaultSize ?? "LARGE");
  const [adjustmentInput, setAdjustmentInput] = React.useState<string>("");
  const [reason, setReason] = React.useState<string>("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [isPending, setIsPending] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    const adjustmentNum = parseInt(adjustmentInput, 10);

    const parsed = adjustEggInventorySchema.safeParse({
      size,
      adjustment: isNaN(adjustmentNum) ? 0 : adjustmentNum,
      reason: reason.trim(),
    });

    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".") || "form";
        if (!fieldErrors[key]) {
          fieldErrors[key] = issue.message;
        }
      }
      setErrors(fieldErrors);
      return;
    }

    setIsPending(true);
    const result = await adjustEggInventory(parsed.data);
    setIsPending(false);

    if (!result.success) {
      toast.error("Adjustment failed", { description: result.error });
      return;
    }

    toast.success("Inventory adjusted", {
      description: `${EGG_SIZE_LABELS[parsed.data.size]} adjusted by ${
        parsed.data.adjustment > 0 ? "+" : ""
      }${parsed.data.adjustment} pcs.`,
    });
    onClose();
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Adjust Egg Inventory</DialogTitle>
        <DialogDescription>
          Enter a signed adjustment (positive to add, negative to deduct). A
          mandatory reason is required for the audit log.
        </DialogDescription>
      </DialogHeader>

      <form
        id="adjust-egg-inventory-form"
        onSubmit={handleSubmit}
        className="space-y-4 py-2"
      >
        {/* Size */}
        <div className="space-y-1.5">
          <Label htmlFor="adjust-size-select">
            Egg Size <span className="text-destructive">*</span>
          </Label>
          <Select
            value={size}
            onValueChange={(val) => setSize((val as EggSize) ?? "LARGE")}
            disabled={isPending}
          >
            <SelectTrigger id="adjust-size-select">
              <SelectValue placeholder="Select size" />
            </SelectTrigger>
            <SelectContent>
              {EGG_SIZES.map((s) => (
                <SelectItem key={s} value={s}>
                  {EGG_SIZE_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors["size"] && (
            <p className="text-xs text-destructive">{errors["size"]}</p>
          )}
        </div>

        {/* Adjustment amount */}
        <div className="space-y-1.5">
          <Label htmlFor="adjust-amount-input">
            Adjustment (pieces) <span className="text-destructive">*</span>
          </Label>
          <Input
            id="adjust-amount-input"
            type="number"
            placeholder="e.g. -30 or +60"
            disabled={isPending}
            value={adjustmentInput}
            onChange={(e) => setAdjustmentInput(e.target.value)}
          />
          <p className="text-[11px] text-muted-foreground">
            Positive = add stock &nbsp;·&nbsp; Negative = deduct stock
          </p>
          {errors["adjustment"] && (
            <p className="text-xs text-destructive">{errors["adjustment"]}</p>
          )}
        </div>

        {/* Reason */}
        <div className="space-y-1.5">
          <Label htmlFor="adjust-reason-textarea">
            Reason / Justification <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="adjust-reason-textarea"
            placeholder="Explain why this adjustment is needed (min. 10 characters)…"
            rows={3}
            disabled={isPending}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          {errors["reason"] && (
            <p className="text-xs text-destructive">{errors["reason"]}</p>
          )}
          {errors["form"] && (
            <p className="text-xs text-destructive">{errors["form"]}</p>
          )}
        </div>
      </form>

      <DialogFooter>
        <Button
          variant="outline"
          onClick={onClose}
          disabled={isPending}
          type="button"
        >
          Cancel
        </Button>
        <Button
          id="confirm-adjust-btn"
          type="submit"
          form="adjust-egg-inventory-form"
          disabled={isPending}
        >
          {isPending ? "Applying…" : "Apply Adjustment"}
        </Button>
      </DialogFooter>
    </>
  );
}

export function AdjustDialog({
  open,
  onOpenChange,
  defaultSize,
}: AdjustDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open && (
          <AdjustForm
            defaultSize={defaultSize}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
