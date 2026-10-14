"use client";

import * as React from "react";
import { Plus, UserPlus, Building2 } from "lucide-react";
import { toast } from "sonner";
import {
  createCustomerSchema,
  updateCustomerSchema,
} from "@/lib/validations/customers";
import {
  createCustomer,
  updateCustomer,
  type CustomerView,
} from "@/actions/customers";
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

interface CustomerDialogProps {
  customer?: CustomerView | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  triggerButton?: boolean;
}

interface InnerCustomerFormProps {
  customer?: CustomerView | null;
  onClose: () => void;
}

function InnerCustomerForm({ customer, onClose }: InnerCustomerFormProps) {
  const isEditing = !!customer;
  const [isPending, setIsPending] = React.useState(false);

  // Initialized directly on mount
  const [name, setName] = React.useState(customer?.name || "");
  const [contactPerson, setContactPerson] = React.useState(
    customer?.contact_person || ""
  );
  const [phone, setPhone] = React.useState(customer?.phone || "");
  const [email, setEmail] = React.useState(customer?.email || "");
  const [address, setAddress] = React.useState(customer?.address || "");
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

    if (isEditing && customer) {
      const parsed = updateCustomerSchema.safeParse(formData);
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
      const result = await updateCustomer(customer.id, parsed.data);
      setIsPending(false);

      if (!result.success) {
        toast.error("Failed to update customer", {
          description: result.error,
        });
        return;
      }

      toast.success("Customer updated", {
        description: `Customer "${parsed.data.name || customer.name}" has been updated.`,
      });
      onClose();
    } else {
      const parsed = createCustomerSchema.safeParse(formData);
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
      const result = await createCustomer(parsed.data);
      setIsPending(false);

      if (!result.success) {
        toast.error("Failed to add customer", {
          description: result.error,
        });
        return;
      }

      toast.success("Customer added", {
        description: `Customer "${parsed.data.name}" has been registered.`,
      });
      onClose();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      <div className="space-y-3">
        {/* Customer / Business Name */}
        <div className="space-y-1.5">
          <Label htmlFor="customer-name">Customer / Business Name *</Label>
          <Input
            id="customer-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Sunrise Bakery, Green Grocer"
            disabled={isPending}
          />
          {errors.name && (
            <p className="text-[10px] text-destructive">{errors.name}</p>
          )}
        </div>

        {/* Contact Person */}
        <div className="space-y-1.5">
          <Label htmlFor="contact-person">Contact Person (Optional)</Label>
          <Input
            id="contact-person"
            value={contactPerson}
            onChange={(e) => setContactPerson(e.target.value)}
            placeholder="e.g. John Doe, Maria Santos"
            disabled={isPending}
          />
          {errors.contact_person && (
            <p className="text-[10px] text-destructive">
              {errors.contact_person}
            </p>
          )}
        </div>

        {/* Phone & Email */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="customer-phone">Phone (Optional)</Label>
            <Input
              id="customer-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0917-123-4567"
              disabled={isPending}
            />
            {errors.phone && (
              <p className="text-[10px] text-destructive">{errors.phone}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="customer-email">Email (Optional)</Label>
            <Input
              id="customer-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="contact@business.com"
              disabled={isPending}
            />
            {errors.email && (
              <p className="text-[10px] text-destructive">{errors.email}</p>
            )}
          </div>
        </div>

        {/* Address */}
        <div className="space-y-1.5">
          <Label htmlFor="customer-address">Address (Optional)</Label>
          <Textarea
            id="customer-address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Delivery address, street, or city..."
            className="h-16 resize-none"
            disabled={isPending}
          />
          {errors.address && (
            <p className="text-[10px] text-destructive">{errors.address}</p>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending
            ? "Saving..."
            : isEditing
            ? "Save Changes"
            : "Add Customer"}
        </Button>
      </div>
    </form>
  );
}

export function CustomerDialog({
  customer,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  triggerButton = false,
}: CustomerDialogProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? setControlledOpen! : setInternalOpen;

  const isEditing = !!customer;

  return (
    <>
      {triggerButton && (
        <Button size="sm" className="h-8 gap-1.5" onClick={() => setOpen(true)}>
          <Plus className="size-3.5" />
          Add Customer
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isEditing ? (
                <Building2 className="size-4 text-primary" />
              ) : (
                <UserPlus className="size-4 text-primary" />
              )}
              {isEditing ? "Edit Customer" : "Add New Customer"}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Update customer contact details and business directory info."
                : "Register a new egg buyer or customer in the business directory."}
            </DialogDescription>
          </DialogHeader>

          {open && (
            <InnerCustomerForm
              key={customer?.id ?? "new"}
              customer={customer}
              onClose={() => setOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
