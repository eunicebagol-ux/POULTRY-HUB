"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart3, PackageCheck } from "lucide-react";
import type { EggSize } from "@/types";

interface ChartDataPoint {
  date: string;
  good_eggs: number;
  damaged_eggs: number;
}

interface InventoryItem {
  size: EggSize;
  stock_pieces: number;
}

interface DashboardChartsProps {
  productionHistory: ChartDataPoint[];
  eggInventory: InventoryItem[];
}

const SIZE_LABELS: Record<EggSize, string> = {
  SMALL: "Small",
  MEDIUM: "Medium",
  LARGE: "Large",
  EXTRA_LARGE: "X-Large",
  JUMBO: "Jumbo",
  UNGRADED: "Ungraded",
};

export function DashboardCharts({
  productionHistory,
  eggInventory,
}: DashboardChartsProps) {
  const hasProductionData = productionHistory && productionHistory.length > 0;
  const totalStockPieces = eggInventory.reduce(
    (acc, item) => acc + (item.stock_pieces || 0),
    0
  );

  const inventoryChartData = eggInventory.map((item) => ({
    name: SIZE_LABELS[item.size] || item.size,
    pieces: item.stock_pieces,
    trays: Math.floor(item.stock_pieces / 30),
  }));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* ── Production Trend Chart ────────────────────────────────────── */}
      <Card className="border-border/60 shadow-xs">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold">Production Trend</CardTitle>
              <CardDescription className="text-xs">
                Good vs damaged eggs from recent collections
              </CardDescription>
            </div>
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950 p-2 text-emerald-600 dark:text-emerald-400">
              <BarChart3 className="size-5" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="h-72">
          {hasProductionData ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={productionHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0F172A",
                    borderColor: "#334155",
                    borderRadius: "8px",
                    color: "#F8FAFC",
                    fontSize: "12px",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
                <Bar dataKey="good_eggs" name="Good Eggs" fill="#059669" radius={[4, 4, 0, 0]} />
                <Bar dataKey="damaged_eggs" name="Damaged Eggs" fill="#E11D48" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-border/80 bg-slate-50/50 dark:bg-slate-900/40 p-6 text-center">
              <BarChart3 className="size-8 text-muted-foreground/60 mb-2" />
              <p className="text-xs font-semibold text-foreground">No production history recorded yet</p>
              <p className="text-[11px] text-muted-foreground max-w-xs mt-1">
                Daily egg collection trends will automatically display here as new production logs are added.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Inventory Breakdown Chart ──────────────────────────────────── */}
      <Card className="border-border/60 shadow-xs">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold">Egg Stock Breakdown</CardTitle>
              <CardDescription className="text-xs">
                Current inventory stock pieces by size
              </CardDescription>
            </div>
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950 p-2 text-emerald-600 dark:text-emerald-400">
              <PackageCheck className="size-5" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="h-72">
          {totalStockPieces > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={inventoryChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#0F172A",
                    borderColor: "#334155",
                    borderRadius: "8px",
                    color: "#F8FAFC",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="pieces" name="Stock (Pieces)" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-border/80 bg-slate-50/50 dark:bg-slate-900/40 p-6 text-center">
              <PackageCheck className="size-8 text-muted-foreground/60 mb-2" />
              <p className="text-xs font-semibold text-foreground">Zero egg inventory balance</p>
              <p className="text-[11px] text-muted-foreground max-w-xs mt-1">
                All egg size balances are currently at 0 pieces. Record egg collections to replenish inventory.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
