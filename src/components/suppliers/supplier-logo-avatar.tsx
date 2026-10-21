/* eslint-disable @next/next/no-img-element */
"use client";

import * as React from "react";
import { CheckCircle2, AlertCircle, Building2 } from "lucide-react";
import {
  resolveSupplierLogo,
  getSupplierInitials,
} from "@/lib/supplier-logos";

interface SupplierLogoAvatarProps {
  supplier: {
    name: string;
    logo_url?: string | null;
  };
  size?: "sm" | "md" | "lg";
  showStatusBadge?: boolean;
  className?: string;
}

export function SupplierLogoAvatar({
  supplier,
  size = "md",
  showStatusBadge = false,
  className = "",
}: SupplierLogoAvatarProps) {
  const [imageError, setImageError] = React.useState(false);
  const resolved = resolveSupplierLogo(supplier);

  // Reset error when logo source changes using standard state adjustment during render
  const [prevUrl, setPrevUrl] = React.useState(resolved.url);
  if (prevUrl !== resolved.url) {
    setPrevUrl(resolved.url);
    setImageError(false);
  }

  const initials = getSupplierInitials(supplier.name);

  const sizeClasses = {
    sm: "size-7 text-[11px] rounded-md",
    md: "size-9 text-xs rounded-lg",
    lg: "size-14 text-base rounded-xl",
  }[size];

  const imgDimensions = {
    sm: 28,
    md: 36,
    lg: 56,
  }[size];

  const hasValidLogo = resolved.url && !imageError;

  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
      {hasValidLogo ? (
        <div
          className={`${sizeClasses} border border-border/60 bg-white dark:bg-zinc-900 p-1 shadow-2xs overflow-hidden flex items-center justify-center`}
          title={`${supplier.name} (${
            resolved.status === "VERIFIED"
              ? "Verified Official Brand"
              : resolved.status === "INITIALS_FALLBACK"
              ? "Initials Fallback (Awaiting Official Vector Asset)"
              : "Uploaded Custom Logo"
          })`}
        >
          <img
            src={resolved.url!}
            alt={`${supplier.name} logo`}
            width={imgDimensions}
            height={imgDimensions}
            onError={() => setImageError(true)}
            className="size-full object-contain select-none"
          />
        </div>
      ) : (
        <div
          className={`${sizeClasses} border border-primary/25 bg-primary/10 text-primary font-bold tracking-wider flex items-center justify-center shadow-2xs select-none`}
          title={`${supplier.name} (Initials Fallback)`}
        >
          {initials}
        </div>
      )}

      {/* Optional Status Indicator Badge */}
      {showStatusBadge && (
        <span
          className="absolute -bottom-1 -right-1 flex items-center justify-center rounded-full bg-background ring-1 ring-border p-0.5"
          title={
            resolved.status === "VERIFIED"
              ? "Verified Official Brand Logo"
              : resolved.status === "INITIALS_FALLBACK"
              ? "Initials Fallback: Awaiting official corporate vector artwork"
              : resolved.status === "CUSTOM_UPLOAD"
              ? "Custom Uploaded Logo"
              : "No Logo Assigned"
          }
        >
          {resolved.status === "VERIFIED" ? (
            <CheckCircle2 className="size-3 text-green-600 dark:text-green-400" />
          ) : resolved.status === "INITIALS_FALLBACK" ? (
            <AlertCircle className="size-3 text-amber-500" />
          ) : (
            <Building2 className="size-3 text-muted-foreground" />
          )}
        </span>
      )}
    </div>
  );
}
