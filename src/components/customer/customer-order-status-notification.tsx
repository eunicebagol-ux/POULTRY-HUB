"use client";

import * as React from "react";
import Link from "next/link";
import {
  Clock,
  CheckCircle2,
  Package,
  Store,
  CheckCheck,
  XCircle,
  X,
  ArrowRight,
  BellRing,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  type CustomerOrderNotificationView,
  dismissCustomerOrderNotification,
  getLatestCustomerOrderNotification,
} from "@/actions/customer-order-notifications";
import { createClient } from "@/lib/supabase/client";
import { cn } from "cn";
import type { CustomerOrderStatus } from "@/types";

interface CustomerOrderStatusNotificationProps {
  initialNotification: CustomerOrderNotificationView | null;
}

const STATUS_ICONS: Record<CustomerOrderStatus, React.ElementType> = {
  PENDING: Clock,
  CONFIRMED: CheckCircle2,
  PREPARING: Package,
  READY: Store,
  COMPLETED: CheckCheck,
  CANCELLED: XCircle,
};

const STATUS_THEMES: Record<
  CustomerOrderStatus,
  {
    badgeClass: string;
    iconBgClass: string;
    iconTextClass: string;
    borderAccentClass: string;
  }
> = {
  PENDING: {
    badgeClass: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20",
    iconBgClass: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    iconTextClass: "text-amber-600 dark:text-amber-400",
    borderAccentClass: "border-l-amber-500",
  },
  CONFIRMED: {
    badgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
    iconBgClass: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    iconTextClass: "text-emerald-600 dark:text-emerald-400",
    borderAccentClass: "border-l-emerald-500",
  },
  PREPARING: {
    badgeClass: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20",
    iconBgClass: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
    iconTextClass: "text-blue-600 dark:text-blue-400",
    borderAccentClass: "border-l-blue-500",
  },
  READY: {
    badgeClass: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/20",
    iconBgClass: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400",
    iconTextClass: "text-indigo-600 dark:text-indigo-400",
    borderAccentClass: "border-l-indigo-500",
  },
  COMPLETED: {
    badgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
    iconBgClass: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    iconTextClass: "text-emerald-600 dark:text-emerald-400",
    borderAccentClass: "border-l-emerald-500",
  },
  CANCELLED: {
    badgeClass: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/20",
    iconBgClass: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
    iconTextClass: "text-rose-600 dark:text-rose-400",
    borderAccentClass: "border-l-rose-500",
  },
};

export function CustomerOrderStatusNotification({
  initialNotification,
}: CustomerOrderStatusNotificationProps) {
  const [notification, setNotification] =
    React.useState<CustomerOrderNotificationView | null>(initialNotification);
  const [locallyDismissedId, setLocallyDismissedId] = React.useState<string | null>(null);

  // Subscribe to localStorage changes safely without setState in an effect
  const isStorageDismissed = React.useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener("storage", onStoreChange);
      return () => window.removeEventListener("storage", onStoreChange);
    },
    () => {
      if (!notification) return false;
      const storageKey = `poultryhub_notif_dismissed_${notification.order_id}_${notification.status}`;
      return localStorage.getItem(storageKey) === "true";
    },
    () => false
  );

  const isDismissed =
    Boolean(notification && locallyDismissedId === notification.id) || isStorageDismissed;

  // Handler to refresh notification from server
  const fetchLatestNotification = React.useCallback(async () => {
    try {
      const res = await getLatestCustomerOrderNotification();
      if (res.success && res.data) {
        setNotification(res.data);
      }
    } catch (err) {
      console.warn("Failed to refresh customer order notification:", err);
    }
  }, []);

  // Supabase Realtime subscription + window focus listener
  React.useEffect(() => {
    // 1. Refresh on tab focus
    window.addEventListener("focus", fetchLatestNotification);

    // 2. Realtime subscription to customer_orders and customer_order_notifications
    try {
      const supabase = createClient();
      const channel = supabase
        .channel("customer-portal-order-notifications")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "customer_orders",
          },
          () => {
            fetchLatestNotification();
          }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "customer_order_notifications",
          },
          () => {
            fetchLatestNotification();
          }
        )
        .subscribe();

      return () => {
        window.removeEventListener("focus", fetchLatestNotification);
        supabase.removeChannel(channel);
      };
    } catch {
      return () => {
        window.removeEventListener("focus", fetchLatestNotification);
      };
    }
  }, [fetchLatestNotification]);

  const handleDismiss = async () => {
    if (!notification) return;

    // Immediately hide in UI
    setLocallyDismissedId(notification.id);

    // Persist in localStorage so revisits remember the dismissal
    if (typeof window !== "undefined") {
      const storageKey = `poultryhub_notif_dismissed_${notification.order_id}_${notification.status}`;
      localStorage.setItem(storageKey, "true");
    }

    // Persist to Supabase if notification record exists
    try {
      await dismissCustomerOrderNotification(notification.id);
    } catch (err) {
      console.warn("Could not persist dismiss to server:", err);
    }
  };

  // If no notification or user dismissed it, render nothing
  if (!notification || isDismissed || notification.is_dismissed) {
    return null;
  }

  const StatusIcon = STATUS_ICONS[notification.status] || BellRing;
  const theme = STATUS_THEMES[notification.status] || STATUS_THEMES.PENDING;
  const shortRef = `ORD-${notification.order_id.replace(/-/g, "").slice(0, 7).toUpperCase()}`;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "rounded-xl border border-emerald-500/25 border-l-4 bg-white dark:bg-card shadow-xs p-3.5 space-y-2.5 transition-all duration-200 animate-in fade-in-50 slide-in-from-top-2",
        theme.borderAccentClass
      )}
    >
      {/* Top row: Icon, Title, Ref, and Dismiss Button */}
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={cn(
              "size-8 rounded-lg flex items-center justify-center shrink-0",
              theme.iconBgClass
            )}
          >
            <StatusIcon className="size-4.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h4 className="text-xs font-bold text-foreground">
                {notification.title}
              </h4>
              <Badge
                variant="outline"
                className={cn("text-[9px] px-1.5 py-0 font-mono font-medium", theme.badgeClass)}
              >
                {shortRef}
              </Badge>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Latest order status update
            </p>
          </div>
        </div>

        {/* Dismiss button */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Dismiss notification"
          onClick={handleDismiss}
          className="size-6 text-muted-foreground hover:text-foreground -mr-1 -mt-1 shrink-0 rounded-md"
        >
          <X className="size-3.5" />
        </Button>
      </div>

      {/* Middle row: Short Message */}
      <p className="text-xs text-foreground/90 dark:text-foreground/80 leading-relaxed pl-0.5">
        {notification.message}
      </p>

      {/* Bottom row: Action link */}
      <div className="flex items-center justify-between pt-1 border-t border-border/50">
        <Link
          href="/customer/orders"
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:underline transition-colors"
        >
          <span>View My Orders</span>
          <ArrowRight className="size-3" />
        </Link>
        <span className="text-[10px] text-muted-foreground/70">
          POULTRY HUB
        </span>
      </div>
    </div>
  );
}
