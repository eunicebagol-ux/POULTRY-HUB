"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  createCustomerSchema,
  type CreateCustomerInput,
} from "@/lib/validations/egg-sales";
import { createCustomer, type CustomerOption } from "@/actions/egg-sales";

interface CustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCustomerCreated?: (customer: CustomerOption) => void;
}

interface InnerFormProps {
  onClose: () => void;
  onCustomerCreated?: (customer: CustomerOption) => void;
}

function InnerCustomerForm({ onClose, onCustomerCreated }: InnerFormProps) {
  const [name, setName] = React.useState("");
  const [contactPerson, setContactPerson] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [address, setAddress] = React.useState("");
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [isPending, setIsPending] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    const inputData: CreateCustomerInput = {
      name: name.trim(),
      contact_person: contactPerson.trim() || undefined,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      address: address.trim() || undefined,
    };

    const parsed = createCustomerSchema.safeParse(inputData);
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
    const result = await createCustomer(parsed.data);
    setIsPending(false);

    if (!result.success) {
      toast.error("Failed to create customer", {
        description: result.error || "An unexpected error occurred.",
      });
      return;
    }

    if (!result.data) {
      toast.error("Failed to create customer", {
        description: "An unexpected error occurred.",
      });
      return;
    }

    toast.success("Customer created", {
      description: `${result.data.name} was added to the customer directory.`,
    });

    if (onCustomerCreated) {
      onCustomerCreated(result.data);
    }
    onClose();
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Add New Customer</DialogTitle>
        <DialogDescription>
          Create a business buyer record for egg sales and invoices.
        </DialogDescription>
      </DialogHeader>

      <form id="create-customer-form" onSubmit={handleSubmit} className="space-y-3.5 py-2">
        {/* Customer Name */}
        <div className="space-y-1.5">
          <Label htmlFor="cust-name-input">
            Business / Customer Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="cust-name-input"
            placeholder="e.g. Metro Supermarket or Aling Nena's Store"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isPending}
          />
          {errors["name"] && (
            <p className="text-xs text-destructive">{errors["name"]}</p>
          )}
        </div>

        {/* Contact Person */}
        <div className="space-y-1.5">
          <Label htmlFor="cust-contact-input">Contact Person</Label>
          <Input
            id="cust-contact-input"
            placeholder="e.g. Juan dela Cruz"
            value={contactPerson}
            onChange={(e) => setContactPerson(e.target.value)}
            disabled={isPending}
          />
          {errors["contact_person"] && (
            <p className="text-xs text-destructive">{errors["contact_person"]}</p>
          )}
        </div>

        {/* Phone & Email */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="cust-phone-input">Phone Number</Label>
            <Input
              id="cust-phone-input"
              placeholder="e.g. 0917-123-4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={isPending}
            />
            {errors["phone"] && (
              <p className="text-xs text-destructive">{errors["phone"]}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cust-email-input">Email</Label>
            <Input
              id="cust-email-input"
              type="email"
              placeholder="e.g. buyer@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isPending}
            />
            {errors["email"] && (
              <p className="text-xs text-destructive">{errors["email"]}</p>
            )}
          </div>
        </div>

        {/* Address */}
        <div className="space-y-1.5">
          <Label htmlFor="cust-address-input">Delivery / Billing Address</Label>
          <Input
            id="cust-address-input"
            placeholder="e.g. Stall 14, Public Market, Butuan City"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            disabled={isPending}
          />
          {errors["address"] && (
            <p className="text-xs text-destructive">{errors["address"]}</p>
          )}
        </div>
      </form>

      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          onClick={onClose}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          form="create-customer-form"
          disabled={isPending}
        >
          {isPending ? "Creating…" : "Save Customer"}
        </Button>
      </DialogFooter>
    </>
  );
}

export function CustomerDialog({
  open,
  onOpenChange,
  onCustomerCreated,
}: CustomerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open && (
          <InnerCustomerForm
            onClose={() => onOpenChange(false)}
            onCustomerCreated={onCustomerCreated}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
