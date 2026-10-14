import {
  LayoutDashboard,
  Egg,
  Layers,
  Package,
  Wheat,
  UtensilsCrossed,
  ShoppingCart,
  Users,
  Truck,
  Receipt,
  BarChart3,
  UserCheck,
  History,
  Settings,
  ClipboardList,
  type LucideIcon,
} from "lucide-react";
import type { UserRole } from "@/types";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

export interface NavGroup {
  groupLabel: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    groupLabel: "MAIN",
    items: [
      {
        title: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    groupLabel: "PRODUCTION",
    items: [
      {
        title: "Egg Production",
        href: "/egg-production",
        icon: Egg,
      },
      {
        title: "Flock Management",
        href: "/flocks",
        icon: Layers,
      },
    ],
  },
  {
    groupLabel: "INVENTORY",
    items: [
      {
        title: "Egg Inventory",
        href: "/egg-inventory",
        icon: Package,
      },
      {
        title: "Feed Inventory",
        href: "/feed-inventory",
        icon: Wheat,
      },
      {
        title: "Feed Consumption",
        href: "/feed-consumption",
        icon: UtensilsCrossed,
      },
    ],
  },
  {
    groupLabel: "SALES",
    items: [
      {
        title: "Customer Orders",
        href: "/customer-orders",
        icon: ClipboardList,
      },
      {
        title: "Egg Sales",
        href: "/egg-sales",
        icon: ShoppingCart,
      },
      {
        title: "Customers",
        href: "/customers",
        icon: Users,
      },
    ],
  },
  {
    groupLabel: "MANAGEMENT",
    items: [
      {
        title: "Suppliers",
        href: "/suppliers",
        icon: Truck,
      },
      {
        title: "Expenses",
        href: "/expenses",
        icon: Receipt,
      },
    ],
  },
  {
    groupLabel: "REPORTS",
    items: [
      {
        title: "Reports",
        href: "/reports",
        icon: BarChart3,
      },
    ],
  },
  {
    groupLabel: "ADMINISTRATION",
    items: [
      {
        title: "Users",
        href: "/users",
        icon: UserCheck,
        adminOnly: true,
      },
      {
        title: "Activity Logs",
        href: "/activity-logs",
        icon: History,
        adminOnly: true,
      },
      {
        title: "Settings",
        href: "/settings",
        icon: Settings,
        adminOnly: true,
      },
    ],
  },
];

export function filterNavGroupsByRole(role: UserRole): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.adminOnly || role === "ADMIN"),
  })).filter((group) => group.items.length > 0);
}
