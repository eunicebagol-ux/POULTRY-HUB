/* eslint-disable @next/next/no-img-element */
"use client";

import * as React from "react";
import { Plus, Building2, Upload, Trash2, CheckCircle2, AlertCircle, Sparkles, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  createSupplierSchema,
  updateSupplierSchema,
} from "@/lib/validations/suppliers";
import {
  createSupplier,
  updateSupplier,
  uploadSupplierLogo,
  type SupplierView,
} from "@/actions/suppliers";
import {
  VERIFIED_SUPPLIER_BRANDS,
  detectBrandFromName,
  resolveSupplierLogo,
  type BrandPreset,
} from "@/lib/supplier-logos";
import { SupplierLogoAvatar } from "./supplier-logo-avatar";
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
  const [isUploadingLogo, setIsUploadingLogo] = React.useState(false);

  // Form fields
  const [name, setName] = React.useState(supplier?.name || "");
  const [contactPerson, setContactPerson] = React.useState(
    supplier?.contact_person || ""
  );
  const [phone, setPhone] = React.useState(supplier?.phone || "");
  const [email, setEmail] = React.useState(supplier?.email || "");
  const [address, setAddress] = React.useState(supplier?.address || "");

  // In Edit mode with an existing saved logo, preserve it by setting manualOverride to true
  const [manualOverride, setManualOverride] = React.useState<boolean>(
    Boolean(isEditing && supplier?.logo_url && supplier.logo_url.trim() !== "")
  );

  // Initial logo URL: saved logo in edit mode, or live auto-detected logo from initial name
  const [logoUrl, setLogoUrl] = React.useState<string>(() => {
    if (supplier?.logo_url && supplier.logo_url.trim() !== "") {
      return supplier.logo_url.trim();
    }
    if (supplier?.name) {
      const match = detectBrandFromName(supplier.name);
      return match ? match.logoUrl : "";
    }
    return "";
  });

  // Collapsible custom logo controls
  const [showCustomLogoControls, setShowCustomLogoControls] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Dynamic detection from current typed name
  const detectedBrand = React.useMemo(() => {
    return detectBrandFromName(name);
  }, [name]);

  // When admin types in Supplier / Business Name:
  // Automatically detects and updates logo immediately (unless manually overridden)
  const handleNameChange = (newName: string) => {
    setName(newName);

    if (!manualOverride) {
      const match = detectBrandFromName(newName);
      if (match) {
        setLogoUrl(match.logoUrl);
      } else {
        setLogoUrl("");
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File exceeds 5MB limit", {
        description: "Please choose a smaller image file.",
      });
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    setIsUploadingLogo(true);
    const result = await uploadSupplierLogo(formData);
    setIsUploadingLogo(false);

    if (!result.success) {
      toast.error("Upload failed", {
        description: result.error,
      });
      return;
    }

    if (result.data?.url) {
      setLogoUrl(result.data.url);
      setManualOverride(true);
      toast.success("Logo uploaded successfully", {
        description: "Custom logo attached to this supplier.",
      });
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemoveLogo = () => {
    setLogoUrl("");
    setManualOverride(true);
    toast.info("Logo removed", {
      description: "Initials fallback will be displayed.",
    });
  };

  const handleResetToAutoDetect = () => {
    setManualOverride(false);
    const match = detectBrandFromName(name);
    if (match) {
      setLogoUrl(match.logoUrl);
      toast.success("Restored auto-detection", {
        description: `Matched verified brand: ${match.name}`,
      });
    } else {
      setLogoUrl("");
      toast.info("Restored auto-detection", {
        description: "No brand matched current name. Using initials fallback.",
      });
    }
  };

  const handleSelectPreset = (preset: BrandPreset) => {
    setLogoUrl(preset.logoUrl);
    setManualOverride(true);
    if (!name || name.trim() === "") {
      setName(preset.name);
    }
    if (!address || address.trim() === "") {
      setAddress(preset.location);
    }
    toast.success(`Selected ${preset.name}`, {
      description: preset.notes,
    });
  };

  const currentLogoResolved = resolveSupplierLogo({
    name: name || "Supplier",
    logo_url: logoUrl,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const formData = {
      name,
      contact_person: contactPerson,
      phone,
      email,
      address,
      logo_url: logoUrl ? logoUrl.trim() : null,
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
        description: `Supplier "${parsed.data.name}" registered with its verified logo.`,
      });
      onClose();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Supplier / Business Name with Integrated Live Logo Preview */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="supplier-name" className="text-xs font-semibold">
            Supplier / Business Name <span className="text-destructive">*</span>
          </Label>
          <button
            type="button"
            onClick={() => setShowCustomLogoControls((prev) => !prev)}
            className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition-colors"
            title="Optional custom logo upload and brand presets"
          >
            <Sparkles className="size-3 text-primary" />
            <span>{showCustomLogoControls ? "Hide logo options" : "Customize logo"}</span>
          </button>
        </div>

        {/* Input with Logo Preview integrated directly inside the right side */}
        <div className="relative flex items-center">
          <Input
            id="supplier-name"
            placeholder="e.g., SM Supermarket, Robinsons Place, Puregold Butuan"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            disabled={isPending}
            className="h-10 pr-11 text-sm font-medium"
            autoFocus
          />
          <div className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none">
            <SupplierLogoAvatar
              supplier={{ name: name || "Supplier", logo_url: logoUrl }}
              size="sm"
              showStatusBadge
            />
          </div>
        </div>

        {/* Live Auto-Detection / Status Feedback directly under input */}
        <div className="flex items-center justify-between text-[11px] px-0.5">
          {errors.name ? (
            <p className="font-medium text-destructive">{errors.name}</p>
          ) : (
            <div className="flex items-center gap-1.5 truncate">
              {!manualOverride && detectedBrand ? (
                detectedBrand.status === "VERIFIED" ? (
                  <span className="text-green-600 dark:text-green-400 font-medium inline-flex items-center gap-1 truncate">
                    <CheckCircle2 className="size-3 shrink-0" />
                    <span>Automatically detected: {detectedBrand.name}</span>
                  </span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400 font-medium inline-flex items-center gap-1 truncate">
                    <AlertCircle className="size-3 shrink-0" />
                    <span>
                      Automatically detected: {detectedBrand.name} (Unverified — using initials)
                    </span>
                  </span>
                )
              ) : manualOverride && logoUrl ? (
                currentLogoResolved.status === "CUSTOM_UPLOAD" ? (
                  <span className="text-primary font-medium inline-flex items-center gap-1">
                    <Building2 className="size-3 shrink-0" />
                    <span>Custom logo uploaded</span>
                  </span>
                ) : (
                  <span className="text-green-600 dark:text-green-400 font-medium inline-flex items-center gap-1">
                    <CheckCircle2 className="size-3 shrink-0" />
                    <span>Manually selected: {currentLogoResolved.brandName}</span>
                  </span>
                )
              ) : (
                <span className="text-muted-foreground inline-flex items-center gap-1">
                  <Building2 className="size-3 shrink-0" />
                  <span>No verified logo found (using initials)</span>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Optional Collapsible Customize Logo Tray (only shown on demand) */}
        {showCustomLogoControls && (
          <div className="mt-2 p-2.5 rounded-lg border border-border/60 bg-muted/20 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-foreground">Custom Logo Options</span>
              <div className="flex items-center gap-1.5">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={isPending || isUploadingLogo}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 text-[11px] gap-1 px-2"
                  disabled={isPending || isUploadingLogo}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="size-3" />
                  <span>{isUploadingLogo ? "Uploading..." : "Upload custom logo"}</span>
                </Button>

                {logoUrl && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px] text-destructive hover:text-destructive hover:bg-destructive/10 gap-1 px-2"
                    disabled={isPending || isUploadingLogo}
                    onClick={handleRemoveLogo}
                  >
                    <Trash2 className="size-3" />
                    <span>Remove</span>
                  </Button>
                )}

                {manualOverride && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px] text-primary hover:text-primary hover:bg-primary/10 gap-1 px-2"
                    disabled={isPending || isUploadingLogo}
                    onClick={handleResetToAutoDetect}
                    title="Restore live automatic detection from typed name"
                  >
                    <RotateCcw className="size-3" />
                    <span>Auto-detect</span>
                  </Button>
                )}
              </div>
            </div>

            {/* Quick Brand Preset Chips */}
            <div className="pt-1.5 border-t border-border/40">
              <p className="text-[10px] text-muted-foreground mb-1">Pick a verified brand preset:</p>
              <div className="flex flex-wrap gap-1">
                {VERIFIED_SUPPLIER_BRANDS.map((brand) => (
                  <button
                    key={brand.id}
                    type="button"
                    onClick={() => handleSelectPreset(brand)}
                    className={`px-2 py-0.5 rounded text-[10px] border transition-colors inline-flex items-center gap-1 ${
                      logoUrl === brand.logoUrl
                        ? "border-primary bg-primary/10 text-primary font-semibold"
                        : "border-border/60 hover:bg-background text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <img
                      src={brand.logoUrl}
                      alt=""
                      className="size-3 object-contain rounded"
                    />
                    <span>{brand.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
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
            placeholder="e.g., sales@supplier.com"
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
          placeholder="e.g., JC Aquino Ave, Butuan City"
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
          disabled={isPending || isUploadingLogo}
        >
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={isPending || isUploadingLogo}>
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
                <Building2 className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold">
                  {isEditing ? "Edit Supplier" : "Register New Supplier"}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {isEditing
                    ? "Update contact or business details for this vendor."
                    : "Add a new farm vendor, feed mill, or retail partner."}
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
