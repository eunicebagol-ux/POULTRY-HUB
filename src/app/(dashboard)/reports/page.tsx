import { Suspense } from "react";
import Link from "next/link";
import { type ComponentType } from "react";
import { format } from "date-fns";
import { getOverviewReport } from "@/actions/reports";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DEFAULT_CURRENCY_SYMBOL } from "@/lib/constants";

import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Activity,
  Package,
  DollarSign,
  Calendar,
  AlertTriangle,
  ArrowRight
} from "lucide-react";
import { getCurrentUserProfile } from "@/lib/user-profile";

export default async function ReportsPage() {
  const profile = await getCurrentUserProfile();
  const isAdmin = profile?.role === "ADMIN";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reports & Analytics</h1>
        <p className="text-muted-foreground mt-2">
          High-level metrics and farm performance summary.
        </p>
      </div>

      <Suspense fallback={<DashboardSkeleton isAdmin={isAdmin} />}>
        <DashboardContent isAdmin={isAdmin} />
      </Suspense>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-8">
        <ReportCard 
          title="Production & Flocks" 
          description="Laying rates and mortality trends" 
          href="/reports/production" 
          icon={Activity} 
          color="text-blue-500" 
        />
        <ReportCard 
          title="Feed & Efficiency" 
          description="Feed consumption and efficiency metrics" 
          href="/reports/feed" 
          icon={Package} 
          color="text-amber-500" 
        />
        {isAdmin && (
          <ReportCard 
            title="Financial Summary" 
            description="Revenue, expenses, and net profit" 
            href="/reports/financials" 
            icon={DollarSign} 
            color="text-green-500" 
          />
        )}
        <ReportCard 
          title="Inventory Valuation" 
          description="Value of current eggs and feed" 
          href="/reports/inventory" 
          icon={BarChart3} 
          color="text-purple-500" 
        />
      </div>
    </div>
  );
}

function ReportCard({ title, description, href, icon: Icon, color }: { title: string, description: string, href: string, icon: ComponentType<{ className?: string }>, color: string }) {
  return (
    <Card className="hover:shadow-md transition-all group overflow-hidden relative">
      <div className={`absolute right-[-20px] top-[-20px] opacity-10 group-hover:scale-150 transition-transform duration-500 ease-in-out`}>
        <Icon className={`w-32 h-32 ${color}`} />
      </div>
      <CardHeader className="pb-2">
        <Icon className={`w-8 h-8 mb-2 ${color}`} />
        <CardTitle className="text-lg">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Link href={href} className="flex items-center w-full justify-between mt-2 text-sm font-medium hover:bg-primary/5 p-2 rounded-md transition-colors group/link">
            View Report
            <ArrowRight className="w-4 h-4 ml-2 group-hover/link:translate-x-1 transition-transform" />
        </Link>
      </CardContent>
    </Card>
  );
}

async function DashboardContent({ isAdmin }: { isAdmin: boolean }) {
  // Let's get the last 30 days as a default summary
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 30);
  
  const startDate = start.toISOString().split('T')[0];
  const endDate = end.toISOString().split('T')[0];

  const result = await getOverviewReport(startDate, endDate);

  if (!result.success) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6 text-center text-destructive">
          <AlertTriangle className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p>Failed to load dashboard data.</p>
          <p className="text-sm opacity-70">{result.error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!result.data) return null;

  const { data } = result;

  return (
    <div className="space-y-6">
      <div className="flex items-center text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg inline-flex">
        <Calendar className="w-4 h-4 mr-2" />
        Summary for the last 30 days ({format(start, 'MMM d, yyyy')} - {format(end, 'MMM d, yyyy')})
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Total Eggs Produced"
          value={data.totalEggsProduced.toLocaleString()}
          icon={Activity}
          description="Last 30 days"
        />
        <KpiCard
          title="Estimated Laying Rate"
          value={`${data.estimatedLayingRate.toFixed(1)}%`}
          icon={data.estimatedLayingRate >= 80 ? TrendingUp : TrendingDown}
          description="Overall average"
          valueColor={data.estimatedLayingRate >= 80 ? "text-green-600" : (data.estimatedLayingRate < 70 ? "text-red-600" : "")}
        />
        <KpiCard
          title="Total Mortality"
          value={data.totalMortality.toLocaleString()}
          icon={AlertTriangle}
          description="Birds lost/culled"
        />
        <KpiCard
          title="Current Egg Stock"
          value={data.currentEggStock.toLocaleString()}
          icon={Package}
          description="Total pieces available"
        />
      </div>

      {isAdmin && (
        <>
          <h2 className="text-xl font-semibold mt-8 mb-4 border-b pb-2">Financial Overview (Last 30 Days)</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <KpiCard
              title="Total Revenue"
              value={`${DEFAULT_CURRENCY_SYMBOL}${(data.totalEggSales || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
              icon={TrendingUp}
              valueColor="text-green-600"
            />
            <KpiCard
              title="Recorded Expenses"
              value={`${DEFAULT_CURRENCY_SYMBOL}${(data.recordedExpenses || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
              icon={TrendingDown}
              valueColor="text-red-600"
            />
            <KpiCard
              title="Net Operating Result"
              value={`${DEFAULT_CURRENCY_SYMBOL}${(data.netOperatingResult || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
              icon={DollarSign}
              valueColor={(data.netOperatingResult || 0) >= 0 ? "text-green-600" : "text-red-600"}
            />
          </div>
        </>
      )}
    </div>
  );
}

function KpiCard({ title, value, icon: Icon, description, valueColor = "" }: { title: string, value: string | number, icon: ComponentType<{ className?: string }>, description?: string, valueColor?: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${valueColor}`}>{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="space-y-6">
      <div className="h-10 w-64 bg-muted animate-pulse rounded-md" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="h-4 w-1/2 bg-muted animate-pulse rounded-md" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-3/4 mb-2 bg-muted animate-pulse rounded-md" />
              <div className="h-3 w-1/3 bg-muted animate-pulse rounded-md" />
            </CardContent>
          </Card>
        ))}
      </div>
      {isAdmin && (
        <div className="grid gap-4 md:grid-cols-3 mt-8">
          {[...Array(3)].map((_, i) => (
            <Card key={`fin-${i}`}>
              <CardHeader className="pb-2">
                <div className="h-4 w-1/2 bg-muted animate-pulse rounded-md" />
              </CardHeader>
              <CardContent>
                <div className="h-8 w-3/4 mb-2 bg-muted animate-pulse rounded-md" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
