"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ShoppingCart, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  {
    label: "Dashboard",
    href: "/customer/dashboard",
    icon: LayoutDashboard,
  },
  {
    label: "Place Order",
    href: "/customer/order",
    icon: ShoppingCart,
  },
  {
    label: "My Orders",
    href: "/customer/orders",
    icon: Clock,
  },
];

export function CustomerNav() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-border/60 bg-background/80 backdrop-blur-xs px-4 sm:px-6">
      <div className="container mx-auto max-w-6xl flex items-center gap-1.5 sm:gap-2 py-2 overflow-x-auto text-xs font-medium">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap",
                isActive
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold ring-1 ring-emerald-500/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
            >
              <Icon className="size-3.5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
