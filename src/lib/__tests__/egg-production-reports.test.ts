import { describe, it, expect } from "vitest";
import {
  getPeriodBoundaries,
  calculateEggProductionSummary,
  calculatePeriodComparison,
  generateChartData,
  getExportFilename,
} from "../egg-reports-utils";
import {
  generateEggReportExcel,
  generateEggReportCSV,
  generateEggReportPDF,
} from "../egg-reports-export";
import type {
  EggProductionPeriodReport,
  EggProductionRecordDetail,
} from "../../types/egg-reports";

describe("Egg Production Reporting & Calculation Logic", () => {
  // Mock production records
  const sampleRecords: EggProductionRecordDetail[] = [
    {
      id: "rec-1",
      production_date: "2026-10-20",
      collection_shift: "MORNING",
      flock_id: "flock-1",
      flock_identifier: "Flock A - Lohmann Brown",
      flock_breed: "Lohmann Brown",
      total_eggs: 500,
      good_eggs: 480,
      damaged_eggs: 12,
      cracked_eggs: 8,
      notes: "Clean morning collection",
      created_at: "2026-10-20T08:00:00Z",
    },
    {
      id: "rec-2",
      production_date: "2026-10-20",
      collection_shift: "AFTERNOON",
      flock_id: "flock-1",
      flock_identifier: "Flock A - Lohmann Brown",
      flock_breed: "Lohmann Brown",
      total_eggs: 300,
      good_eggs: 290,
      damaged_eggs: 6,
      cracked_eggs: 4,
      notes: "Afternoon shift",
      created_at: "2026-10-20T14:00:00Z",
    },
  ];

  describe("1. Date Boundaries", () => {
    it("derives accurate daily boundaries and previous day", () => {
      const b = getPeriodBoundaries("daily", "2026-10-20");
      expect(b.period).toBe("daily");
      expect(b.startDate).toBe("2026-10-20");
      expect(b.endDate).toBe("2026-10-20");
      expect(b.previousStartDate).toBe("2026-10-19");
      expect(b.previousEndDate).toBe("2026-10-19");
      expect(b.dateKey).toBe("2026-10-20");
    });

    it("derives weekly boundaries from Monday to Sunday", () => {
      // 2026-10-20 is a Tuesday. Monday is 2026-10-19, Sunday is 2026-10-25
      const b = getPeriodBoundaries("weekly", "2026-10-20");
      expect(b.period).toBe("weekly");
      expect(b.startDate).toBe("2026-10-19"); // Monday
      expect(b.endDate).toBe("2026-10-25"); // Sunday
      expect(b.previousStartDate).toBe("2026-10-12"); // Prev Monday
      expect(b.previousEndDate).toBe("2026-10-18"); // Prev Sunday
    });

    it("derives monthly boundaries for entire month", () => {
      const b = getPeriodBoundaries("monthly", "2026-10");
      expect(b.period).toBe("monthly");
      expect(b.startDate).toBe("2026-10-01");
      expect(b.endDate).toBe("2026-10-31");
      expect(b.previousStartDate).toBe("2026-09-01");
      expect(b.previousEndDate).toBe("2026-09-30");
      expect(b.dateKey).toBe("2026-10");
    });

    it("derives yearly boundaries from Jan 1 to Dec 31", () => {
      const b = getPeriodBoundaries("yearly", "2026");
      expect(b.period).toBe("yearly");
      expect(b.startDate).toBe("2026-01-01");
      expect(b.endDate).toBe("2026-12-31");
      expect(b.previousStartDate).toBe("2025-01-01");
      expect(b.previousEndDate).toBe("2025-12-31");
      expect(b.dateKey).toBe("2026");
    });
  });

  describe("2. Summary Metrics & Integrity", () => {
    it("reconciles good + cracked + damaged = total eggs", () => {
      const summary = calculateEggProductionSummary(sampleRecords, "daily", "2026-10-20");
      expect(summary.totalEggs).toBe(800);
      expect(summary.goodEggs).toBe(770);
      expect(summary.crackedEggs).toBe(12);
      expect(summary.damagedEggs).toBe(18);
      expect(summary.goodEggs + summary.crackedEggs + summary.damagedEggs).toBe(summary.totalEggs);
      expect(summary.goodEggsRate).toBe(96.25);
      expect(summary.periodAverage).toBe(400); // 800 / 2 shifts
      expect(summary.averageLabel).toBe("Shift Average");
    });

    it("calculates weekly average across 7 days", () => {
      const summary = calculateEggProductionSummary(sampleRecords, "weekly", "2026-10-19");
      expect(summary.totalEggs).toBe(800);
      expect(summary.periodAverage).toBe(114); // 800 / 7 = 114
      expect(summary.averageLabel).toBe("Daily Average");
    });

    it("handles empty records without NaN or crash", () => {
      const summary = calculateEggProductionSummary([], "daily", "2026-10-20");
      expect(summary.totalEggs).toBe(0);
      expect(summary.goodEggs).toBe(0);
      expect(summary.goodEggsRate).toBe(0);
      expect(summary.periodAverage).toBe(0);
      expect(summary.recordCount).toBe(0);
    });
  });

  describe("3. Comparison against Previous Periods", () => {
    it("returns hasPreviousPeriod: false when previous period has no records", () => {
      const comp = calculatePeriodComparison(800, 770, [], "Previous Day");
      expect(comp?.hasPreviousPeriod).toBe(false);
      expect(comp?.previousTotalEggs).toBeNull();
      expect(comp?.totalEggsPercentChange).toBeNull();
    });

    it("calculates percentage changes correctly when previous data exists", () => {
      const prevRecords: EggProductionRecordDetail[] = [
        {
          id: "prev-1",
          production_date: "2026-10-19",
          collection_shift: "MORNING",
          flock_id: "flock-1",
          flock_identifier: "Flock A",
          flock_breed: null,
          total_eggs: 640,
          good_eggs: 600,
          damaged_eggs: 20,
          cracked_eggs: 20,
          notes: null,
          created_at: "",
        },
      ];

      const comp = calculatePeriodComparison(800, 770, prevRecords, "Previous Day");
      expect(comp?.hasPreviousPeriod).toBe(true);
      expect(comp?.previousTotalEggs).toBe(640);
      expect(comp?.totalEggsDiff).toBe(160); // 800 - 640
      expect(comp?.totalEggsPercentChange).toBe(25); // (160 / 640) * 100 = 25%
      expect(comp?.goodEggsDiff).toBe(170); // 770 - 600
    });
  });

  describe("4. Chart Data Generation", () => {
    it("generates 7 days for weekly report", () => {
      const b = getPeriodBoundaries("weekly", "2026-10-20");
      const chart = generateChartData("weekly", b, sampleRecords);
      expect(chart).toHaveLength(7);
      // Tuesday Oct 20 should have 800 total eggs
      const tue = chart.find((c) => c.date === "2026-10-20");
      expect(tue?.totalEggs).toBe(800);
      expect(tue?.goodEggs).toBe(770);
    });

    it("generates 12 months for yearly report", () => {
      const b = getPeriodBoundaries("yearly", "2026");
      const chart = generateChartData("yearly", b, sampleRecords);
      expect(chart).toHaveLength(12);
      expect(chart[0].label).toBe("Jan");
      expect(chart[9].label).toBe("Oct");
      expect(chart[9].totalEggs).toBe(800);
    });
  });

  describe("5. Filenames & Export Formats", () => {
    it("generates exact required descriptive filenames", () => {
      expect(getExportFilename("daily", "2026-10-20", "xlsx")).toBe(
        "poultry-hub-egg-report-daily-2026-10-20.xlsx"
      );
      expect(getExportFilename("weekly", "2026-10-19", "xlsx")).toBe(
        "poultry-hub-egg-report-weekly-2026-10-19.xlsx"
      );
      expect(getExportFilename("monthly", "2026-10", "xlsx")).toBe(
        "poultry-hub-egg-report-monthly-2026-10.xlsx"
      );
      expect(getExportFilename("yearly", "2026", "xlsx")).toBe(
        "poultry-hub-egg-report-yearly-2026.xlsx"
      );
    });

    it("generates valid Excel file buffer", () => {
      const summary = calculateEggProductionSummary(sampleRecords, "daily", "2026-10-20");
      const report: EggProductionPeriodReport = {
        period: "daily",
        dateKey: "2026-10-20",
        startDate: "2026-10-20",
        endDate: "2026-10-20",
        formattedDateRange: "October 20, 2026",
        periodLabel: "Daily Report",
        summary,
        comparison: null,
        chartData: [],
        records: sampleRecords,
      };

      const buf = generateEggReportExcel(report, {
        generatedAt: "Oct 20, 2026, 8:00 PM",
        generatedBy: "Farm Admin",
      });
      expect(buf).toBeInstanceOf(Buffer);
      expect(buf.length).toBeGreaterThan(100);
    });

    it("generates valid CSV buffer with UTF-8 BOM and metadata headers", () => {
      const summary = calculateEggProductionSummary(sampleRecords, "daily", "2026-10-20");
      const report: EggProductionPeriodReport = {
        period: "daily",
        dateKey: "2026-10-20",
        startDate: "2026-10-20",
        endDate: "2026-10-20",
        formattedDateRange: "October 20, 2026",
        periodLabel: "Daily Report",
        summary,
        comparison: null,
        chartData: [],
        records: sampleRecords,
      };

      const buf = generateEggReportCSV(report, {
        generatedAt: "Oct 20, 2026, 8:00 PM",
        generatedBy: "Farm Admin",
      });
      expect(buf).toBeInstanceOf(Buffer);
      const csvStr = buf.toString("utf-8");
      // Check BOM
      expect(csvStr.charCodeAt(0)).toBe(0xfeff);
      // Check headers
      expect(csvStr).toContain("POULTRY HUB — Egg Production Report");
      expect(csvStr).toContain("Total Eggs: 800");
      expect(csvStr).toContain("Good Eggs: 770");
      expect(csvStr).toContain('"Flock A - Lohmann Brown"');
    });

    it("generates valid PDF buffer with jsPDF", () => {
      const summary = calculateEggProductionSummary(sampleRecords, "daily", "2026-10-20");
      const report: EggProductionPeriodReport = {
        period: "daily",
        dateKey: "2026-10-20",
        startDate: "2026-10-20",
        endDate: "2026-10-20",
        formattedDateRange: "October 20, 2026",
        periodLabel: "Daily Report",
        summary,
        comparison: null,
        chartData: [],
        records: sampleRecords,
      };

      const buf = generateEggReportPDF(report, {
        generatedAt: "Oct 20, 2026, 8:00 PM",
        generatedBy: "Farm Admin",
      });
      expect(buf).toBeInstanceOf(Buffer);
      expect(buf.length).toBeGreaterThan(500);
      // PDF magic number header: %PDF-
      expect(buf.slice(0, 4).toString()).toBe("%PDF");
    });
  });
});
