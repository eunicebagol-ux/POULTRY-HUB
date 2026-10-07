import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ActivityLogRow } from "@/actions/activity-logs";
import {
  formatTimestamp,
  formatMetadataSummary,
  getActionLabel,
  getModuleLabel,
} from "./activity-log-utils";
import { History, User } from "lucide-react";

const ACTION_BADGE_STYLES: Record<string, string> = {
  RECORD_PRODUCTION: "bg-emerald-100 text-emerald-800 border-emerald-200",
  CREATE_SALE: "bg-blue-100 text-blue-800 border-blue-200",
  RECORD_FEED_CONSUMPTION: "bg-amber-100 text-amber-800 border-amber-200",
  FEED_STOCK_RECEIVED: "bg-orange-100 text-orange-800 border-orange-200",
  EGG_INVENTORY_ADJUSTED: "bg-purple-100 text-purple-800 border-purple-200",
  RECORD_MORTALITY: "bg-red-100 text-red-800 border-red-200",
  RECORD_CULLING: "bg-rose-100 text-rose-800 border-rose-200",
  UPDATE_USER_ROLE: "bg-sky-100 text-sky-800 border-sky-200",
  DEACTIVATE_USER: "bg-slate-100 text-slate-800 border-slate-200",
  ACTIVATE_USER: "bg-teal-100 text-teal-800 border-teal-200",
};

function ActionBadge({ action }: { action: string }) {
  const style = ACTION_BADGE_STYLES[action] ?? "bg-gray-100 text-gray-800 border-gray-200";
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${style}`}
    >
      {getActionLabel(action)}
    </span>
  );
}

interface ActivityLogTableProps {
  logs: ActivityLogRow[];
}

export function ActivityLogTable({ logs }: ActivityLogTableProps) {
  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <div className="rounded-full bg-muted p-4">
          <History className="h-8 w-8 text-muted-foreground opacity-60" />
        </div>
        <div>
          <p className="text-sm font-medium">No activity logs yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            System activity will appear here as users interact with the platform.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Note: Only actions tracked by trusted server RPCs are logged.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[160px]">Date / Time</TableHead>
            <TableHead className="min-w-[140px]">User</TableHead>
            <TableHead className="min-w-[180px]">Action</TableHead>
            <TableHead className="min-w-[140px]">Module</TableHead>
            <TableHead className="min-w-[140px] hidden lg:table-cell">Entity ID</TableHead>
            <TableHead className="min-w-[200px]">Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => (
            <TableRow key={log.id} className="hover:bg-muted/40 align-top">
              <TableCell className="text-xs text-muted-foreground whitespace-nowrap py-3">
                {formatTimestamp(log.created_at)}
              </TableCell>
              <TableCell className="py-3">
                <div className="flex items-center gap-1.5">
                  <div className="rounded-full bg-muted p-0.5 shrink-0">
                    <User className="h-3 w-3 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate max-w-[120px]">{log.actor_name}</p>
                    {log.actor_role && (
                      <p className="text-[10px] text-muted-foreground">{log.actor_role}</p>
                    )}
                  </div>
                </div>
              </TableCell>
              <TableCell className="py-3">
                <ActionBadge action={log.action} />
              </TableCell>
              <TableCell className="py-3">
                <span className="text-xs text-muted-foreground">
                  {getModuleLabel(log.entity_table)}
                </span>
              </TableCell>
              <TableCell className="py-3 hidden lg:table-cell">
                {log.entity_id ? (
                  <span className="text-[10px] font-mono text-muted-foreground break-all">
                    {log.entity_id.split("-")[0]}…
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground/50">—</span>
                )}
              </TableCell>
              <TableCell className="py-3">
                <p className="text-xs text-muted-foreground max-w-[280px]">
                  {formatMetadataSummary(log.action, log.metadata)}
                </p>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
