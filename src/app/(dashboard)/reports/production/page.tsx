import { Suspense } from "react";
import { getProductionReport } from "@/actions/reports";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Egg } from "lucide-react";
import { EggProductionReportView } from "@/components/reports/egg-production-report-view";
import { getCurrentUserProfile } from "@/lib/user-profile";

export const metadata = {
  title: "Production & Flocks Report — POULTRY HUB",
  description: "Egg collection logs, quality metrics, periodic aggregation, and administrative exports.",
};

export default async function ProductionReportPage() {
  const profile = await getCurrentUserProfile();
  const isAdmin = profile?.role === "ADMIN";

  return (
    <div className="space-y-8">
      {/* ── Main Egg Production Reporting & Export Suite ── */}
      <EggProductionReportView isAdmin={isAdmin} />

      {/* ── Additional Flock Health & Batch Performance Breakdown ── */}
      <div className="border-t pt-8">
        <h3 className="text-xl font-bold tracking-tight mb-2">Flock Laying & Mortality Overview</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Historical batch laying performance and mortality trends across active laying hens.
        </p>

        <Suspense fallback={<div className="h-32 flex items-center justify-center text-xs text-muted-foreground">Loading flock statistics...</div>}>
          <FlockPerformanceSection />
        </Suspense>
      </div>
    </div>
  );
}

async function FlockPerformanceSection() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 30);

  const startDate = start.toISOString().split("T")[0];
  const endDate = end.toISOString().split("T")[0];

  const result = await getProductionReport(startDate, endDate);

  if (!result.success || !result.data) {
    return (
      <Card className="border-border/60 bg-muted/20">
        <CardContent className="py-6 text-center text-xs text-muted-foreground">
          No additional flock statistics available for this period.
        </CardContent>
      </Card>
    );
  }

  const { data } = result;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {data.flocks.map((f, i) => (
        <Card key={i} className="border-border/60 shadow-xs">
          <CardHeader className="pb-2 p-4">
            <CardTitle className="text-sm font-bold flex items-center justify-between">
              <span>{f.flockIdentifier}</span>
              <Egg className="size-4 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1 text-xs space-y-2">
            <div className="flex justify-between items-center py-1 border-b border-border/40">
              <span className="text-muted-foreground">30-Day Eggs Produced:</span>
              <span className="font-semibold">{f.totalEggs.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-border/40">
              <span className="text-muted-foreground">Damage/Reject Rate:</span>
              <span className={`font-semibold ${f.damageRate > 5 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                {f.damageRate.toFixed(2)}%
              </span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-muted-foreground">Mortality / Culls:</span>
              <span className="font-semibold">{f.mortality.toLocaleString()} birds</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
