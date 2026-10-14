"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Sidebar } from "./sidebar";
import type { UserRole } from "@/types";

interface MobileNavProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userRole: UserRole;
  userName?: string;
}

export function MobileNav({ open, onOpenChange, userRole, userName }: MobileNavProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-xs h-full min-h-screen border-r border-slate-800 bg-slate-900 rounded-none sm:rounded-none [&>button]:text-slate-400 [&>button]:hover:text-white">
        <DialogTitle className="sr-only">POULTRY HUB Navigation Menu</DialogTitle>
        <Sidebar
          userRole={userRole}
          userName={userName}
          onNavigate={() => onOpenChange(false)}
          className="w-full h-full border-r-0"
        />
      </DialogContent>
    </Dialog>
  );
}
