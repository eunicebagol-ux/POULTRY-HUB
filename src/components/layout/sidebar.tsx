"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Egg, ShieldCheck, User } from "lucide-react";
import { filterNavGroupsByRole } from "./nav-config";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types";

interface SidebarProps {
  userRole: UserRole;
  userName?: string;
  onNavigate?: () => void;
  className?: string;
}

export function Sidebar({ userRole, userName, onNavigate, className }: SidebarProps) {
  const pathname = usePathname();
  const navGroups = filterNavGroupsByRole(userRole);

  return (
    <aside
      className={cn(
        "flex h-full w-64 flex-col border-r border-emerald-950/10 bg-slate-900 text-slate-100 dark:bg-slate-950",
        className
      )}
    >
      {/* ── Brand Header ────────────────────────────────────────── */}
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-800 px-5">
        <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md ring-1 ring-emerald-400/30">
          <Egg className="size-5" />
        </div>
        <div className="flex flex-col">
          <span className="font-bold tracking-tight text-white text-base leading-none">
            POULTRY HUB
          </span>
          <span className="text-[11px] font-medium text-emerald-400/90 mt-1">
            Poultry Management System
          </span>
        </div>
      </div>

      {/* ── Navigation Links ────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6 custom-scrollbar">
        {navGroups.map((group) => (
          <div key={group.groupLabel} className="space-y-1">
            <h3 className="px-3 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
              {group.groupLabel}
            </h3>
            <div className="space-y-0.5 pt-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "group flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition-all duration-150",
                      isActive
                        ? "bg-emerald-600/90 text-white shadow-sm font-semibold ring-1 ring-emerald-500/40"
                        : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
                    )}
                  >
                    <Icon
                      className={cn(
                        "size-4 shrink-0 transition-colors",
                        isActive ? "text-white" : "text-slate-400 group-hover:text-emerald-400"
                      )}
                    />
                    <span className="truncate">{item.title}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* ── Role & User Footer Badge ────────────────────────────── */}
      <div className="border-t border-slate-800 p-3.5 bg-slate-950/40">
        <div className="flex items-center justify-between rounded-lg bg-slate-800/60 p-2.5 ring-1 ring-slate-700/50">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-950 text-emerald-400 ring-1 ring-emerald-500/30">
              {userRole === "ADMIN" ? (
                <ShieldCheck className="size-4 text-emerald-400" />
              ) : (
                <User className="size-4 text-emerald-400" />
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-xs font-semibold text-slate-200 truncate">
                {userName || "Farm User"}
              </span>
              <span className="text-[10px] font-medium text-emerald-400 uppercase tracking-wider">
                {userRole}
              </span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
