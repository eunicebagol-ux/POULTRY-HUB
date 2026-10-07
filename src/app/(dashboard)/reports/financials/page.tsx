import { Suspense } from "react";
import { getFinancialReport } from "@/actions/reports";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, DollarSign, TrendingDown, TrendingUp } from "lucide-react";
import { getCurrentUserProfile } from "@/lib/user-profile";

export default async function FinancialReportPage() {
  const profile = await getCurrentUserProfile();
  const isAdmin = profile?.role === "ADMIN";

  if (!isAdmin) {
    return (
      <div className="p-8 text-center text-red-600">
        <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <h2 className="text-xl font-bold">Access Denied</h2>
        <p>You do not have permission to view financial reports.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Financial Summary</h1>
        <p className="text-muted-foreground mt-2">
          Revenue, expenses, and net profit analysis.
        </p>
      </div>

      <Suspense fallback={<div className="h-64 flex items-center justify-center">Loading...</div>}>
        <FinancialContent />
      </Suspense>
    </div>
  );
}

async function FinancialContent() {
  // Last 30 days
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 30);
  
  const startDate = start.toISOString().split('T')[0];
  const endDate = end.toISOString().split('T')[0];

  const result = await getFinancialReport(startDate, endDate);

  if (!result.success || !result.data) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6 text-center text-destructive">
          <AlertTriangle className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p>Failed to load financial data.</p>
          <p className="text-sm opacity-70">{result.error}</p>
        </CardContent>
      </Card>
    );
  }

  const { data } = result;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex justify-between">
              Total Revenue
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${data.summary.totalSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Last 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex justify-between">
              Total Expenses
              <TrendingDown className="h-4 w-4 text-red-600" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              ${data.summary.totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Last 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex justify-between">
              Net Result
              <DollarSign className={`h-4 w-4 ${data.summary.netResult >= 0 ? 'text-green-600' : 'text-red-600'}`} />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${data.summary.netResult >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${data.summary.netResult.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Operating profit/loss</p>
          </CardContent>
        </Card>
      </div>

      <h2 className="text-xl font-semibold mt-8 mb-4 border-b pb-2">Expenses by Category</h2>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {data.expensesByCategory.map((c, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg capitalize">{c.name.replace('_', ' ')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-medium">
                ${c.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
