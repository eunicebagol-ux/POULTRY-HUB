"use client";

import * as React from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdjustDialog } from "@/components/egg-inventory/adjust-dialog";

/**
 * Client-side boundary component for ADMIN actions in the Egg Inventory page.
 * Rendered only when profile.role === "ADMIN" (enforced in the Server Component parent).
 */
export function EggInventoryActions() {
  const [isAdjustOpen, setIsAdjustOpen] = React.useState(false);

  return (
    <div className="flex justify-end">
      <Button
        id="open-adjust-inventory-btn"
        variant="outline"
        size="sm"
        onClick={() => setIsAdjustOpen(true)}
      >
        <SlidersHorizontal className="mr-2 size-4" />
        Adjust Inventory
      </Button>

      <AdjustDialog
        open={isAdjustOpen}
        onOpenChange={setIsAdjustOpen}
      />
    </div>
  );
}
