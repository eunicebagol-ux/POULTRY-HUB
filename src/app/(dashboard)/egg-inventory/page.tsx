import { PackageOpen } from "lucide-react";
import { getCurrentUserProfile } from "@/lib/user-profile";
import { getEggInventory, getEggInventoryTransactions } from "@/actions/egg-inventory";
import { InventoryTable } from "@/components/egg-inventory/inventory-table";
import { TransactionLedger } from "@/components/egg-inventory/transaction-ledger";
import { EggInventoryActions } from "@/components/egg-inventory/inventory-actions";
import { EGG_SIZE_LABELS } from "@/lib/constants";

export const metadata = {
  title: "Egg Inventory — POULTRY HUB",
  description:
    "Live egg stock levels by size with packaging conversions, and the complete immutable inventory transaction ledger.",
};

export default async function EggInventoryPage() {
  // ── Auth & Profile ─────────────────────────────────────────────────────────
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

  // ── Data Fetch (parallel) ──────────────────────────────────────────────────
  const [inventoryResult, transactionsResult] = await Promise.all([
    getEggInventory(),
    getEggInventoryTransactions(150),
  ]);

  const inventory = inventoryResult.success ? (inventoryResult.data ?? []) : [];
  const transactions = transactionsResult.success
    ? (transactionsResult.data ?? [])
    : [];

  const inventoryError = inventoryResult.success ? null : inventoryResult.error;
  const transactionError = transactionsResult.success
    ? null
    : transactionsResult.error;

  // ── Summary Metrics ────────────────────────────────────────────────────────
  const totalPieces = inventory.reduce((sum, r) => sum + r.stock_pieces, 0);
  const nonZeroSizes = inventory.filter((r) => r.stock_pieces > 0).length;
  const lowStockSizes = inventory.filter(
    (r) => r.stock_pieces > 0 && r.stock_pieces < 30
  );
  const largestStockRow =
    inventory.length > 0
      ? inventory.reduce((best, r) =>
          r.stock_pieces > best.stock_pieces ? r : best
        )
      : null;

  const isAdmin = profile.role === "ADMIN";

  return (
    <div className="space-y-6">
      {/* ── Page Header ────────────────────────────────────────────────── */}
      <PageHeader isAdmin={isAdmin} />

      {/* ── Summary Cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Total Stock (pcs)"
          value={totalPieces.toLocaleString()}
          highlight={totalPieces > 0}
        />
        <StatCard
          label="Sizes In Stock"
          value={`${nonZeroSizes} / 6`}
        />
        <StatCard
          label="Low Stock Sizes"
          value={lowStockSizes.length.toString()}
          warn={lowStockSizes.length > 0}
        />
        <StatCard
          label="Highest Stock Size"
          value={
            largestStockRow && largestStockRow.stock_pieces > 0
              ? (EGG_SIZE_LABELS[largestStockRow.size] ?? largestStockRow.size)
              : "—"
          }
        />
      </div>

      {/* ── Error State (inventory) ───────────────────────────────────── */}
      {inventoryError && (
        <ErrorBanner
          title="Failed to load inventory levels"
          message={inventoryError}
        />
      )}

      {/* ── Stock Levels Table ────────────────────────────────────────── */}
      {!inventoryError && (
        <section className="space-y-3">
          <SectionHeader
            title="Current Stock Levels"
            description="Live snapshot per egg size — updated atomically by production and sales RPCs."
          />
          {isAdmin && <EggInventoryActions />}
          <InventoryTable inventory={inventory} />
        </section>
      )}

      {/* ── Transaction Ledger ────────────────────────────────────────── */}
      <section className="space-y-3">
        <SectionHeader
          title="Transaction Ledger"
          description="Immutable append-only log of all egg stock movements (most recent first)."
        />
        {transactionError ? (
          <ErrorBanner
            title="Failed to load transaction history"
            message={transactionError}
          />
        ) : (
          <TransactionLedger transactions={transactions} />
        )}
      </section>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function PageHeader({ isAdmin }: { isAdmin?: boolean }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border/50 pb-5">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-teal-600 text-white shadow-xs">
          <PackageOpen className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Egg Inventory
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Live stock levels by size, packaging conversions, and transaction
            history.
            {isAdmin && (
              <span className="ml-1 text-teal-600 dark:text-teal-400">
                · Admin: adjustments enabled
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight = false,
  warn = false,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
  warn?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 shadow-xs ${
        warn
          ? "border-amber-300/40 bg-amber-50/50 dark:bg-amber-950/20"
          : highlight
          ? "border-teal-300/40 bg-teal-50/50 dark:bg-teal-950/20"
          : "border-border/60 bg-card"
      }`}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`mt-0.5 text-xl font-bold tabular-nums ${
          warn
            ? "text-amber-700 dark:text-amber-400"
            : highlight
            ? "text-teal-700 dark:text-teal-400"
            : "text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function ErrorBanner({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-xs opacity-80">{message}</p>
    </div>
  );
}
