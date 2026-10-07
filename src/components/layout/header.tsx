"use client";

import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { Menu, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-provider";
import { NAV_GROUPS } from "./nav-config";
import type { UserRole } from "@/types";

interface HeaderProps {
  userRole: UserRole;
  userName?: string;
  onOpenMobileNav: () => void;
}

export function Header({ userRole, userName, onOpenMobileNav }: HeaderProps) {
  const pathname = usePathname();

  // Find page title and group label based on current pathname
  let pageTitle = "Dashboard";
  let groupName = "MAIN";

  for (const group of NAV_GROUPS) {
    const matched = group.items.find(
      (item) => item.href === pathname || (item.href !== "/" && pathname.startsWith(item.href))
    );
    if (matched) {
      pageTitle = matched.title;
      groupName = group.groupLabel;
      break;
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-border/60 bg-background/95 px-4 sm:px-6 backdrop-blur supports-backdrop-filter:bg-background/80">
      {/* Left side: Mobile menu toggle + Breadcrumbs / Title */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          className="lg:hidden size-9 shrink-0 border-border/80"
          onClick={onOpenMobileNav}
          aria-label="Open Navigation Menu"
        >
          <Menu className="size-5" />
        </Button>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="hidden sm:inline-block font-medium text-slate-500">
            {groupName}
          </span>
          <ChevronRight className="hidden sm:inline-block size-3.5 text-slate-400" />
          <h1 className="text-sm sm:text-base font-bold tracking-tight text-foreground">
            {pageTitle}
          </h1>
        </div>
      </div>

      {/* Right side: Clerk UserButton + Role pill */}
      <div className="flex items-center gap-3">
        <div className="hidden sm:flex flex-col items-end text-right">
          <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
            {userName || "Farm Operational User"}
          </span>
          <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
            {userRole}
          </span>
        </div>

        <div className="flex items-center gap-3 pl-2 border-l border-border/60">
          <ThemeToggle />
          <UserButton
            appearance={{
              elements: {
                avatarBox: "size-9 rounded-full ring-2 ring-emerald-600/30",
              },
            }}
          />
        </div>
      </div>
    </header>
  );
}
