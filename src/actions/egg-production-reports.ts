"use server";

import { getCurrentUserProfile } from "@/lib/user-profile";
import { createClient } from "@/lib/supabase/server";
import type {
  ReportingPeriod,
  EggProductionPeriodReport,
  EggProductionRecordDetail,
} from "@/types/egg-reports";
import {
  getPeriodBoundaries,
  calculateEggProductionSummary,
  calculatePeriodComparison,
  generateChartData,
} from "@/lib/egg-reports-utils";

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

/**
 * Fetches egg production records and aggregations for Daily, Weekly, Monthly, or Yearly reporting.
 *
 * Security:
 * - Requires an authenticated, active profile (ADMIN or STAFF).
 * - Enforces database-level RLS policies.
 * - Prevents double counting by querying primary egg_production collection records.
 */
export async function getEggProductionPeriodReport(
  period: ReportingPeriod = "daily",
  dateInput?: string
): Promise<ActionResult<EggProductionPeriodReport>> {
  try {
    const caller = await getCurrentUserProfile();
    if (!caller || !caller.is_active) {
      return { success: false, error: "Unauthorized: active account required." };
    }

    const boundaries = getPeriodBoundaries(period, dateInput);
    const supabase = await createClient();

    // 1. Fetch current period records
    const { data: currentData, error: currentError } = await supabase
      .from("egg_production")
      .select(`
        id,
        flock_id,
        production_date,
        collection_shift,
        total_eggs,
        good_eggs,
        damaged_eggs,
        cracked_eggs,
        notes,
        created_at,
        flocks (
          id,
          flock_identifier,
          breed
        ),
        egg_production_sizes (
          size,
          quantity
        )
      `)
      .gte("production_date", boundaries.startDate)
      .lte("production_date", boundaries.endDate)
      .order("production_date", { ascending: true })
      .order("created_at", { ascending: true });

    if (currentError) {
      console.error("[getEggProductionPeriodReport] Current period error:", currentError);
      return { success: false, error: currentError.message };
    }

    // 2. Fetch previous period records for comparison
    const { data: prevData, error: prevError } = await supabase
      .from("egg_production")
      .select(`
        id,
        production_date,
        total_eggs,
        good_eggs,
        damaged_eggs,
        cracked_eggs
      `)
      .gte("production_date", boundaries.previousStartDate)
      .lte("production_date", boundaries.previousEndDate);

    if (prevError) {
      console.error("[getEggProductionPeriodReport] Previous period error:", prevError);
    }

    // 3. Map current records to detailed domain model
    const currentRecords: EggProductionRecordDetail[] = (currentData || []).map((row) => {
      const flockObj = Array.isArray(row.flocks) ? row.flocks[0] : row.flocks;
      const sizesArr = (row.egg_production_sizes || []).map((s) => ({
        size: s.size,
        quantity: s.quantity,
      }));

      return {
        id: row.id,
        production_date: row.production_date,
        collection_shift: row.collection_shift,
        flock_id: row.flock_id,
        flock_identifier: flockObj?.flock_identifier || "Unknown Flock",
        flock_breed: flockObj?.breed || null,
        total_eggs: row.total_eggs,
        good_eggs: row.good_eggs,
        damaged_eggs: row.damaged_eggs,
        cracked_eggs: row.cracked_eggs,
        notes: row.notes,
        created_at: row.created_at,
        sizes: sizesArr,
      };
    });

    // 4. Map previous records for comparison
    const previousRecords: EggProductionRecordDetail[] = (prevData || []).map((row) => ({
      id: row.id,
      production_date: row.production_date,
      collection_shift: null,
      flock_id: "",
      flock_identifier: "",
      flock_breed: null,
      total_eggs: row.total_eggs,
      good_eggs: row.good_eggs,
      damaged_eggs: row.damaged_eggs,
      cracked_eggs: row.cracked_eggs,
      notes: null,
      created_at: "",
    }));

    // 5. Calculate summary & reconciliation
    const summary = calculateEggProductionSummary(currentRecords, period, boundaries.dateKey);

    // 6. Calculate comparison
    const comparison = calculatePeriodComparison(
      summary.totalEggs,
      summary.goodEggs,
      previousRecords,
      boundaries.previousPeriodLabel
    );

    // 7. Generate chart data points
    const chartData = generateChartData(period, boundaries, currentRecords);

    return {
      success: true,
      data: {
        period,
        dateKey: boundaries.dateKey,
        startDate: boundaries.startDate,
        endDate: boundaries.endDate,
        formattedDateRange: boundaries.formattedDateRange,
        periodLabel: boundaries.periodLabel,
        summary,
        comparison,
        chartData,
        records: currentRecords,
      },
    };
  } catch (error) {
    console.error("[getEggProductionPeriodReport] Unexpected error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate report",
    };
  }
}
