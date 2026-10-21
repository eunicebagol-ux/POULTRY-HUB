import {
  format,
  parseISO,
  startOfWeek,
  endOfWeek,
  subWeeks,
  startOfMonth,
  endOfMonth,
  subMonths,
  startOfYear,
  endOfYear,
  subYears,
  subDays,
  getDaysInMonth,
  eachDayOfInterval,
} from "date-fns";
import type {
  ReportingPeriod,
  EggProductionSummary,
  EggProductionComparison,
  EggProductionChartPoint,
  EggProductionRecordDetail,
  ExportFormat,
} from "@/types/egg-reports";

/**
 * Period boundaries interface.
 */
export interface PeriodBoundaries {
  period: ReportingPeriod;
  dateKey: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  formattedDateRange: string;
  periodLabel: string;
  previousStartDate: string;
  previousEndDate: string;
  previousPeriodLabel: string;
}

/**
 * Derives accurate date boundaries for Daily, Weekly, Monthly, and Yearly periods.
 * Weeks strictly run Monday through Sunday (weekStartsOn: 1).
 */
export function getPeriodBoundaries(
  period: ReportingPeriod,
  dateInput?: string // YYYY-MM-DD, YYYY-MM, or YYYY
): PeriodBoundaries {
  // Use today in Philippine local context if not specified
  const now = new Date();
  const baseDate = dateInput ? parseISO(dateInput.length === 4 ? `${dateInput}-01-01` : (dateInput.length === 7 ? `${dateInput}-01` : dateInput)) : now;

  switch (period) {
    case "daily": {
      const targetDate = format(baseDate, "yyyy-MM-dd");
      const prevDate = format(subDays(baseDate, 1), "yyyy-MM-dd");
      return {
        period,
        dateKey: targetDate,
        startDate: targetDate,
        endDate: targetDate,
        formattedDateRange: format(baseDate, "MMMM d, yyyy"),
        periodLabel: `Daily Report — ${format(baseDate, "MMM d, yyyy")}`,
        previousStartDate: prevDate,
        previousEndDate: prevDate,
        previousPeriodLabel: `Previous Day (${format(subDays(baseDate, 1), "MMM d, yyyy")})`,
      };
    }

    case "weekly": {
      // Monday to Sunday
      const monday = startOfWeek(baseDate, { weekStartsOn: 1 });
      const sunday = endOfWeek(baseDate, { weekStartsOn: 1 });
      const prevMonday = startOfWeek(subWeeks(baseDate, 1), { weekStartsOn: 1 });
      const prevSunday = endOfWeek(subWeeks(baseDate, 1), { weekStartsOn: 1 });

      const startDate = format(monday, "yyyy-MM-dd");
      const endDate = format(sunday, "yyyy-MM-dd");

      return {
        period,
        dateKey: startDate, // Identify week by its Monday date
        startDate,
        endDate,
        formattedDateRange: `${format(monday, "MMM d, yyyy")} – ${format(sunday, "MMM d, yyyy")}`,
        periodLabel: `Weekly Report — Week of ${format(monday, "MMM d, yyyy")}`,
        previousStartDate: format(prevMonday, "yyyy-MM-dd"),
        previousEndDate: format(prevSunday, "yyyy-MM-dd"),
        previousPeriodLabel: `Previous Week (${format(prevMonday, "MMM d")} – ${format(prevSunday, "MMM d")})`,
      };
    }

    case "monthly": {
      const firstDay = startOfMonth(baseDate);
      const lastDay = endOfMonth(baseDate);
      const prevFirstDay = startOfMonth(subMonths(baseDate, 1));
      const prevLastDay = endOfMonth(subMonths(baseDate, 1));

      const dateKey = format(baseDate, "yyyy-MM");

      return {
        period,
        dateKey,
        startDate: format(firstDay, "yyyy-MM-dd"),
        endDate: format(lastDay, "yyyy-MM-dd"),
        formattedDateRange: format(baseDate, "MMMM yyyy"),
        periodLabel: `Monthly Report — ${format(baseDate, "MMMM yyyy")}`,
        previousStartDate: format(prevFirstDay, "yyyy-MM-dd"),
        previousEndDate: format(prevLastDay, "yyyy-MM-dd"),
        previousPeriodLabel: `Previous Month (${format(prevFirstDay, "MMMM yyyy")})`,
      };
    }

    case "yearly": {
      const firstDay = startOfYear(baseDate);
      const lastDay = endOfYear(baseDate);
      const prevFirstDay = startOfYear(subYears(baseDate, 1));
      const prevLastDay = endOfYear(subYears(baseDate, 1));

      const dateKey = format(baseDate, "yyyy");

      return {
        period,
        dateKey,
        startDate: format(firstDay, "yyyy-MM-dd"),
        endDate: format(lastDay, "yyyy-MM-dd"),
        formattedDateRange: `Year ${dateKey}`,
        periodLabel: `Yearly Report — ${dateKey}`,
        previousStartDate: format(prevFirstDay, "yyyy-MM-dd"),
        previousEndDate: format(prevLastDay, "yyyy-MM-dd"),
        previousPeriodLabel: `Previous Year (${format(prevFirstDay, "yyyy")})`,
      };
    }
  }
}

/**
 * Calculates summary metrics for egg production records.
 */
export function calculateEggProductionSummary(
  records: EggProductionRecordDetail[],
  period: ReportingPeriod,
  dateKey: string
): EggProductionSummary {
  const totalEggs = records.reduce((sum, r) => sum + (r.total_eggs || 0), 0);
  const goodEggs = records.reduce((sum, r) => sum + (r.good_eggs || 0), 0);
  const crackedEggs = records.reduce((sum, r) => sum + (r.cracked_eggs || 0), 0);
  const damagedEggs = records.reduce((sum, r) => sum + (r.damaged_eggs || 0), 0);

  const goodEggsRate = totalEggs > 0 ? (goodEggs / totalEggs) * 100 : 0;
  const crackedEggsRate = totalEggs > 0 ? (crackedEggs / totalEggs) * 100 : 0;
  const damagedEggsRate = totalEggs > 0 ? (damagedEggs / totalEggs) * 100 : 0;

  let periodAverage = 0;
  let averageLabel = "Average";

  switch (period) {
    case "daily":
      periodAverage = records.length > 0 ? Math.round(totalEggs / records.length) : 0;
      averageLabel = "Shift Average";
      break;
    case "weekly":
      periodAverage = Math.round(totalEggs / 7);
      averageLabel = "Daily Average";
      break;
    case "monthly": {
      const baseDate = parseISO(`${dateKey}-01`);
      const days = getDaysInMonth(baseDate);
      periodAverage = days > 0 ? Math.round(totalEggs / days) : 0;
      averageLabel = "Daily Average";
      break;
    }
    case "yearly":
      periodAverage = Math.round(totalEggs / 12);
      averageLabel = "Monthly Average";
      break;
  }

  return {
    totalEggs,
    goodEggs,
    crackedEggs,
    damagedEggs,
    goodEggsRate: Number(goodEggsRate.toFixed(2)),
    crackedEggsRate: Number(crackedEggsRate.toFixed(2)),
    damagedEggsRate: Number(damagedEggsRate.toFixed(2)),
    periodAverage,
    averageLabel,
    recordCount: records.length,
  };
}

/**
 * Computes comparison against the previous period.
 * Does NOT display fake comparisons when previous period has no data.
 */
export function calculatePeriodComparison(
  currentTotalEggs: number,
  currentGoodEggs: number,
  previousRecords: EggProductionRecordDetail[],
  previousPeriodLabel: string
): EggProductionComparison | null {
  if (!previousRecords || previousRecords.length === 0) {
    return {
      hasPreviousPeriod: false,
      previousPeriodLabel,
      previousTotalEggs: null,
      previousGoodEggs: null,
      totalEggsDiff: null,
      totalEggsPercentChange: null,
      goodEggsDiff: null,
      goodEggsPercentChange: null,
    };
  }

  const prevTotal = previousRecords.reduce((sum, r) => sum + (r.total_eggs || 0), 0);
  const prevGood = previousRecords.reduce((sum, r) => sum + (r.good_eggs || 0), 0);

  const totalDiff = currentTotalEggs - prevTotal;
  const goodDiff = currentGoodEggs - prevGood;

  const totalPercent = prevTotal > 0 ? ((totalDiff / prevTotal) * 100) : null;
  const goodPercent = prevGood > 0 ? ((goodDiff / prevGood) * 100) : null;

  return {
    hasPreviousPeriod: true,
    previousPeriodLabel,
    previousTotalEggs: prevTotal,
    previousGoodEggs: prevGood,
    totalEggsDiff: totalDiff,
    totalEggsPercentChange: totalPercent !== null ? Number(totalPercent.toFixed(1)) : null,
    goodEggsDiff: goodDiff,
    goodEggsPercentChange: goodPercent !== null ? Number(goodPercent.toFixed(1)) : null,
  };
}

/**
 * Generates appropriate chart data points for the given period.
 */
export function generateChartData(
  period: ReportingPeriod,
  boundaries: PeriodBoundaries,
  records: EggProductionRecordDetail[]
): EggProductionChartPoint[] {
  switch (period) {
    case "daily": {
      // Group by collection shift or flock
      if (records.length === 0) {
        return [
          { label: "Morning", totalEggs: 0, goodEggs: 0, crackedEggs: 0, damagedEggs: 0 },
          { label: "Afternoon", totalEggs: 0, goodEggs: 0, crackedEggs: 0, damagedEggs: 0 },
          { label: "Evening", totalEggs: 0, goodEggs: 0, crackedEggs: 0, damagedEggs: 0 },
        ];
      }

      // Group by shift if available, or by flock
      const shiftMap = new Map<string, { total: number; good: number; cracked: number; damaged: number }>();

      for (const r of records) {
        const key = r.collection_shift || r.flock_identifier || "Shift";
        const current = shiftMap.get(key) || { total: 0, good: 0, cracked: 0, damaged: 0 };
        current.total += r.total_eggs;
        current.good += r.good_eggs;
        current.cracked += r.cracked_eggs;
        current.damaged += r.damaged_eggs;
        shiftMap.set(key, current);
      }

      return Array.from(shiftMap.entries()).map(([key, data]) => ({
        label: key.charAt(0).toUpperCase() + key.slice(1).toLowerCase(),
        totalEggs: data.total,
        goodEggs: data.good,
        crackedEggs: data.cracked,
        damagedEggs: data.damaged,
      }));
    }

    case "weekly": {
      // 7 days Monday through Sunday
      const monday = parseISO(boundaries.startDate);
      const sunday = parseISO(boundaries.endDate);
      const days = eachDayOfInterval({ start: monday, end: sunday });

      return days.map((day) => {
        const dayStr = format(day, "yyyy-MM-dd");
        const dayRecords = records.filter((r) => r.production_date === dayStr);

        return {
          label: format(day, "EEE (MMM d)"),
          date: dayStr,
          totalEggs: dayRecords.reduce((s, r) => s + r.total_eggs, 0),
          goodEggs: dayRecords.reduce((s, r) => s + r.good_eggs, 0),
          crackedEggs: dayRecords.reduce((s, r) => s + r.cracked_eggs, 0),
          damagedEggs: dayRecords.reduce((s, r) => s + r.damaged_eggs, 0),
        };
      });
    }

    case "monthly": {
      // All days in the month
      const start = parseISO(boundaries.startDate);
      const end = parseISO(boundaries.endDate);
      const days = eachDayOfInterval({ start, end });

      return days.map((day) => {
        const dayStr = format(day, "yyyy-MM-dd");
        const dayRecords = records.filter((r) => r.production_date === dayStr);

        return {
          label: format(day, "d"),
          date: dayStr,
          totalEggs: dayRecords.reduce((s, r) => s + r.total_eggs, 0),
          goodEggs: dayRecords.reduce((s, r) => s + r.good_eggs, 0),
          crackedEggs: dayRecords.reduce((s, r) => s + r.cracked_eggs, 0),
          damagedEggs: dayRecords.reduce((s, r) => s + r.damaged_eggs, 0),
        };
      });
    }

    case "yearly": {
      // 12 months (Jan through Dec)
      const year = boundaries.dateKey;
      const months = Array.from({ length: 12 }, (_, i) => {
        const m = (i + 1).toString().padStart(2, "0");
        return {
          monthKey: `${year}-${m}`,
          label: format(parseISO(`${year}-${m}-01`), "MMM"),
        };
      });

      return months.map(({ monthKey, label }) => {
        const monthRecords = records.filter((r) => r.production_date.startsWith(monthKey));

        return {
          label,
          date: monthKey,
          totalEggs: monthRecords.reduce((s, r) => s + r.total_eggs, 0),
          goodEggs: monthRecords.reduce((s, r) => s + r.good_eggs, 0),
          crackedEggs: monthRecords.reduce((s, r) => s + r.cracked_eggs, 0),
          damagedEggs: monthRecords.reduce((s, r) => s + r.damaged_eggs, 0),
        };
      });
    }
  }
}

/**
 * Standardized descriptive export filename per user requirement:
 * - poultry-hub-egg-report-daily-2026-10-20.xlsx
 * - poultry-hub-egg-report-weekly-2026-10-19.xlsx
 * - poultry-hub-egg-report-monthly-2026-10.xlsx
 * - poultry-hub-egg-report-yearly-2026.xlsx
 */
export function getExportFilename(
  period: ReportingPeriod,
  dateKey: string,
  format: ExportFormat
): string {
  return `poultry-hub-egg-report-${period}-${dateKey}.${format}`;
}
