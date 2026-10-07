"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getActionLabel, getModuleLabel } from "./activity-log-utils";
import { X, ChevronLeft, ChevronRight, Filter } from "lucide-react";

interface FilterOption {
  id: string;
  full_name: string;
}

interface ActivityLogFiltersProps {
  actions: string[];
  entityTables: string[];
  actors: FilterOption[];
  currentAction: string;
  currentEntityTable: string;
  currentActorId: string;
  currentDateFrom: string;
  currentDateTo: string;
}

export function ActivityLogFilters({
  actions,
  entityTables,
  actors,
  currentAction,
  currentEntityTable,
  currentActorId,
  currentDateFrom,
  currentDateTo,
}: ActivityLogFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const createQueryString = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      // Reset to page 1 on filter change
      params.set("page", "1");
      for (const [key, value] of Object.entries(updates)) {
        if (value && value !== "ALL") {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      }
      return params.toString();
    },
    [searchParams]
  );

  const applyFilter = (key: string, value: string) => {
    startTransition(() => {
      router.push(`${pathname}?${createQueryString({ [key]: value })}`);
    });
  };

  const clearAll = () => {
    startTransition(() => {
      router.push(pathname);
    });
  };

  const hasFilters =
    currentAction || currentEntityTable || currentActorId || currentDateFrom || currentDateTo;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium text-muted-foreground">Filters:</span>

        {/* Action filter */}
        <Select
          value={currentAction || "ALL"}
          onValueChange={(v) => applyFilter("action", v || "")}
          disabled={isPending}
        >
          <SelectTrigger className="h-8 w-[200px] text-xs">
            <SelectValue placeholder="All Actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Actions</SelectItem>
            {actions.map((a) => (
              <SelectItem key={a} value={a}>
                {getActionLabel(a)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Module filter */}
        <Select
          value={currentEntityTable || "ALL"}
          onValueChange={(v) => applyFilter("entityTable", v || "")}
          disabled={isPending}
        >
          <SelectTrigger className="h-8 w-[180px] text-xs">
            <SelectValue placeholder="All Modules" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Modules</SelectItem>
            {entityTables.map((e) => (
              <SelectItem key={e} value={e}>
                {getModuleLabel(e)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Actor filter */}
        {actors.length > 0 && (
          <Select
            value={currentActorId || "ALL"}
            onValueChange={(v) => applyFilter("actorId", v || "")}
            disabled={isPending}
          >
            <SelectTrigger className="h-8 w-[180px] text-xs">
              <SelectValue placeholder="All Users" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Users</SelectItem>
              {actors.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Date From */}
        <Input
          type="date"
          className="h-8 w-[150px] text-xs"
          value={currentDateFrom}
          onChange={(e) => applyFilter("dateFrom", e.target.value)}
          placeholder="From date"
          disabled={isPending}
        />
        <span className="text-xs text-muted-foreground">to</span>
        {/* Date To */}
        <Input
          type="date"
          className="h-8 w-[150px] text-xs"
          value={currentDateTo}
          onChange={(e) => applyFilter("dateTo", e.target.value)}
          placeholder="To date"
          disabled={isPending}
        />

        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted-foreground hover:text-destructive"
            onClick={clearAll}
            disabled={isPending}
          >
            <X className="h-3 w-3 mr-1" />
            Clear all
          </Button>
        )}
      </div>
    </div>
  );
}

interface ActivityLogPaginationProps {
  currentPage: number;
  totalCount: number;
  pageSize: number;
}

export function ActivityLogPagination({
  currentPage,
  totalCount,
  pageSize,
}: ActivityLogPaginationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const totalPages = Math.ceil(totalCount / pageSize);
  const from = (currentPage - 1) * pageSize + 1;
  const to = Math.min(currentPage * pageSize, totalCount);

  const goToPage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(page));
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  if (totalCount === 0) return null;

  return (
    <div className="flex items-center justify-between border-t pt-4">
      <p className="text-sm text-muted-foreground">
        Showing {from.toLocaleString()}–{to.toLocaleString()} of {totalCount.toLocaleString()} entries
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage <= 1 || isPending}
          className="h-8"
        >
          <ChevronLeft className="h-4 w-4" />
          Prev
        </Button>
        <span className="text-sm text-muted-foreground px-2">
          Page {currentPage} of {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage >= totalPages || isPending}
          className="h-8"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
