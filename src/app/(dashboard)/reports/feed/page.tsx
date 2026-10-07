import { Suspense } from "react";
import { getFeedReport } from "@/actions/reports";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Package, Scale, TrendingDown } from "lucide-react";


export default async function FeedReportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Feed & Efficiency</h1>
        <p className="text-muted-foreground mt-2">
          Track feed consumption, stock levels, and feed conversion ratios.
        </p>
      </div>

      <Suspense fallback={<div className="h-64 flex items-center justify-center">Loading...</div>}>
        <FeedContent />
      </Suspense>
    </div>
  );
}

async function FeedContent() {
  // Last 30 days
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 30);
  
  const startDate = start.toISOString().split('T')[0];
  const endDate = end.toISOString().split('T')[0];

  const result = await getFeedReport(startDate, endDate);

  if (!result.success) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6 text-center text-destructive">
          <AlertTriangle className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p>Failed to load feed data.</p>
          <p className="text-sm opacity-70">{result.error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!result.data) return null;

  const { data } = result;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex justify-between">
              Total Consumption
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.totalConsumption.toLocaleString()} kg</div>
            <p className="text-xs text-muted-foreground mt-1">Last 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex justify-between">
              Feed per Egg (g/egg)
              <Scale className="h-4 w-4 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {data.summary.feedPerEgg.toFixed(0)} g
            </div>
            <p className="text-xs text-muted-foreground mt-1">Grams of feed per egg</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex justify-between">
              Current Stock
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.summary.currentFeedStock.toLocaleString()} kg</div>
            <p className="text-xs text-muted-foreground mt-1">Available in inventory</p>
          </CardContent>
        </Card>
      </div>

      <h2 className="text-xl font-semibold mt-8 mb-4 border-b pb-2">Consumption by Feed Type</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {data.byFeedType.map((f, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg capitalize">{f.name.replace('_', ' ')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-medium">{f.value.toLocaleString()} kg</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
