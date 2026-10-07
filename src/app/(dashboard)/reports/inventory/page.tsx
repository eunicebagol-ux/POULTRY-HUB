import { Suspense } from "react";
import { getInventoryReport } from "@/actions/reports";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Egg, Package, DollarSign } from "lucide-react";

export default async function InventoryReportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Inventory Valuation</h1>
        <p className="text-muted-foreground mt-2">
          Current stock levels and estimated valuation for eggs and feed.
        </p>
      </div>

      <Suspense fallback={<div className="h-64 flex items-center justify-center">Loading...</div>}>
        <InventoryContent />
      </Suspense>
    </div>
  );
}

async function InventoryContent() {
  const result = await getInventoryReport();

  if (!result.success || !result.data) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6 text-center text-destructive">
          <AlertTriangle className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p>Failed to load inventory valuation data.</p>
          <p className="text-sm opacity-70">{result.error}</p>
        </CardContent>
      </Card>
    );
  }

  const { data } = result;

  return (
    <div className="space-y-8">
      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-blue-200">
          <CardHeader className="pb-2 bg-blue-50/50">
            <CardTitle className="text-lg flex items-center text-blue-900">
              <Egg className="mr-2 h-5 w-5" />
              Estimated Inventory Value
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="text-3xl font-bold text-blue-700">
              ${data.eggValuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-sm text-blue-600/80 mt-1">
              Based on recent sales pricing for {data.eggTotal.toLocaleString()} eggs
            </p>
          </CardContent>
        </Card>

        <Card className="border-amber-200">
          <CardHeader className="pb-2 bg-amber-50/50">
            <CardTitle className="text-lg flex items-center text-amber-900">
              <Package className="mr-2 h-5 w-5" />
              Feed Inventory Valuation
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="text-3xl font-bold text-amber-700">
              ${data.feedValuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-sm text-amber-600/80 mt-1">
              Estimated value of {data.feedTotal.toLocaleString()} kg of feed in stock
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Eggs Breakdown */}
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <Egg className="mr-2 h-5 w-5 text-muted-foreground" />
            Egg Stock Breakdown
          </h2>
          <div className="space-y-3">
            {data.eggs.length === 0 ? (
              <div className="text-sm text-muted-foreground italic">No egg stock recorded.</div>
            ) : (
              data.eggs.map((e, i) => (
                <Card key={i} className="overflow-hidden">
                  <div className="p-4 flex justify-between items-center bg-background">
                    <span className="font-medium">{e.size}</span>
                    <span className="text-lg">{e.stock.toLocaleString()} pcs</span>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Feed Breakdown */}
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <Package className="mr-2 h-5 w-5 text-muted-foreground" />
            Feed Stock Breakdown
          </h2>
          <div className="space-y-3">
            {data.feed.length === 0 ? (
              <div className="text-sm text-muted-foreground italic">No feed stock recorded.</div>
            ) : (
              data.feed.map((f, i) => (
                <Card key={i} className="overflow-hidden">
                  <div className="p-4 bg-background">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium capitalize">{f.type.replace('_', ' ')}</span>
                      <span className="text-lg">{f.stock.toLocaleString()} kg</span>
                    </div>
                    <div className="flex justify-between items-center text-sm text-muted-foreground pt-2 border-t">
                      <span>Estimated Value</span>
                      <span className="font-medium text-foreground">
                        ${f.valuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
