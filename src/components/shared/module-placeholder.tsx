import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, Clock, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModulePlaceholderProps {
  title: string;
  description: string;
  icon: LucideIcon;
  capabilities: string[];
  adminOnly?: boolean;
}

export function ModulePlaceholder({
  title,
  description,
  icon: Icon,
  capabilities,
  adminOnly = false,
}: ModulePlaceholderProps) {
  return (
    <div className="space-y-6">
      {/* ── Page Header ────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border/50 pb-5">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
            <Icon className="size-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight text-foreground">{title}</h2>
              {adminOnly && (
                <Badge variant="outline" className="text-[10px] uppercase font-bold border-amber-500/40 text-amber-700 dark:text-amber-400">
                  Admin Only
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          </div>
        </div>

        <Link
          href="/dashboard"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "self-start sm:self-auto text-xs")}
        >
          <ArrowLeft className="mr-1.5 size-3.5" /> Back to Dashboard
        </Link>
      </div>

      {/* ── Main Placeholder Banner Card ──────────────────────── */}
      <Card className="border-border/60 shadow-xs overflow-hidden">
        <div className="bg-gradient-to-r from-emerald-900/10 via-slate-900/5 to-slate-900/10 p-6 border-b border-border/50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 shrink-0">
                <Clock className="size-5" />
              </div>
              <div>
                <Badge variant="secondary" className="mb-1 text-[11px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300">
                  Phase Implementation Ready
                </Badge>
                <h3 className="text-base font-bold text-foreground">
                  {title} Module Architecture Configured
                </h3>
                <p className="text-xs text-muted-foreground max-w-xl mt-1">
                  The backend PostgreSQL database schema, security policies, and RPC stored procedures for {title.toLowerCase()} are established in Supabase. Interactive forms and management UI will connect directly to this backend authority.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Capabilities List */}
        <CardContent className="p-6">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">
            Planned & Supported Operational Features:
          </h4>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {capabilities.map((capability, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 rounded-lg border border-border/60 bg-background p-3 text-xs font-medium text-foreground shadow-2xs"
              >
                <span className="flex size-6 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 font-bold text-[11px]">
                  {idx + 1}
                </span>
                <span>{capability}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
