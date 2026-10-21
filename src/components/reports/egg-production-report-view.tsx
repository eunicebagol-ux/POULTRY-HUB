"use client";

import { useState, useEffect } from "react";
import { format, parseISO, addDays, subDays, addWeeks, subWeeks, addMonths, subMonths, addYears, subYears } from "date-fns";
import { toast } from "sonner";
import {
  Download,
  FileSpreadsheet,
  FileText,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Egg,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  BarChart3,
  Sparkles,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
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

import { getEggProductionPeriodReport } from "@/actions/egg-production-reports";
import type {
  ReportingPeriod,
  EggProductionPeriodReport,
  ExportFormat,
} from "@/types/egg-reports";

interface EggProductionReportViewProps {
  isAdmin: boolean;
  initialPeriod?: ReportingPeriod;
  initialDate?: string;
}

export function EggProductionReportView({
  isAdmin,
  initialPeriod = "daily",
  initialDate,
}: EggProductionReportViewProps) {
  const [period, setPeriod] = useState<ReportingPeriod>(initialPeriod);
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    if (initialDate) return initialDate;
    const now = new Date();
    return format(now, "yyyy-MM-dd");
  });

  const [report, setReport] = useState<EggProductionPeriodReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState<ExportFormat | null>(null);
  const [reloadKey, setReloadKey] = useState<number>(0);

  useEffect(() => {
    let isCancelled = false;

    async function fetchData() {
      setLoading(true);
      setError(null);
      try {
        const res = await getEggProductionPeriodReport(period, selectedDate);
        if (isCancelled) return;
        if (res.success) {
          setReport(res.data);
        } else {
          setError(res.error || "Failed to load report data.");
        }
      } catch (err) {
        if (!isCancelled) {
          setError(err instanceof Error ? err.message : "An unexpected error occurred.");
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    void fetchData();

    return () => {
      isCancelled = true;
    };
  }, [period, selectedDate, reloadKey]);

  // Handle date step navigation (prev/next)
  const handleStepDate = (direction: "prev" | "next") => {
    try {
      const base = parseISO(
        selectedDate.length === 4
          ? `${selectedDate}-01-01`
          : selectedDate.length === 7
          ? `${selectedDate}-01`
          : selectedDate
      );
      let nextDate = base;

      switch (period) {
        case "daily":
          nextDate = direction === "prev" ? subDays(base, 1) : addDays(base, 1);
          setSelectedDate(format(nextDate, "yyyy-MM-dd"));
          break;
        case "weekly":
          nextDate = direction === "prev" ? subWeeks(base, 1) : addWeeks(base, 1);
          setSelectedDate(format(nextDate, "yyyy-MM-dd"));
          break;
        case "monthly":
          nextDate = direction === "prev" ? subMonths(base, 1) : addMonths(base, 1);
          setSelectedDate(format(nextDate, "yyyy-MM"));
          break;
        case "yearly":
          nextDate = direction === "prev" ? subYears(base, 1) : addYears(base, 1);
          setSelectedDate(format(nextDate, "yyyy"));
          break;
      }
    } catch {
      // Ignore parse errors
    }
  };

  // Quick reset to today / current period
  const handleQuickReset = () => {
    const now = new Date();
    switch (period) {
      case "daily":
      case "weekly":
        setSelectedDate(format(now, "yyyy-MM-dd"));
        break;
      case "monthly":
        setSelectedDate(format(now, "yyyy-MM"));
        break;
      case "yearly":
        setSelectedDate(format(now, "yyyy"));
        break;
    }
  };

  // Handle file export (Admin only)
  const handleExport = async (formatType: ExportFormat) => {
    if (!isAdmin) {
      toast.error("Exporting reports is restricted to Administrators.");
      return;
    }

    setIsExporting(formatType);
    const toastId = toast.loading(`Preparing ${formatType.toUpperCase()} export...`);

    try {
      const queryDate = report?.dateKey || selectedDate;
      const url = `/api/reports/egg-production/export?period=${period}&date=${encodeURIComponent(
        queryDate
      )}&format=${formatType}`;

      const res = await fetch(url);

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || `Export failed with status ${res.status}`);
      }

      const blob = await res.blob();
      const contentDisposition = res.headers.get("Content-Disposition");
      let filename = `poultry-hub-egg-report-${period}-${queryDate}.${formatType}`;

      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) filename = match[1];
      }

      // Trigger download
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);

      toast.success(`${formatType.toUpperCase()} report exported successfully!`, {
        id: toastId,
        description: filename,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Export failed.", { id: toastId });
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Top Header & Actions ────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight">Egg Production Reporting</h2>
            <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
              Live DB Records
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Reconciled collection figures, size quality breakdown, and administrative exports.
          </p>
        </div>

        {/* Admin Export Actions */}
        {isAdmin && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-xs text-muted-foreground mr-1 hidden md:block">
              Admin Export:
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400"
              onClick={() => handleExport("xlsx")}
              disabled={isExporting !== null || loading}
            >
              <FileSpreadsheet className="size-4 text-emerald-600 dark:text-emerald-400" />
              <span>{isExporting === "xlsx" ? "Exporting..." : "Excel (.xlsx)"}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-400"
              onClick={() => handleExport("csv")}
              disabled={isExporting !== null || loading}
            >
              <FileText className="size-4 text-blue-600 dark:text-blue-400" />
              <span>{isExporting === "csv" ? "Exporting..." : "CSV (.csv)"}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400"
              onClick={() => handleExport("pdf")}
              disabled={isExporting !== null || loading}
            >
              <Download className="size-4 text-rose-600 dark:text-rose-400" />
              <span>{isExporting === "pdf" ? "Exporting..." : "PDF (.pdf)"}</span>
            </Button>
          </div>
        )}
      </div>

      {/* ── Period Selector & Controls ──────────────────────────────────── */}
      <Card className="bg-card/50 shadow-xs border-border/70">
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            {/* 1. Period Toggle Tabs */}
            <div className="flex items-center rounded-lg bg-muted p-1 border">
              {(["daily", "weekly", "monthly", "yearly"] as ReportingPeriod[]).map((p) => {
                const isActive = period === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setPeriod(p);
                      const now = new Date();
                      if (p === "daily" || p === "weekly") {
                        setSelectedDate(format(now, "yyyy-MM-dd"));
                      } else if (p === "monthly") {
                        setSelectedDate(format(now, "yyyy-MM"));
                      } else {
                        setSelectedDate(format(now, "yyyy"));
                      }
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                      isActive
                        ? "bg-background text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                );
              })}
            </div>

            {/* 2. Date Navigation Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="size-8"
                onClick={() => handleStepDate("prev")}
                title="Previous Period"
              >
                <ChevronLeft className="size-4" />
              </Button>

              {/* Dynamic Input depending on period */}
              {period === "daily" && (
                <div className="relative">
                  <input
                    type="date"
                    value={selectedDate.slice(0, 10)}
                    onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                    className="h-8 rounded-md border border-input bg-background px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
              )}

              {period === "weekly" && (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={selectedDate.slice(0, 10)}
                    onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                    className="h-8 rounded-md border border-input bg-background px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                  <Badge variant="secondary" className="text-[11px] font-normal hidden sm:inline-flex">
                    Week: {report?.formattedDateRange || "Selected Week"}
                  </Badge>
                </div>
              )}

              {period === "monthly" && (
                <div className="flex items-center gap-2">
                  <input
                    type="month"
                    value={selectedDate.slice(0, 7)}
                    onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                    className="h-8 rounded-md border border-input bg-background px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
              )}

              {period === "yearly" && (
                <div className="flex items-center gap-2">
                  <select
                    value={selectedDate.slice(0, 4)}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="h-8 rounded-md border border-input bg-background px-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {[2024, 2025, 2026, 2027, 2028].map((y) => (
                      <option key={y} value={y.toString()}>
                        Year {y}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <Button
                variant="outline"
                size="icon"
                className="size-8"
                onClick={() => handleStepDate("next")}
                title="Next Period"
              >
                <ChevronRight className="size-4" />
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground hover:text-foreground"
                onClick={handleQuickReset}
              >
                Today
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-muted-foreground hover:text-foreground"
                onClick={() => setReloadKey((k) => k + 1)}
                title="Refresh Data"
              >
                <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Error Banner ────────────────────────────────────────────────── */}
      {error && (
        <Card className="border-destructive/60 bg-destructive/10 text-destructive">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="size-5 shrink-0" />
              <div>
                <p className="text-sm font-semibold">Error Loading Report</p>
                <p className="text-xs opacity-80">{error}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReloadKey((k) => k + 1)}
              className="text-xs border-destructive/40 hover:bg-destructive/20"
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Loading Skeleton ────────────────────────────────────────────── */}
      {loading && !report && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[...Array(5)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="p-4 pb-2">
                  <div className="h-3 w-24 bg-muted rounded" />
                </CardHeader>
                <CardContent className="p-4 pt-1">
                  <div className="h-7 w-20 bg-muted rounded mb-2" />
                  <div className="h-3 w-16 bg-muted rounded" />
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="h-80 animate-pulse bg-muted/30" />
        </div>
      )}

      {/* ── Report Content ──────────────────────────────────────────────── */}
      {report && (
        <>
          {/* Active Date Banner & Reconciliation Badge */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-muted/40 px-4 py-2.5 rounded-lg border text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Calendar className="size-4 text-emerald-600 dark:text-emerald-400" />
              <span className="font-semibold text-foreground">{report.formattedDateRange}</span>
              <span>•</span>
              <span>{report.summary.recordCount} collection record(s)</span>
            </div>

            {/* Reconciliation Check */}
            <div className="flex items-center gap-1.5 text-[11px]">
              {report.summary.totalEggs ===
              report.summary.goodEggs +
                report.summary.crackedEggs +
                report.summary.damagedEggs ? (
                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                  <CheckCircle2 className="size-3.5" />
                  100% Egg Counts Reconciled (Good + Cracked + Damaged = Total)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                  <AlertTriangle className="size-3.5" />
                  Egg count discrepancy detected
                </span>
              )}
            </div>
          </div>

          {/* ── 1. KPI Cards Grid ─────────────────────────────────────────── */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {/* Total Eggs */}
            <Card className="border-border/60 shadow-xs relative overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
                <CardTitle className="text-xs font-semibold text-muted-foreground">
                  TOTAL EGGS COLLECTED
                </CardTitle>
                <div className="rounded-md bg-primary/10 p-1.5 text-primary">
                  <Egg className="size-4" />
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-1">
                <div className="text-2xl font-bold tracking-tight">
                  {report.summary.totalEggs.toLocaleString()}
                </div>
                <div className="mt-1 flex items-center text-xs">
                  {report.comparison?.hasPreviousPeriod ? (
                    <ComparisonBadge
                      diff={report.comparison.totalEggsDiff}
                      percent={report.comparison.totalEggsPercentChange}
                      label={report.comparison.previousPeriodLabel}
                    />
                  ) : (
                    <span className="text-muted-foreground text-[11px]">
                      No previous period data
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Good Eggs */}
            <Card className="border-border/60 shadow-xs relative overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
                <CardTitle className="text-xs font-semibold text-muted-foreground">
                  GOOD EGGS (SALEABLE)
                </CardTitle>
                <div className="rounded-md bg-emerald-500/10 p-1.5 text-emerald-600 dark:text-emerald-400">
                  <Sparkles className="size-4" />
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-1">
                <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                  {report.summary.goodEggs.toLocaleString()}
                </div>
                <div className="mt-1 flex items-center justify-between text-xs">
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {report.summary.goodEggsRate}% of total
                  </span>
                  {report.comparison?.hasPreviousPeriod && (
                    <span className="text-[11px] text-muted-foreground">
                      vs {report.comparison.previousGoodEggs?.toLocaleString()} prev
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Cracked Eggs */}
            <Card className="border-border/60 shadow-xs relative overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
                <CardTitle className="text-xs font-semibold text-muted-foreground">
                  CRACKED EGGS
                </CardTitle>
                <div className="rounded-md bg-amber-500/10 p-1.5 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="size-4" />
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-1">
                <div className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
                  {report.summary.crackedEggs.toLocaleString()}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  <span>{report.summary.crackedEggsRate}% loss rate</span>
                </div>
              </CardContent>
            </Card>

            {/* Damaged Eggs */}
            <Card className="border-border/60 shadow-xs relative overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
                <CardTitle className="text-xs font-semibold text-muted-foreground">
                  DAMAGED / REJECTS
                </CardTitle>
                <div className="rounded-md bg-rose-500/10 p-1.5 text-rose-600 dark:text-rose-400">
                  <AlertTriangle className="size-4" />
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-1">
                <div className="text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
                  {report.summary.damagedEggs.toLocaleString()}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  <span>{report.summary.damagedEggsRate}% discard rate</span>
                </div>
              </CardContent>
            </Card>

            {/* Period Average */}
            <Card className="border-border/60 shadow-xs relative overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase">
                  {report.summary.averageLabel}
                </CardTitle>
                <div className="rounded-md bg-blue-500/10 p-1.5 text-blue-600 dark:text-blue-400">
                  <TrendingUp className="size-4" />
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-1">
                <div className="text-2xl font-bold tracking-tight text-blue-600 dark:text-blue-400">
                  {report.summary.periodAverage.toLocaleString()}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  <span>eggs / {period === "yearly" ? "month" : "day"}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── 2. Production Trend Chart ──────────────────────────────────── */}
          <Card className="border-border/60 shadow-xs">
            <CardHeader className="p-4 sm:p-5 pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold">
                    {period.charAt(0).toUpperCase() + period.slice(1)} Production Breakdown
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Comparison of good, cracked, and damaged eggs across {report.formattedDateRange}
                  </CardDescription>
                </div>
                <div className="rounded-lg bg-emerald-50 dark:bg-emerald-950 p-2 text-emerald-600 dark:text-emerald-400">
                  <BarChart3 className="size-5" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-5 pt-2 h-72">
              {report.summary.totalEggs > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={report.chartData}
                    margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} />
                    <YAxis tick={{ fontSize: 11 }} tickLine={false} />
                    <Tooltip content={<CustomChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }} />
                    <Bar
                      dataKey="goodEggs"
                      name="Good Eggs"
                      stackId="a"
                      fill="#059669"
                      radius={[0, 0, 0, 0]}
                    />
                    <Bar
                      dataKey="crackedEggs"
                      name="Cracked"
                      stackId="a"
                      fill="#D97706"
                      radius={[0, 0, 0, 0]}
                    />
                    <Bar
                      dataKey="damagedEggs"
                      name="Damaged"
                      stackId="a"
                      fill="#E11D48"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-border/80 bg-slate-50/50 dark:bg-slate-900/40 p-6 text-center">
                  <Egg className="size-8 text-muted-foreground/50 mb-2" />
                  <p className="text-xs font-semibold text-foreground">
                    No production records for {report.formattedDateRange}
                  </p>
                  <p className="text-[11px] text-muted-foreground max-w-xs mt-1">
                    Select another period or record new egg collections to view visual trend data.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── 3. Detailed Data Table ────────────────────────────────────── */}
          <Card className="border-border/60 shadow-xs">
            <CardHeader className="p-4 sm:p-5 pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <CardTitle className="text-base font-bold">Detailed Production Records</CardTitle>
                  <CardDescription className="text-xs">
                    Individual collection shift entries and sizing verification
                  </CardDescription>
                </div>
                <Badge variant="outline" className="text-xs self-start sm:self-auto font-normal">
                  {report.records.length} total entries
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="w-[120px] font-semibold text-xs">Date</TableHead>
                      <TableHead className="font-semibold text-xs">Shift</TableHead>
                      <TableHead className="font-semibold text-xs">Flock</TableHead>
                      <TableHead className="text-right font-semibold text-xs">Total Eggs</TableHead>
                      <TableHead className="text-right font-semibold text-xs">Good Eggs</TableHead>
                      <TableHead className="text-right font-semibold text-xs">Cracked</TableHead>
                      <TableHead className="text-right font-semibold text-xs">Damaged</TableHead>
                      <TableHead className="text-right font-semibold text-xs">Quality %</TableHead>
                      <TableHead className="max-w-[200px] font-semibold text-xs">Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.records.length > 0 ? (
                      report.records.map((r) => {
                        const goodRate =
                          r.total_eggs > 0
                            ? ((r.good_eggs / r.total_eggs) * 100).toFixed(1)
                            : "0.0";
                        return (
                          <TableRow key={r.id} className="hover:bg-muted/30">
                            <TableCell className="font-medium text-xs">
                              {r.production_date}
                            </TableCell>
                            <TableCell className="text-xs">
                              <Badge
                                variant="secondary"
                                className="text-[10px] uppercase tracking-wider font-semibold"
                              >
                                {r.collection_shift || "Shift"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">
                              <div className="font-medium">{r.flock_identifier}</div>
                              {r.flock_breed && (
                                <div className="text-[10px] text-muted-foreground">
                                  {r.flock_breed}
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-bold text-xs">
                              {r.total_eggs.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right font-medium text-xs text-emerald-600 dark:text-emerald-400">
                              {r.good_eggs.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right text-xs text-amber-600 dark:text-amber-400">
                              {r.cracked_eggs.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right text-xs text-rose-600 dark:text-rose-400">
                              {r.damaged_eggs.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right font-semibold text-xs">
                              {goodRate}%
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {r.notes || "—"}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          <Egg className="size-8 mx-auto mb-2 text-muted-foreground/40" />
                          <p className="text-sm font-medium">No egg production records found</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            There are no recorded collections for {report.formattedDateRange}.
                          </p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                  {report.records.length > 0 && (
                    <TableFooter className="bg-muted/50 font-semibold">
                      <TableRow>
                        <TableCell colSpan={3} className="text-xs uppercase font-bold">
                          Period Totals ({report.records.length} records)
                        </TableCell>
                        <TableCell className="text-right text-xs font-bold">
                          {report.summary.totalEggs.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-xs text-emerald-600 dark:text-emerald-400">
                          {report.summary.goodEggs.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-xs text-amber-600 dark:text-amber-400">
                          {report.summary.crackedEggs.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-xs text-rose-600 dark:text-rose-400">
                          {report.summary.damagedEggs.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right text-xs">
                          {report.summary.goodEggsRate}%
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          Avg: {report.summary.periodAverage.toLocaleString()}/period
                        </TableCell>
                      </TableRow>
                    </TableFooter>
                  )}
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ── Helper Components ────────────────────────────────────────────────────────

function ComparisonBadge({
  diff,
  percent,
  label,
}: {
  diff: number | null;
  percent: number | null;
  label: string;
}) {
  if (diff === null || percent === null) {
    return <span className="text-muted-foreground text-[11px]">No baseline comparison</span>;
  }

  const isPositive = diff > 0;
  const isZero = diff === 0;

  return (
    <div
      className={`inline-flex items-center gap-1 font-semibold text-[11px] ${
        isPositive
          ? "text-emerald-600 dark:text-emerald-400"
          : isZero
          ? "text-muted-foreground"
          : "text-rose-600 dark:text-rose-400"
      }`}
      title={`vs ${label}`}
    >
      {isPositive ? (
        <TrendingUp className="size-3" />
      ) : isZero ? (
        <Minus className="size-3" />
      ) : (
        <TrendingDown className="size-3" />
      )}
      <span>
        {isPositive ? "+" : ""}
        {diff.toLocaleString()} ({isPositive ? "+" : ""}
        {percent}%)
      </span>
      <span className="text-muted-foreground font-normal">vs prev</span>
    </div>
  );
}

interface TooltipPayloadItem {
  dataKey?: string;
  value?: number;
}

interface CustomChartTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}

function CustomChartTooltip({ active, payload, label }: CustomChartTooltipProps) {
  if (active && payload && payload.length) {
    const total = payload.reduce((sum: number, p: TooltipPayloadItem) => sum + (p.value || 0), 0);
    const good = payload.find((p: TooltipPayloadItem) => p.dataKey === "goodEggs")?.value || 0;
    const rate = total > 0 ? ((good / total) * 100).toFixed(1) : "0.0";

    return (
      <div className="rounded-lg border border-border bg-slate-900 p-3 text-slate-50 shadow-md text-xs">
        <p className="font-bold text-sm mb-1">{label}</p>
        <div className="space-y-1">
          <p className="text-emerald-400 flex justify-between gap-4">
            <span>Good Eggs:</span>
            <span className="font-mono font-semibold">{good.toLocaleString()}</span>
          </p>
          <p className="text-amber-400 flex justify-between gap-4">
            <span>Cracked:</span>
            <span className="font-mono font-semibold">
              {(payload.find((p: TooltipPayloadItem) => p.dataKey === "crackedEggs")?.value || 0).toLocaleString()}
            </span>
          </p>
          <p className="text-rose-400 flex justify-between gap-4">
            <span>Damaged:</span>
            <span className="font-mono font-semibold">
              {(payload.find((p: TooltipPayloadItem) => p.dataKey === "damagedEggs")?.value || 0).toLocaleString()}
            </span>
          </p>
          <div className="border-t border-slate-700 pt-1 mt-1 flex justify-between gap-4 font-bold">
            <span>Total:</span>
            <span className="font-mono">{total.toLocaleString()} ({rate}%)</span>
          </div>
        </div>
      </div>
    );
  }
  return null;
}
