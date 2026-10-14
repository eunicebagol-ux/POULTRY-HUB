"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Egg, Wheat, Utensils, ShoppingCart, AlertCircle, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export function QuickActions() {
  const actions = [
    {
      label: "Record Egg Production",
      href: "/egg-production",
      icon: Egg,
      color: "bg-emerald-600 text-white hover:bg-emerald-700",
    },
    {
      label: "Record Feed Intake",
      href: "/feed-inventory",
      icon: Wheat,
      color: "bg-amber-600 text-white hover:bg-amber-700",
    },
    {
      label: "Record Feed Consumption",
      href: "/feed-consumption",
      icon: Utensils,
      color: "bg-sky-600 text-white hover:bg-sky-700",
    },
    {
      label: "Record Egg Sale",
      href: "/egg-sales",
      icon: ShoppingCart,
      color: "bg-indigo-600 text-white hover:bg-indigo-700",
    },
    {
      label: "Record Mortality / Culling",
      href: "/flocks",
      icon: AlertCircle,
      color: "bg-slate-700 text-white hover:bg-slate-800",
    },
  ];

  return (
    <Card className="border-border/60 shadow-xs">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Zap className="size-4 text-emerald-600" />
          <CardTitle className="text-base font-bold">Quick Operations</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.label}
                href={action.href}
                className={cn(
                  "h-auto py-3 px-4 flex flex-col items-center justify-center gap-2 text-center rounded-xl shadow-xs transition-all text-xs font-semibold leading-tight",
                  action.color
                )}
              >
                <Icon className="size-5 shrink-0" />
                <span>{action.label}</span>
              </Link>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
