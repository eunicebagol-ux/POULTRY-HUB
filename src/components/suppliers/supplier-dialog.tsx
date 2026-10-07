"use client";

import * as React from "react";
import { Plus, Truck, Building2 } from "lucide-react";
import { toast } from "sonner";
import {
  createSupplierSchema,
  updateSupplierSchema,
} from "@/lib/validations/suppliers";
import {
  createSupplier,
  updateSupplier,
  type SupplierView,
} from "@/actions/suppliers";
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

interface SupplierDialogProps {
  supplier?: SupplierView | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  triggerButton?: boolean;
}

interface InnerSupplierFormProps {
  supplier?: SupplierView | null;
  onClose: () => void;
}

function InnerSupplierForm({ supplier, onClose }: InnerSupplierFormProps) {
  const isEditing = !!supplier;
  const [isPending, setIsPending] = React.useState(false);

  // Initialized directly on mount
  const [name, setName] = React.useState(supplier?.name || "");
  const [contactPerson, setContactPerson] = React.useState(
    supplier?.contact_person || ""
  );
  const [phone, setPhone] = React.useState(supplier?.phone || "");
  const [email, setEmail] = React.useState(supplier?.email || "");
  const [address, setAddress] = React.useState(supplier?.address || "");
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const formData = {
      name,
      contact_person: contactPerson,
      phone,
      email,
      address,
    };

    if (isEditing && supplier) {
      const parsed = updateSupplierSchema.safeParse(formData);
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
      const result = await updateSupplier(supplier.id, parsed.data);
      setIsPending(false);

      if (!result.success) {
        toast.error("Failed to update supplier", {
          description: result.error,
        });
        return;
      }

      toast.success("Supplier updated", {
        description: `Supplier "${parsed.data.name || supplier.name}" has been updated.`,
      });
      onClose();
    } else {
      const parsed = createSupplierSchema.safeParse(formData);
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
      const result = await createSupplier(parsed.data);
      setIsPending(false);

      if (!result.success) {
        toast.error("Failed to create supplier", {
          description: result.error,
        });
        return;
      }

      toast.success("Supplier created", {
        description: `Supplier "${parsed.data.name}" has been registered.`,
      });
      onClose();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Supplier / Business Name */}
      <div className="space-y-1.5">
        <Label htmlFor="supplier-name" className="text-xs font-semibold">
          Supplier / Business Name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="supplier-name"
          placeholder="e.g., Acme Feed Mills, VetCare Phils"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={isPending}
          className="h-9"
          autoFocus
        />
        {errors.name && (
          <p className="text-[11px] font-medium text-destructive">
            {errors.name}
          </p>
        )}
      </div>

      {/* Contact Person */}
      <div className="space-y-1.5">
        <Label htmlFor="contact-person" className="text-xs font-semibold">
          Contact Person
        </Label>
        <Input
          id="contact-person"
          placeholder="e.g., John Doe"
          value={contactPerson}
          onChange={(e) => setContactPerson(e.target.value)}
          disabled={isPending}
          className="h-9"
        />
        {errors.contact_person && (
          <p className="text-[11px] font-medium text-destructive">
            {errors.contact_person}
          </p>
        )}
      </div>

      {/* Phone & Email Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="supplier-phone" className="text-xs font-semibold">
            Phone Number
          </Label>
          <Input
            id="supplier-phone"
            type="tel"
            placeholder="e.g., 0917-123-4567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={isPending}
            className="h-9"
          />
          {errors.phone && (
            <p className="text-[11px] font-medium text-destructive">
              {errors.phone}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="supplier-email" className="text-xs font-semibold">
            Email Address
          </Label>
          <Input
            id="supplier-email"
            type="email"
            placeholder="e.g., sales@acmefeeds.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isPending}
            className="h-9"
          />
          {errors.email && (
            <p className="text-[11px] font-medium text-destructive">
              {errors.email}
            </p>
          )}
        </div>
      </div>

      {/* Address */}
      <div className="space-y-1.5">
        <Label htmlFor="supplier-address" className="text-xs font-semibold">
          Address
        </Label>
        <Textarea
          id="supplier-address"
          placeholder="e.g., National Highway, Davao City"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          disabled={isPending}
          rows={2}
          className="resize-none"
        />
        {errors.address && (
          <p className="text-[11px] font-medium text-destructive">
            {errors.address}
          </p>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClose}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending
            ? isEditing
              ? "Saving Changes..."
              : "Registering..."
            : isEditing
            ? "Save Changes"
            : "Add Supplier"}
        </Button>
      </div>
    </form>
  );
}

export function SupplierDialog({
  supplier,
  open: externalOpen,
  onOpenChange: externalOnOpenChange,
  triggerButton = false,
}: SupplierDialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);

  const isControlled = externalOpen !== undefined;
  const open = isControlled ? externalOpen : internalOpen;
  const setOpen = isControlled ? externalOnOpenChange! : setInternalOpen;

  const isEditing = !!supplier;

  return (
    <>
      {triggerButton && (
        <Button
          size="sm"
          className="gap-1.5 shadow-xs"
          onClick={() => setOpen(true)}
        >
          <Plus className="size-4" />
          <span>Add Supplier</span>
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                {isEditing ? (
                  <Building2 className="size-5" />
                ) : (
                  <Truck className="size-5" />
                )}
              </div>
              <div>
                <DialogTitle className="text-base font-semibold">
                  {isEditing ? "Edit Supplier" : "Register New Supplier"}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {isEditing
                    ? "Update contact or business details for this vendor."
                    : "Add a new farm vendor, feed mill, or supplies partner."}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {open && (
            <InnerSupplierForm
              supplier={supplier}
              onClose={() => setOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
