import { Egg } from "lucide-react";
import { getCurrentUserProfile } from "@/lib/user-profile";
import { createClient } from "@/lib/supabase/server";
import {
  ProductionList,
  type ProductionRecordItem,
} from "@/components/egg-production/production-list";
import type { FlockOption } from "@/components/egg-production/production-form";
import type { EggSize } from "@/types";

export const metadata = {
  title: "Egg Production — POULTRY HUB",
  description: "Track daily egg collection records, size grading breakdowns, and collection shifts.",
};

export default async function EggProductionPage() {
  // ── Auth & Profile ───────────────────────────────────────────────────────────
  const profile = await getCurrentUserProfile();

  if (!profile || !profile.is_active) {
    return (
      <div className="space-y-6">
        <PageHeader />
        <p className="text-sm text-muted-foreground">
          Your account is pending activation. Please contact an administrator.
        </p>
      </div>
    );
  }

  // ── Data Fetch ───────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const todayStr = new Date().toISOString().split("T")[0];

  let flocks: FlockOption[] = [];
  let records: ProductionRecordItem[] = [];
  let fetchError: string | null = null;

  try {
    // 1. Fetch active flocks
    const { data: flocksData, error: flocksError } = await supabase
      .from("flocks")
      .select("id, flock_identifier, current_bird_count")
      .eq("status", "ACTIVE")
      .order("flock_identifier");

    if (flocksError) {
      console.error("Error fetching flocks:", flocksError.message);
    } else {
      flocks = flocksData ?? [];
    }

    // 2. Fetch egg production logs with size breakdowns and flock metadata
    const { data: recordsData, error: recordsError } = await supabase
      .from("egg_production")
      .select(`
        id,
        flock_id,
        production_date,
        collection_shift,
        total_eggs,
        good_eggs,
        damaged_eggs,
        cracked_eggs,
        notes,
        created_at,
        flocks (
          id,
          flock_identifier
        ),
        egg_production_sizes (
          size,
          quantity
        )
      `)
      .order("production_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(100);

    if (recordsError) {
      fetchError = recordsError.message;
    } else if (recordsData) {
      records = recordsData.map((row) => {
        // Supabase foreign table joins can return single object or null
        const flockObj = Array.isArray(row.flocks)
          ? row.flocks[0]
          : row.flocks;

        const sizesArr = (row.egg_production_sizes || []).map((s) => ({
          size: s.size as EggSize,
          quantity: s.quantity,
        }));

        return {
          id: row.id,
          flock_id: row.flock_id,
          production_date: row.production_date,
          collection_shift: row.collection_shift,
          total_eggs: row.total_eggs,
          good_eggs: row.good_eggs,
          damaged_eggs: row.damaged_eggs,
          cracked_eggs: row.cracked_eggs,
          notes: row.notes,
          created_at: row.created_at,
          flock: flockObj
            ? { id: flockObj.id, flock_identifier: flockObj.flock_identifier }
            : null,
          sizes: sizesArr,
        };
      });
    }
  } catch (err) {
    fetchError =
      err instanceof Error ? err.message : "Failed to load production data.";
  }

  // ── Summary Metrics ──────────────────────────────────────────────────────────
  const todayRecords = records.filter((r) => r.production_date === todayStr);
  const todayTotalEggs = todayRecords.reduce((sum, r) => sum + r.total_eggs, 0);
  const todayGoodEggs = todayRecords.reduce((sum, r) => sum + r.good_eggs, 0);
  const todayDamagedCracked = todayRecords.reduce(
    (sum, r) => sum + r.damaged_eggs + r.cracked_eggs,
    0
  );
  const todayActiveFlocksCount = new Set(todayRecords.map((r) => r.flock_id)).size;

  return (
    <div className="space-y-6">
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <PageHeader />

      {/* ── Summary Cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Today's Total Eggs"
          value={todayTotalEggs.toLocaleString()}
          highlight={todayTotalEggs > 0}
        />
        <StatCard
          label="Today's Good Eggs"
          value={todayGoodEggs.toLocaleString()}
        />
        <StatCard
          label="Today's Damaged / Cracked"
          value={todayDamagedCracked.toLocaleString()}
        />
        <StatCard
          label="Active Flocks Producing"
          value={`${todayActiveFlocksCount} / ${flocks.length}`}
        />
      </div>

      {/* ── Error State ──────────────────────────────────────────────────── */}
      {fetchError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <p className="font-semibold">Failed to load egg production records</p>
          <p className="mt-1 text-xs opacity-80">{fetchError}</p>
        </div>
      )}

      {/* ── Production List & Actions ────────────────────────────────────── */}
      {!fetchError && (
        <ProductionList records={records} flocks={flocks} />
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PageHeader() {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border/50 pb-5">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-amber-600 text-white shadow-xs">
          <Egg className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Egg Production
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Daily collection records, size grading breakdowns, and collection shifts.
          </p>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 shadow-xs ${
        highlight
          ? "border-amber-300/40 bg-amber-50/50 dark:bg-amber-950/20"
          : "border-border/60 bg-card"
      }`}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`mt-0.5 text-xl font-bold tabular-nums ${
          highlight ? "text-amber-700 dark:text-amber-400" : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
