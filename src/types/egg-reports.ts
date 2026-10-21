export type ReportingPeriod = "daily" | "weekly" | "monthly" | "yearly";

export type ExportFormat = "xlsx" | "csv" | "pdf";

export interface EggProductionSummary {
  totalEggs: number;
  goodEggs: number;
  crackedEggs: number;
  damagedEggs: number;
  goodEggsRate: number; // percentage (0 - 100)
  crackedEggsRate: number; // percentage
  damagedEggsRate: number; // percentage
  periodAverage: number; // daily average for weekly/monthly, monthly average for yearly, shift average for daily
  averageLabel: string; // "Daily Average", "Monthly Average", "Shift Average"
  recordCount: number;
}

export interface EggProductionComparison {
  hasPreviousPeriod: boolean;
  previousPeriodLabel: string;
  previousTotalEggs: number | null;
  previousGoodEggs: number | null;
  totalEggsDiff: number | null;
  totalEggsPercentChange: number | null;
  goodEggsDiff: number | null;
  goodEggsPercentChange: number | null;
}

export interface EggProductionChartPoint {
  label: string;
  date?: string;
  totalEggs: number;
  goodEggs: number;
  crackedEggs: number;
  damagedEggs: number;
}

export interface EggProductionRecordDetail {
  id: string;
  production_date: string;
  collection_shift: string | null;
  flock_id: string;
  flock_identifier: string;
  flock_breed: string | null;
  total_eggs: number;
  good_eggs: number;
  damaged_eggs: number;
  cracked_eggs: number;
  notes: string | null;
  created_at: string;
  sizes?: Array<{ size: string; quantity: number }>;
}

export interface EggProductionPeriodReport {
  period: ReportingPeriod;
  dateKey: string;
  startDate: string;
  endDate: string;
  formattedDateRange: string;
  periodLabel: string;
  summary: EggProductionSummary;
  comparison: EggProductionComparison | null;
  chartData: EggProductionChartPoint[];
  records: EggProductionRecordDetail[];
}
