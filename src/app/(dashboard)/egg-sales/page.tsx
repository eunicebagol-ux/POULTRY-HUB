import { ShoppingCart } from "lucide-react";
import { getCurrentUserProfile } from "@/lib/user-profile";
import {
  getEggSales,
  getActiveCustomers,
  getEggInventoryStock,
} from "@/actions/egg-sales";
import { SaleForm } from "@/components/egg-sales/sale-form";
import { SaleList } from "@/components/egg-sales/sale-list";
import { DEFAULT_CURRENCY_SYMBOL } from "@/lib/constants";

export const metadata = {
  title: "Egg Sales & Invoicing — POULTRY HUB",
  description:
    "Record multi-item egg sales invoices with packaging multipliers, and atomically decrement inventory balances in PostgreSQL.",
};

export default async function EggSalesPage() {
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
  const [salesResult, customersResult, inventoryResult] = await Promise.all([
    getEggSales(100),
    getActiveCustomers(),
    getEggInventoryStock(),
  ]);

  const sales = salesResult.success ? (salesResult.data ?? []) : [];
  const customers = customersResult.success ? (customersResult.data ?? []) : [];
  const inventory = inventoryResult.success ? (inventoryResult.data ?? []) : [];

  const salesError = salesResult.success ? null : salesResult.error;
  const customersError = customersResult.success ? null : customersResult.error;
  const inventoryError = inventoryResult.success ? null : inventoryResult.error;

  // ── Summary Metrics ────────────────────────────────────────────────────────
  const totalBilled = sales.reduce((sum, s) => sum + s.total_amount, 0);
  const totalSalesCount = sales.length;
  const paidCount = sales.filter((s) => (s.payment_status ?? "") === "PAID").length;
  const pendingOrPartialCount = sales.filter(
    (s) => (s.payment_status ?? "PENDING") === "PENDING" || (s.payment_status ?? "") === "PARTIAL"
  ).length;

  return (
    <div className="space-y-6">
      {/* ── Page Header ────────────────────────────────────────────────── */}
      <PageHeader />

      {/* ── Summary Stat Cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Total Billed"
          value={`${DEFAULT_CURRENCY_SYMBOL}${totalBilled.toLocaleString(
            undefined,
            { minimumFractionDigits: 2, maximumFractionDigits: 2 }
          )}`}
          highlight={totalBilled > 0}
        />
        <StatCard
          label="Total Sales"
          value={totalSalesCount.toString()}
        />
        <StatCard
          label="Fully Paid"
          value={paidCount.toString()}
          highlight={paidCount > 0}
        />
        <StatCard
          label="Pending / Partial"
          value={pendingOrPartialCount.toString()}
        />
      </div>

      {/* ── Data Fetch Error Banners ──────────────────────────────────── */}
      {salesError && (
        <ErrorBanner title="Failed to load sales history" message={salesError} />
      )}
      {customersError && (
        <ErrorBanner title="Failed to load customers" message={customersError} />
      )}
      {inventoryError && (
        <ErrorBanner title="Failed to load egg inventory" message={inventoryError} />
      )}

      {/* ── Record Sale Section ────────────────────────────────────────── */}
      <section className="space-y-3">
        <SaleForm
          customers={customers}
          inventory={inventory}
        />
      </section>

      {/* ── Sales History Section ──────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Sales Invoices History
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Completed egg sales invoices, itemized packaging breakdowns, and revenue totals.
            </p>
          </div>
        </div>

        <SaleList sales={sales} />
      </section>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function PageHeader() {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border/50 pb-5">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-teal-600 text-white shadow-xs">
          <ShoppingCart className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Egg Sales & Invoicing
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Issue sales invoices, record customer purchases, and deduct egg stock atomically.
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
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 shadow-xs ${
        highlight
          ? "border-teal-300/40 bg-teal-50/50 dark:bg-teal-950/20"
          : "border-border/60 bg-card"
      }`}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`mt-0.5 text-xl font-bold tabular-nums ${
          highlight ? "text-teal-700 dark:text-teal-400" : "text-foreground"
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
