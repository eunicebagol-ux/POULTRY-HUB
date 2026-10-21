"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { recordFeedConsumptionSchema } from "@/lib/validations/feed-consumption";
import {
  recordFeedConsumption,
  type ActiveFlockOption,
  type AvailableFeedOption,
} from "@/actions/feed-consumption";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

interface RecordConsumptionDialogProps {
  flocks: ActiveFlockOption[];
  feedTypes: AvailableFeedOption[];
  isAuthorized: boolean;
}

export function RecordConsumptionDialog({
  flocks,
  feedTypes,
  isAuthorized,
}: RecordConsumptionDialogProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [isPending, setIsPending] = React.useState(false);

  // Form state
  const [flockId, setFlockId] = React.useState(flocks.length > 0 ? flocks[0].id : "");
  const [feedType, setFeedType] = React.useState(
    feedTypes.length > 0 ? feedTypes[0].feed_type : ""
  );
  const [quantityKg, setQuantityKg] = React.useState("");
  const [consumptionDate, setConsumptionDate] = React.useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [notes, setNotes] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  if (!isAuthorized) return null;

  // Selected feed stock
  const selectedFeed = feedTypes.find((f) => f.feed_type === feedType);
  const currentAvailableStock = selectedFeed ? selectedFeed.current_stock_kg : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const rawData = {
      flock_id: flockId,
      feed_type: feedType,
      quantity_kg: parseFloat(quantityKg),
      consumption_date: consumptionDate,
      notes,
    };

    const parsed = recordFeedConsumptionSchema.safeParse(rawData);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        const path = issue.path[0] as string;
        if (!fieldErrors[path]) {
          fieldErrors[path] = issue.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    if (parsed.data.quantity_kg > currentAvailableStock) {
      setErrors({
        quantity_kg: `Requested amount (${parsed.data.quantity_kg} kg) exceeds current available stock (${currentAvailableStock.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg).`,
      });
      return;
    }

    setIsPending(true);
    const result = await recordFeedConsumption(parsed.data);
    setIsPending(false);

    if (!result.success) {
      toast.error("Recording failed", {
        description: result.error,
      });
      return;
    }

    toast.success("Feed consumption recorded", {
      description: `${parsed.data.quantity_kg} kg of ${parsed.data.feed_type} logged for feeding.`,
    });
    router.refresh();
    setOpen(false);

    // Reset form
    setQuantityKg("");
    setNotes("");
    setErrors({});
  };

  const hasNoFlocks = flocks.length === 0;
  const hasNoFeed = feedTypes.length === 0;

  return (
    <>
      <Button
        size="sm"
        className="h-8 gap-1.5"
        onClick={() => setOpen(true)}
        disabled={hasNoFlocks || hasNoFeed}
      >
        <Plus className="size-3.5" />
        Record Consumption
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UtensilsCrossed className="size-4 text-primary" />
              Record Feed Consumption
            </DialogTitle>
            <DialogDescription>
              Log daily feed given to an active flock. Feed inventory will be deducted automatically.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-3">
              {/* Flock Selection */}
              <div className="space-y-1.5">
                <Label>Active Flock</Label>
                <Select
                  value={flockId}
                  onValueChange={(val) => setFlockId(val ?? "")}
                  disabled={isPending || hasNoFlocks}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select active flock" />
                  </SelectTrigger>
                  <SelectContent>
                    {flocks.map((flock) => (
                      <SelectItem key={flock.id} value={flock.id}>
                        {flock.flock_identifier}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.flock_id && (
                  <p className="text-[10px] text-destructive">{errors.flock_id}</p>
                )}
              </div>

              {/* Feed Type Selection */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>Feed Type</Label>
                  {selectedFeed && (
                    <span className="text-[11px] text-muted-foreground">
                      In Stock:{" "}
                      <span className="font-semibold text-foreground">
                        {selectedFeed.current_stock_kg.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{" "}
                        kg
                      </span>
                    </span>
                  )}
                </div>
                <Select
                  value={feedType}
                  onValueChange={(val) => setFeedType(val ?? "")}
                  disabled={isPending || hasNoFeed}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select feed type" />
                  </SelectTrigger>
                  <SelectContent>
                    {feedTypes.map((feed) => (
                      <SelectItem key={feed.feed_type} value={feed.feed_type}>
                        {feed.feed_type} ({feed.current_stock_kg.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })} kg)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.feed_type && (
                  <p className="text-[10px] text-destructive">{errors.feed_type}</p>
                )}
              </div>

              {/* Quantity (kg) & Consumption Date */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Quantity (kg)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={quantityKg}
                    onChange={(e) => setQuantityKg(e.target.value)}
                    placeholder="0.00"
                    disabled={isPending}
                  />
                  {errors.quantity_kg && (
                    <p className="text-[10px] text-destructive">{errors.quantity_kg}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label>Consumption Date</Label>
                  <Input
                    type="date"
                    value={consumptionDate}
                    onChange={(e) => setConsumptionDate(e.target.value)}
                    disabled={isPending}
                  />
                  {errors.consumption_date && (
                    <p className="text-[10px] text-destructive">{errors.consumption_date}</p>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label>Notes (Optional)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Feeding notes, schedule, or conditions..."
                  className="h-16 resize-none"
                  disabled={isPending}
                />
                {errors.notes && (
                  <p className="text-[10px] text-destructive">{errors.notes}</p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Recording..." : "Record Feeding"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
