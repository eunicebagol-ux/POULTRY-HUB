"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import type { EggShellColor } from "@/types";

interface EggShellColorBadgeProps {
  color?: EggShellColor | string | null;
  className?: string;
  size?: "sm" | "default";
}

export function EggShellColorBadge({
  color,
  className = "",
  size = "default",
}: EggShellColorBadgeProps) {
  const normalizedColor = color?.trim() || "Brown";

  if (normalizedColor === "Brown") {
    return (
      <Badge
        variant="outline"
        className={`inline-flex items-center gap-1.5 font-medium border-amber-800/30 bg-amber-900/10 text-amber-950 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-700/40 ${
          size === "sm" ? "px-1.5 py-0 text-[10px]" : "px-2 py-0.5 text-xs"
        } ${className}`}
      >
        <span
          className="size-2 rounded-full shrink-0 shadow-xs"
          style={{ backgroundColor: "#8B5A2B" }}
          aria-hidden="true"
        />
        <span>Brown</span>
      </Badge>
    );
  }

  if (normalizedColor === "White") {
    return (
      <Badge
        variant="outline"
        className={`inline-flex items-center gap-1.5 font-medium border-slate-300 bg-slate-100 text-slate-900 dark:bg-slate-800/80 dark:text-slate-100 dark:border-slate-600 ${
          size === "sm" ? "px-1.5 py-0 text-[10px]" : "px-2 py-0.5 text-xs"
        } ${className}`}
      >
        <span
          className="size-2 rounded-full bg-white border border-slate-400 dark:border-slate-300 shrink-0 shadow-xs"
          aria-hidden="true"
        />
        <span>White</span>
      </Badge>
    );
  }

  if (normalizedColor === "Cream / Tinted" || normalizedColor.toLowerCase().includes("cream")) {
    return (
      <Badge
        variant="outline"
        className={`inline-flex items-center gap-1.5 font-medium border-amber-300/80 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-800/50 ${
          size === "sm" ? "px-1.5 py-0 text-[10px]" : "px-2 py-0.5 text-xs"
        } ${className}`}
      >
        <span
          className="size-2 rounded-full border border-amber-400 shrink-0 shadow-xs"
          style={{ backgroundColor: "#F5E6D3" }}
          aria-hidden="true"
        />
        <span>Cream / Tinted</span>
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={`inline-flex items-center gap-1.5 font-medium border-border/80 bg-muted/60 text-muted-foreground ${
        size === "sm" ? "px-1.5 py-0 text-[10px]" : "px-2 py-0.5 text-xs"
      } ${className}`}
    >
      <span className="size-2 rounded-full bg-muted-foreground/60 shrink-0" aria-hidden="true" />
      <span>{normalizedColor || "Other"}</span>
    </Badge>
  );
}
