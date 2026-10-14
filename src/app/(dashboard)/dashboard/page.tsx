import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Egg,
  Layers,
  Package,
  Wheat,
  ShoppingCart,
  Receipt,
  Activity,
  CalendarDays,
  Inbox,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DashboardCharts } from "@/components/dashboard/dashboard-charts";
import { QuickActions } from "@/components/dashboard/quick-actions";
import type { EggSize } from "@/types";

export const revalidate = 0; // Dynamic server rendering

export default async function DashboardPage() {
  const supabase = await createClient();
  const todayStr = new Date().toISOString().split("T")[0];

  // ── 1. Query Today's Egg Production ──────────────────────────────────
  const { data: todayProd } = await supabase
    .from("egg_production")
    .select("total_eggs, good_eggs, damaged_eggs, cracked_eggs")
    .eq("production_date", todayStr);

  const todayGoodEggs = todayProd?.reduce((sum, item) => sum + (item.good_eggs || 0), 0) ?? 0;
  const todayTotalEggs = todayProd?.reduce((sum, item) => sum + (item.total_eggs || 0), 0) ?? 0;
  const todayDamagedEggs = todayProd?.reduce((sum, item) => sum + (item.damaged_eggs || 0), 0) ?? 0;

  // ── 2. Query Current Egg Inventory ───────────────────────────────────
  const { data: rawEggInventory } = await supabase
    .from("egg_inventory")
    .select("size, stock_pieces");

  const eggInventory: { size: EggSize; stock_pieces: number }[] =
    rawEggInventory && rawEggInventory.length > 0
      ? rawEggInventory.map((item) => ({
          size: item.size as EggSize,
          stock_pieces: item.stock_pieces || 0,
        }))
      : [
          { size: "SMALL", stock_pieces: 0 },
          { size: "MEDIUM", stock_pieces: 0 },
          { size: "LARGE", stock_pieces: 0 },
          { size: "EXTRA_LARGE", stock_pieces: 0 },
          { size: "JUMBO", stock_pieces: 0 },
          { size: "UNGRADED", stock_pieces: 0 },
        ];

  const totalEggStockPieces = eggInventory.reduce((sum, item) => sum + item.stock_pieces, 0);
  const totalEggStockTrays = Math.floor(totalEggStockPieces / 30);

  // ── 3. Query Active Flocks ───────────────────────────────────────────
  const { data: activeFlocks } = await supabase
    .from("flocks")
    .select("id, flock_identifier, current_bird_count, breed, acquisition_date")
    .eq("status", "ACTIVE");

  const activeFlockCount = activeFlocks?.length ?? 0;
  const totalBirdCount = activeFlocks?.reduce((sum, item) => sum + (item.current_bird_count || 0), 0) ?? 0;

  // ── 4. Query Current Feed Inventory ──────────────────────────────────
  const { data: feedInventory } = await supabase
    .from("feed_inventory")
    .select("feed_type, current_stock_kg, cost_per_kg");

  const totalFeedStockKg = feedInventory?.reduce((sum, item) => sum + Number(item.current_stock_kg || 0), 0) ?? 0;

  // ── 5. Query Today's Egg Sales ────────────────────────────────────────
  const { data: todaySales } = await supabase
    .from("egg_sales")
    .select("total_amount")
    .eq("sale_date", todayStr);

  const todaySalesTotal = todaySales?.reduce((sum, item) => sum + Number(item.total_amount || 0), 0) ?? 0;

  // ── 6. Query Recent Expenses (Current Month) ─────────────────────────
  const { data: recentExpenses } = await supabase
    .from("expenses")
    .select("amount")
    .limit(50);

  const totalExpensesSum = recentExpenses?.reduce((sum, item) => sum + Number(item.amount || 0), 0) ?? 0;

  // ── 7. Query Production History (Last 7 Days) for Chart ─────────────
  const { data: prodHistoryRaw } = await supabase
    .from("egg_production")
    .select("production_date, good_eggs, damaged_eggs")
    .order("production_date", { ascending: true })
    .limit(14);

  const productionHistory = (prodHistoryRaw || []).map((row) => ({
    date: row.production_date,
    good_eggs: row.good_eggs,
    damaged_eggs: row.damaged_eggs,
  }));

  // ── 8. Query Activity Logs ───────────────────────────────────────────
  const { data: activityLogs } = await supabase
    .from("activity_logs")
    .select("id, action, entity_table, created_at, actor_id")
    .order("created_at", { ascending: false })
    .limit(5);

  return (
    <div className="space-y-8">
      {/* ── Page Header Banner ────────────────────────────────────────── */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between border-b border-border/50 pb-5">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Farm Operations Dashboard
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Overview of poultry production, inventory levels, flock status, and financial metrics.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground bg-background px-3 py-1.5 rounded-lg border border-border/80 shadow-2xs mt-2 sm:mt-0">
          <CalendarDays className="size-4 text-emerald-600" />
          <span>Today: {formatDate(new Date(), "EEEE, MMMM d, yyyy")}</span>
        </div>
      </div>

      {/* ── Metric Cards Grid ─────────────────────────────────────────── */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Today's Egg Production */}
        <Card className="border-border/60 shadow-xs relative overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Today&apos;s Egg Collection
              </CardDescription>
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/80 p-2 text-emerald-600 dark:text-emerald-400">
                <Egg className="size-5" />
              </div>
            </div>
            <CardTitle className="text-3xl font-extrabold tracking-tight text-foreground mt-1">
              {todayGoodEggs.toLocaleString()}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            <div className="flex items-center justify-between pt-1 border-t border-border/40">
              <span>Total: {todayTotalEggs.toLocaleString()} eggs</span>
              <span className="text-amber-600 dark:text-amber-400 font-medium">
                Damaged: {todayDamagedEggs}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Current Egg Inventory */}
        <Card className="border-border/60 shadow-xs">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Egg Stock Balance
              </CardDescription>
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/80 p-2 text-emerald-600 dark:text-emerald-400">
                <Package className="size-5" />
              </div>
            </div>
            <CardTitle className="text-3xl font-extrabold tracking-tight text-foreground mt-1">
              {totalEggStockPieces.toLocaleString()} <span className="text-sm font-semibold text-muted-foreground">pcs</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            <div className="flex items-center justify-between pt-1 border-t border-border/40">
              <span>Trays (×30): {totalEggStockTrays.toLocaleString()}</span>
              <Badge variant="outline" className="text-[10px] py-0 border-emerald-600/30 text-emerald-700 dark:text-emerald-400">
                Live Stock
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Active Flocks */}
        <Card className="border-border/60 shadow-xs">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Active Flocks
              </CardDescription>
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950/80 p-2 text-emerald-600 dark:text-emerald-400">
                <Layers className="size-5" />
              </div>
            </div>
            <CardTitle className="text-3xl font-extrabold tracking-tight text-foreground mt-1">
              {activeFlockCount} <span className="text-sm font-semibold text-muted-foreground">flocks</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            <div className="flex items-center justify-between pt-1 border-t border-border/40">
              <span>Total Birds: {totalBirdCount.toLocaleString()}</span>
              <Badge variant="secondary" className="text-[10px] py-0">
                Laying Hens
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Feed Stock */}
        <Card className="border-border/60 shadow-xs">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Feed Stock Level
              </CardDescription>
              <div className="rounded-lg bg-amber-50 dark:bg-amber-950/80 p-2 text-amber-600 dark:text-amber-400">
                <Wheat className="size-5" />
              </div>
            </div>
            <CardTitle className="text-3xl font-extrabold tracking-tight text-foreground mt-1">
              {totalFeedStockKg.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}{" "}
              <span className="text-sm font-semibold text-muted-foreground">kg</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            <div className="flex items-center justify-between pt-1 border-t border-border/40">
              <span>Feed Types: {feedInventory?.length || 0}</span>
              {totalFeedStockKg < 50 ? (
                <Badge variant="destructive" className="text-[10px] py-0">
                  Low Stock
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] py-0 text-emerald-600 border-emerald-500/30">
                  Sufficient
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* ── Financial Metrics Row ─────────────────────────────────────── */}
      <section className="grid gap-4 sm:grid-cols-2">
        <Card className="border-border/60 shadow-xs">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Today&apos;s Egg Sales
              </CardDescription>
              <div className="rounded-lg bg-indigo-50 dark:bg-indigo-950/80 p-2 text-indigo-600 dark:text-indigo-400">
                <ShoppingCart className="size-5" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground mt-1">
              {formatCurrency(todaySalesTotal)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Sales invoices created today: {todaySales?.length || 0}
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-xs">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Total Expenses
              </CardDescription>
              <div className="rounded-lg bg-rose-50 dark:bg-rose-950/80 p-2 text-rose-600 dark:text-rose-400">
                <Receipt className="size-5" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground mt-1">
              {formatCurrency(totalExpensesSum)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Total recorded operational farm expenses
          </CardContent>
        </Card>
      </section>

      {/* ── Quick Action Shortcuts ────────────────────────────────────── */}
      <QuickActions />

      {/* ── Production & Inventory Trend Charts ───────────────────────── */}
      <DashboardCharts
        productionHistory={productionHistory}
        eggInventory={eggInventory}
      />

      {/* ── Active Flocks Overview & Recent Activity ──────────────────── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Active Flocks Table / Overview */}
        <Card className="border-border/60 shadow-xs lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold">Active Flocks Summary</CardTitle>
                <CardDescription className="text-xs">
                  Overview of current laying batches in production
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs border-emerald-600/30 text-emerald-700 dark:text-emerald-400">
                {activeFlockCount} Active
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {activeFlocks && activeFlocks.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border/60 text-muted-foreground font-semibold">
                      <th className="py-2.5 px-3">Flock ID</th>
                      <th className="py-2.5 px-3">Breed</th>
                      <th className="py-2.5 px-3">Acquisition Date</th>
                      <th className="py-2.5 px-3 text-right">Current Birds</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {activeFlocks.map((flock) => (
                      <tr key={flock.id} className="hover:bg-muted/40 transition-colors">
                        <td className="py-2.5 px-3 font-semibold text-foreground">
                          {flock.flock_identifier}
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground">
                          {flock.breed || "Standard Layer"}
                        </td>
                        <td className="py-2.5 px-3 text-muted-foreground">
                          {formatDate(flock.acquisition_date)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-emerald-700 dark:text-emerald-400">
                          {flock.current_bird_count.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/80 bg-slate-50/50 dark:bg-slate-900/40 py-8 px-4 text-center">
                <Inbox className="size-8 text-muted-foreground/60 mb-2" />
                <p className="text-xs font-semibold text-foreground">No active flocks recorded yet</p>
                <p className="text-[11px] text-muted-foreground max-w-sm mt-1">
                  Start by adding your first layer flock in Flock Management to start tracking bird counts, mortality, and daily egg production.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Audit / Activity Log */}
        <Card className="border-border/60 shadow-xs">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold">Recent Activity</CardTitle>
                <CardDescription className="text-xs">
                  Latest system audit entries
                </CardDescription>
              </div>
              <Activity className="size-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {activityLogs && activityLogs.length > 0 ? (
              <div className="space-y-3">
                {activityLogs.map((log) => (
                  <div key={log.id} className="flex flex-col gap-0.5 border-b border-border/40 pb-2.5 last:border-0 last:pb-0">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground truncate">
                        {log.action.replace(/_/g, " ")}
                      </span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {formatDate(log.created_at, "HH:mm")}
                      </span>
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      Entity: <span className="font-mono">{log.entity_table}</span>
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/80 bg-slate-50/50 dark:bg-slate-900/40 py-8 px-4 text-center">
                <Activity className="size-7 text-muted-foreground/50 mb-2" />
                <p className="text-xs font-semibold text-foreground">No recent activity logs</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  System operations and audit trails will appear here.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
