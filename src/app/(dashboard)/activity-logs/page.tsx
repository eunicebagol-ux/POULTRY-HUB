import { Suspense } from "react";
import Link from "next/link";
import { ShieldAlert, History, AlertTriangle } from "lucide-react";
import { getCurrentUserProfile } from "@/lib/user-profile";
import { getActivityLogs, getActivityLogFilterOptions } from "@/actions/activity-logs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ActivityLogTable } from "@/components/activity-logs/activity-log-table";
import { ActivityLogFilters, ActivityLogPagination } from "@/components/activity-logs/activity-log-controls";

const PAGE_SIZE = 25;

interface PageProps {
  searchParams: Promise<{
    page?: string;
    action?: string;
    entityTable?: string;
    actorId?: string;
    dateFrom?: string;
    dateTo?: string;
  }>;
}

export default async function ActivityLogsPage({ searchParams }: PageProps) {
  const profile = await getCurrentUserProfile();

  // Server-side ADMIN guard — not just nav hiding
  if (!profile || !profile.is_active || profile.role !== "ADMIN") {
    return (
      <div className="mx-auto max-w-md py-12 text-center space-y-4">
        <Card className="border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20">
          <CardHeader>
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900 text-amber-600 dark:text-amber-400 mb-2">
              <ShieldAlert className="size-6" />
            </div>
            <CardTitle className="text-base font-bold text-foreground">Access Restricted</CardTitle>
            <CardDescription className="text-xs">
              Viewing system audit activity logs requires the ADMIN role.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/dashboard"
              className={cn(buttonVariants({ size: "sm" }), "bg-slate-900 text-white hover:bg-slate-800")}
            >
              Return to Dashboard
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const action = params.action ?? "";
  const entityTable = params.entityTable ?? "";
  const actorId = params.actorId ?? "";
  const dateFrom = params.dateFrom ?? "";
  const dateTo = params.dateTo ?? "";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <History className="h-7 w-7 text-muted-foreground" />
            Activity Logs
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Read-only audit trail of system actions recorded by trusted server processes.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
          <AlertTriangle className="h-3 w-3 text-amber-600 shrink-0" />
          <span>
            Only actions tracked by trusted server RPCs are shown. Flock creation, customers, suppliers, and expenses do not currently generate logs.
          </span>
        </div>
      </div>

      <Suspense fallback={<ActivityLogsSkeleton />}>
        <ActivityLogsContent
          page={page}
          action={action}
          entityTable={entityTable}
          actorId={actorId}
          dateFrom={dateFrom}
          dateTo={dateTo}
        />
      </Suspense>
    </div>
  );
}

async function ActivityLogsContent({
  page,
  action,
  entityTable,
  actorId,
  dateFrom,
  dateTo,
}: {
  page: number;
  action: string;
  entityTable: string;
  actorId: string;
  dateFrom: string;
  dateTo: string;
}) {
  const [logsResult, filterResult] = await Promise.all([
    getActivityLogs({
      page,
      pageSize: PAGE_SIZE,
      action: action || undefined,
      entityTable: entityTable || undefined,
      actorId: actorId || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }),
    getActivityLogFilterOptions(),
  ]);

  if (!logsResult.success) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6 text-center text-destructive">
          <AlertTriangle className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p>Failed to load activity logs.</p>
          <p className="text-sm opacity-70">{logsResult.error}</p>
        </CardContent>
      </Card>
    );
  }

  const { logs, totalCount } = logsResult.data;
  const filterOptions = filterResult.success
    ? filterResult.data
    : { actions: [], entityTables: [], actors: [] };

  return (
    <Card>
      <CardHeader className="border-b pb-4">
        <ActivityLogFilters
          actions={filterOptions.actions}
          entityTables={filterOptions.entityTables}
          actors={filterOptions.actors}
          currentAction={action}
          currentEntityTable={entityTable}
          currentActorId={actorId}
          currentDateFrom={dateFrom}
          currentDateTo={dateTo}
        />
      </CardHeader>
      <CardContent className="p-0">
        <ActivityLogTable logs={logs} />
      </CardContent>
      <div className="px-6 pb-4">
        <ActivityLogPagination
          currentPage={page}
          totalCount={totalCount}
          pageSize={PAGE_SIZE}
        />
      </div>
    </Card>
  );
}

function ActivityLogsSkeleton() {
  return (
    <Card>
      <CardHeader className="border-b pb-4">
        <div className="h-8 w-full max-w-xl bg-muted animate-pulse rounded-md" />
      </CardHeader>
      <CardContent className="pt-6 space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-10 bg-muted animate-pulse rounded-md" />
        ))}
      </CardContent>
    </Card>
  );
}
