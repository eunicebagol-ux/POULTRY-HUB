"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { User, Phone, MapPin, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { updateCustomerProfile } from "@/actions/customer-portal";

interface CustomerProfileFormProps {
  initialFullName: string;
  initialPhone: string | null;
  initialAddress: string | null;
  email: string | null;
}

export function CustomerProfileForm({
  initialFullName,
  initialPhone,
  initialAddress,
  email,
}: CustomerProfileFormProps) {
  const router = useRouter();
  const [fullName, setFullName] = React.useState(initialFullName);
  const [phone, setPhone] = React.useState(initialPhone ?? "");
  const [address, setAddress] = React.useState(initialAddress ?? "");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      const res = await updateCustomerProfile({
        full_name: fullName,
        phone: phone || null,
        address: address || null,
      });

      if (!res.success) {
        setErrorMessage(res.error || "Failed to update profile.");
      } else {
        setSuccessMessage("Your profile information has been saved successfully.");
        router.refresh();
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
      {successMessage && (
        <Alert className="border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300">
          <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
          <AlertDescription className="text-xs font-medium">
            {successMessage}
          </AlertDescription>
        </Alert>
      )}

      {errorMessage && (
        <Alert className="border-destructive/30 bg-destructive/10 text-destructive">
          <AlertCircle className="size-4" />
          <AlertDescription className="text-xs font-medium">
            {errorMessage}
          </AlertDescription>
        </Alert>
      )}

      {/* Email Address (Read-only from Clerk) */}
      <div className="space-y-1.5">
        <Label htmlFor="email" className="text-xs text-muted-foreground">
          Email Address (Managed via Clerk Auth)
        </Label>
        <Input
          id="email"
          type="email"
          value={email || ""}
          disabled
          className="bg-muted/50 cursor-not-allowed text-xs text-muted-foreground"
        />
      </div>

      {/* Full Name */}
      <div className="space-y-1.5">
        <Label htmlFor="fullName" className="text-xs font-medium">
          Full Name / Business Name *
        </Label>
        <div className="relative">
          <User className="absolute left-3 top-2.5 size-4 text-muted-foreground pointer-events-none" />
          <Input
            id="fullName"
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your name or store name"
            className="pl-9 text-xs"
          />
        </div>
      </div>

      {/* Phone Number */}
      <div className="space-y-1.5">
        <Label htmlFor="phone" className="text-xs font-medium">
          Contact Phone Number
        </Label>
        <div className="relative">
          <Phone className="absolute left-3 top-2.5 size-4 text-muted-foreground pointer-events-none" />
          <Input
            id="phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="e.g. 0917-123-4567"
            className="pl-9 text-xs"
          />
        </div>
      </div>

      {/* Delivery / Business Address */}
      <div className="space-y-1.5">
        <Label htmlFor="address" className="text-xs font-medium">
          Delivery / Store Address
        </Label>
        <div className="relative">
          <MapPin className="absolute left-3 top-2.5 size-4 text-muted-foreground pointer-events-none" />
          <Input
            id="address"
            type="text"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="e.g. Barangay San Isidro, General Santos City"
            className="pl-9 text-xs"
          />
        </div>
      </div>

      <div className="pt-2">
        <Button
          type="submit"
          disabled={isSubmitting || !fullName.trim()}
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-sm"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="size-3.5 mr-1.5 animate-spin" />
              Saving Profile...
            </>
          ) : (
            "Save Changes"
          )}
        </Button>
      </div>
    </form>
  );
}
