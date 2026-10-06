"use client";

import * as React from "react";
import { PackagePlus } from "lucide-react";
import { toast } from "sonner";
import {
  receiveFeedStockSchema,
} from "@/lib/validations/feed-inventory";
import { receiveFeedStock, type SupplierOption } from "@/actions/feed-inventory";

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
import { DEFAULT_CURRENCY_SYMBOL } from "@/lib/constants";

interface ReceiveStockDialogProps {
  existingFeedTypes: string[];
  suppliers: SupplierOption[];
  isAdmin: boolean;
}

export function ReceiveStockDialog({
  existingFeedTypes,
  suppliers,
  isAdmin,
}: ReceiveStockDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [isPending, setIsPending] = React.useState(false);
  const [isNewType, setIsNewType] = React.useState(existingFeedTypes.length === 0);

  // Form state
  const [feedType, setFeedType] = React.useState(existingFeedTypes.length === 0 ? "" : existingFeedTypes[0]);
  const [quantityKg, setQuantityKg] = React.useState("");
  const [costPerKg, setCostPerKg] = React.useState("0");
  const [supplierId, setSupplierId] = React.useState("none");
  const [intakeDate, setIntakeDate] = React.useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [notes, setNotes] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  if (!isAdmin) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const rawData = {
      feed_type: feedType,
      quantity_kg: parseFloat(quantityKg),
      cost_per_kg: parseFloat(costPerKg),
      supplier_id: supplierId === "none" ? null : supplierId,
      intake_date: intakeDate,
      notes,
    };

    const parsed = receiveFeedStockSchema.safeParse(rawData);
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

    setIsPending(true);
    const result = await receiveFeedStock(parsed.data);
    setIsPending(false);

    if (!result.success) {
      toast.error("Stock intake failed", {
        description: result.error,
      });
      return;
    }

    toast.success("Stock received", {
      description: `${parsed.data.quantity_kg} kg of ${parsed.data.feed_type} has been added.`,
    });
    setOpen(false);
    
    // Reset form
    setFeedType(existingFeedTypes.length === 0 ? "" : existingFeedTypes[0]);
    setQuantityKg("");
    setCostPerKg("0");
    setSupplierId("none");
    setNotes("");
    setIsNewType(existingFeedTypes.length === 0);
  };

  return (
    <>
      <Button size="sm" className="h-8 gap-1.5" onClick={() => setOpen(true)}>
        <PackagePlus className="size-3.5" />
        Receive Stock
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Receive Feed Stock</DialogTitle>
            <DialogDescription>
              Record new feed inventory delivery. This action is irreversible.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Feed Type</Label>
                {existingFeedTypes.length > 0 && (
                  <div className="flex items-center gap-2 mb-2">
                    <Button
                      type="button"
                      variant={!isNewType ? "secondary" : "outline"}
                      size="sm"
                      className="h-6 text-[10px] px-2"
                      onClick={() => {
                        setIsNewType(false);
                        setFeedType(existingFeedTypes[0]);
                      }}
                    >
                      Select Existing
                    </Button>
                    <Button
                      type="button"
                      variant={isNewType ? "secondary" : "outline"}
                      size="sm"
                      className="h-6 text-[10px] px-2"
                      onClick={() => {
                        setIsNewType(true);
                        setFeedType("");
                      }}
                    >
                      Enter New
                    </Button>
                  </div>
                )}

                {!isNewType && existingFeedTypes.length > 0 ? (
                  <Select
                    value={feedType}
                    onValueChange={(val) => setFeedType(val ?? "")}
                    disabled={isPending}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select feed type" />
                    </SelectTrigger>
                    <SelectContent>
                      {existingFeedTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={feedType}
                    onChange={(e) => setFeedType(e.target.value)}
                    placeholder="e.g. Grower Mash, Layer Pellets"
                    disabled={isPending}
                  />
                )}
                {errors.feed_type && (
                  <p className="text-[10px] text-destructive">{errors.feed_type}</p>
                )}
              </div>

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
                  <Label>Cost per kg ({DEFAULT_CURRENCY_SYMBOL})</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={costPerKg}
                    onChange={(e) => setCostPerKg(e.target.value)}
                    placeholder="0.00"
                    disabled={isPending}
                  />
                  {errors.cost_per_kg && (
                    <p className="text-[10px] text-destructive">{errors.cost_per_kg}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Intake Date</Label>
                  <Input
                    type="date"
                    value={intakeDate}
                    onChange={(e) => setIntakeDate(e.target.value)}
                    disabled={isPending}
                  />
                  {errors.intake_date && (
                    <p className="text-[10px] text-destructive">{errors.intake_date}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Supplier (Optional)</Label>
                  <Select
                    value={supplierId}
                    onValueChange={(val) => setSupplierId(val ?? "none")}
                    disabled={isPending || suppliers.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="No supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" className="text-muted-foreground italic">None</SelectItem>
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.supplier_id && (
                    <p className="text-[10px] text-destructive">{errors.supplier_id}</p>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Notes (Optional)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Delivery details, lot numbers, etc."
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
                {isPending ? "Saving..." : "Receive Stock"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
