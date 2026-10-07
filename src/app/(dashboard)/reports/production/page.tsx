import { Suspense } from "react";
import { format } from "date-fns";
import { getProductionReport } from "@/actions/reports";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { AlertTriangle, Activity, Egg, Skull } from "lucide-react";
import { getCurrentUserProfile } from "@/lib/user-profile";

export default async function ProductionReportPage() {
  const profile = await getCurrentUserProfile();
  const isAdmin = profile?.role === "ADMIN";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Production & Flocks</h1>
        <p className="text-muted-foreground mt-2">
          Detailed metrics on egg production, laying rates, and flock health.
        </p>
      </div>

      <Suspense fallback={<div className="h-64 flex items-center justify-center">Loading...</div>}>
        <ProductionContent />
      </Suspense>
    </div>
  );
}

async function ProductionContent() {
  // Last 30 days
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 30);
  
  const startDate = start.toISOString().split('T')[0];
  const endDate = end.toISOString().split('T')[0];

  const result = await getProductionReport(startDate, endDate);

  if (!result.success || !result.data) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6 text-center text-destructive">
          <AlertTriangle className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p>Failed to load production data.</p>
          <p className="text-sm opacity-70">{result.error}</p>
        </CardContent>
      </Card>
    );
  }

  const { data } = result;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex justify-between">
              Total Eggs
              <Egg className="h-4 w-4 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.totalEggs.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Last 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex justify-between">
              Laying Rate
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${data.summary.estimatedLayingRate >= 80 ? 'text-green-600' : 'text-amber-600'}`}>
              {data.summary.estimatedLayingRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">Overall average</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex justify-between">
              Damage Rate
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${data.summary.damageRejectRate > 5 ? 'text-red-600' : 'text-green-600'}`}>
              {data.summary.damageRejectRate.toFixed(2)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              ({(data.summary.damagedEggs + data.summary.crackedEggs).toLocaleString()} eggs)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex justify-between">
              Total Mortality
              <Skull className="h-4 w-4 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{data.summary.totalMortality.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Last 30 days</p>
          </CardContent>
        </Card>
      </div>

      <h2 className="text-xl font-semibold mt-8 mb-4 border-b pb-2">Flock Performance</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {data.flocks.map((f, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">{f.flockIdentifier}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-between items-center py-1 border-b">
                <span className="text-muted-foreground">Eggs Produced:</span>
                <span className="font-medium">{f.totalEggs.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b">
                <span className="text-muted-foreground">Damage Rate:</span>
                <span className={`font-medium ${f.damageRate > 5 ? 'text-red-600' : ''}`}>
                  {f.damageRate.toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-muted-foreground">Mortality:</span>
                <span className="font-medium">{f.mortality.toLocaleString()} birds</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
