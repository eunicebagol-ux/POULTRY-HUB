"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUserProfile } from "@/lib/user-profile";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export interface ActivityLogRow {
  id: string;
  actor_id: string | null;
  action: string;
  entity_table: string;
  entity_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  // Resolved from profiles
  actor_name: string;
  actor_role: string | null;
}

export interface ActivityLogsPageData {
  logs: ActivityLogRow[];
  totalCount: number;
  profiles: Record<string, { full_name: string; role: string }>;
}

export interface ActivityLogsFilters {
  page?: number;
  pageSize?: number;
  action?: string;
  entityTable?: string;
  actorId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

const PAGE_SIZE = 25;

export async function getActivityLogs(
  filters: ActivityLogsFilters = {}
): Promise<ActionResult<ActivityLogsPageData>> {
  const caller = await getCurrentUserProfile();
  if (!caller || !caller.is_active) {
    return { success: false, error: "Unauthorized" };
  }
  if (caller.role !== "ADMIN") {
    return { success: false, error: "Forbidden: ADMIN role required." };
  }

  const supabase = await createClient();
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = filters.pageSize ?? PAGE_SIZE;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // Build query
  let query = supabase
    .from("activity_logs")
    .select("id, actor_id, action, entity_table, entity_id, metadata, created_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false });

  if (filters.action && filters.action !== "ALL") {
    query = query.eq("action", filters.action);
  }
  if (filters.entityTable && filters.entityTable !== "ALL") {
    query = query.eq("entity_table", filters.entityTable);
  }
  if (filters.actorId && filters.actorId !== "ALL") {
    query = query.eq("actor_id", filters.actorId);
  }
  if (filters.dateFrom) {
    query = query.gte("created_at", filters.dateFrom);
  }
  if (filters.dateTo) {
    // Add 1 day to make dateTo inclusive
    const endDate = new Date(filters.dateTo);
    endDate.setDate(endDate.getDate() + 1);
    query = query.lt("created_at", endDate.toISOString().split("T")[0]);
  }
  if (filters.search) {
    const term = filters.search.trim();
    if (term) {
      // Find matching profile ids for actor name search
      const { data: matchedProfiles } = await supabase
        .from("profiles")
        .select("id")
        .ilike("full_name", `%${term}%`);

      const matchedActorIds = (matchedProfiles ?? []).map((p) => p.id);

      if (matchedActorIds.length > 0) {
        query = query.or(
          `action.ilike.%${term}%,entity_table.ilike.%${term}%,actor_id.in.(${matchedActorIds.join(",")})`
        );
      } else {
        query = query.or(`action.ilike.%${term}%,entity_table.ilike.%${term}%`);
      }
    }
  }

  query = query.range(from, to);

  const { data: logsRaw, count, error } = await query;
  if (error) return { success: false, error: error.message };

  const logs = (logsRaw ?? []) as Array<{
    id: string;
    actor_id: string | null;
    action: string;
    entity_table: string;
    entity_id: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
  }>;

  // Batch-fetch all unique profiles to avoid N+1
  const actorIds = [...new Set(logs.map((l) => l.actor_id).filter(Boolean))] as string[];
  const profileMap: Record<string, { full_name: string; role: string }> = {};

  if (actorIds.length > 0) {
    const { data: profileRows } = await supabase
      .from("profiles")
      .select("id, full_name, role")
      .in("id", actorIds);

    if (profileRows) {
      for (const p of profileRows) {
        profileMap[p.id] = { full_name: p.full_name, role: p.role };
      }
    }
  }

  const enrichedLogs: ActivityLogRow[] = logs.map((log) => {
    const profile = log.actor_id ? profileMap[log.actor_id] : null;
    return {
      ...log,
      metadata: log.metadata as Record<string, unknown> | null,
      actor_name: profile?.full_name ?? "Unknown User",
      actor_role: profile?.role ?? null,
    };
  });

  return {
    success: true,
    data: {
      logs: enrichedLogs,
      totalCount: count ?? 0,
      profiles: profileMap,
    },
  };
}

export async function getActivityLogFilterOptions(): Promise<
  ActionResult<{
    actions: string[];
    entityTables: string[];
    actors: Array<{ id: string; full_name: string }>;
  }>
> {
  const caller = await getCurrentUserProfile();
  if (!caller || !caller.is_active) {
    return { success: false, error: "Unauthorized" };
  }
  if (caller.role !== "ADMIN") {
    return { success: false, error: "Forbidden: ADMIN role required." };
  }

  const supabase = await createClient();

  // Fetch distinct values for filter dropdowns
  const { data: actionRows } = await supabase
    .from("activity_logs")
    .select("action")
    .order("action");

  const { data: entityRows } = await supabase
    .from("activity_logs")
    .select("entity_table")
    .order("entity_table");

  const { data: actorRows } = await supabase
    .from("activity_logs")
    .select("actor_id")
    .not("actor_id", "is", null);

  const actions = [...new Set((actionRows ?? []).map((r) => r.action))];
  const entityTables = [...new Set((entityRows ?? []).map((r) => r.entity_table))];
  const actorIds = [...new Set((actorRows ?? []).map((r) => r.actor_id as string))];

  let actors: Array<{ id: string; full_name: string }> = [];
  if (actorIds.length > 0) {
    const { data: profileRows } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", actorIds)
      .order("full_name");

    actors = (profileRows ?? []).map((p) => ({ id: p.id, full_name: p.full_name }));
  }

  return {
    success: true,
    data: { actions, entityTables, actors },
  };
}
