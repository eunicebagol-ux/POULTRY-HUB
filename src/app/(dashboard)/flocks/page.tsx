import { Layers } from "lucide-react";
import { getCurrentUserProfile } from "@/lib/user-profile";
import { createClient } from "@/lib/supabase/server";
import { FlockList } from "@/components/flocks/flock-list";
import type { Database } from "@/types/database.types";

type FlockRow = Database["public"]["Tables"]["flocks"]["Row"];

export const metadata = {
  title: "Flock Management — POULTRY HUB",
  description: "Track laying hen batches, monitor bird counts, and log mortality and culling events.",
};

export default async function FlocksPage() {
  // ── Auth & Profile ───────────────────────────────────────────────────────────
  const profile = await getCurrentUserProfile();

  // Dashboard layout already guards authentication; profile may be null if
  // the webhook hasn't provisioned it yet. Show empty state gracefully.
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
  let flocks: FlockRow[] = [];
  let fetchError: string | null = null;

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("flocks")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      fetchError = error.message;
    } else {
      flocks = data ?? [];
    }
  } catch (err) {
    fetchError =
      err instanceof Error ? err.message : "Failed to load flock data.";
  }

  // ── Summary Stats ────────────────────────────────────────────────────────────
  const activeCount = flocks.filter((f) => f.status === "ACTIVE").length;
  const totalBirds = flocks
    .filter((f) => f.status === "ACTIVE")
    .reduce((sum, f) => sum + f.current_bird_count, 0);

  return (
    <div className="space-y-6">
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <PageHeader />

      {/* ── Summary Cards ────────────────────────────────────────────────── */}
      {flocks.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <StatCard label="Total Flocks" value={flocks.length} />
          <StatCard
            label="Active Flocks"
            value={activeCount}
            highlight
          />
          <StatCard
            label="Total Active Birds"
            value={totalBirds.toLocaleString()}
          />
          <StatCard
            label="Retired / Quarantined"
            value={flocks.length - activeCount}
          />
        </div>
      )}

      {/* ── Error State ──────────────────────────────────────────────────── */}
      {fetchError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <p className="font-semibold">Failed to load flocks</p>
          <p className="mt-1 text-xs opacity-80">{fetchError}</p>
        </div>
      )}

      {/* ── Flock List (with Create / Edit / Mortality / Culling dialogs) ── */}
      {!fetchError && <FlockList flocks={flocks} />}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PageHeader() {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border/50 pb-5">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
          <Layers className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Flock Management
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Track laying hen batches, monitor bird counts, and log mortality &amp; culling events.
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
          ? "border-emerald-300/40 bg-emerald-50/50 dark:bg-emerald-950/20"
          : "border-border/60 bg-card"
      }`}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`mt-0.5 text-xl font-bold tabular-nums ${
          highlight ? "text-emerald-700 dark:text-emerald-400" : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
